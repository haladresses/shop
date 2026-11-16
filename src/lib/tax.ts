import { z } from "zod";
import type { TaxRate } from "@prisma/client";
import prisma from "@/lib/db";
import {
  DEFAULT_TAX_SETTINGS,
  NO_TAX,
  type RateInfo,
  type TaxKind,
  type TaxSettings,
  isValidOmanVatNumber,
} from "@/lib/taxCalc";

// Server side of the VAT system: store settings, rates, and working out which
// rate applies to a product (product → category → parent categories →
// store default).

export const TAX_SETTINGS_KEY = "tax_settings_v1";

export const taxSettingsSchema = z.object({
  enabled: z.boolean(),
  pricesIncludeTax: z.boolean(),
  vatNumber: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine(isValidOmanVatNumber, "VAT number must be OM followed by 10 digits"),
  legalNameEn: z.string().trim().max(150),
  legalNameAr: z.string().trim().max(150),
  crNumber: z.string().trim().max(30),
  taxShipping: z.boolean(),
  showOnStorefront: z.boolean(),
  invoiceFooterEn: z.string().trim().max(500),
  invoiceFooterAr: z.string().trim().max(500),
});

export const taxRateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(10)
    .regex(/^[A-Za-z0-9_-]+$/, "Code can only use letters, numbers, - and _")
    .transform((v) => v.toUpperCase()),
  nameEn: z.string().trim().min(1, "English name is required").max(80),
  nameAr: z.string().trim().min(1, "Arabic name is required").max(80),
  rate: z.number().min(0, "Rate can't be negative").max(100, "Rate can't exceed 100%"),
  type: z.enum(["STANDARD", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"]),
  description: z.string().trim().max(300).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function getTaxSettings(): Promise<TaxSettings> {
  const row = await prisma.setting.findUnique({ where: { key: TAX_SETTINGS_KEY } });
  if (!row) return { ...DEFAULT_TAX_SETTINGS };
  try {
    const parsed = JSON.parse(row.value) as Partial<TaxSettings>;
    return { ...DEFAULT_TAX_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_TAX_SETTINGS };
  }
}

export async function saveTaxSettings(input: TaxSettings): Promise<TaxSettings> {
  const value = JSON.stringify(input);
  await prisma.setting.upsert({
    where: { key: TAX_SETTINGS_KEY },
    update: { value, type: "json", group: "tax", labelEn: "Tax & VAT settings", labelAr: "إعدادات الضريبة" },
    create: { key: TAX_SETTINGS_KEY, value, type: "json", group: "tax", labelEn: "Tax & VAT settings", labelAr: "إعدادات الضريبة" },
  });
  return input;
}

export function toRateInfo(r: Pick<TaxRate, "id" | "code" | "nameEn" | "nameAr" | "rate" | "type">): RateInfo {
  return { id: r.id, code: r.code, nameEn: r.nameEn, nameAr: r.nameAr, rate: Number(r.rate), type: r.type as TaxKind };
}

/** Rates must make sense for their type: only STANDARD charges a non-zero rate. */
export function normalizeRateForType(type: TaxKind, rate: number): number {
  return type === "STANDARD" ? rate : 0;
}

/** The store's default rate (used for products/categories without one, and shipping). */
export async function getDefaultTaxRate(): Promise<RateInfo> {
  const rate =
    (await prisma.taxRate.findFirst({ where: { isDefault: true, isActive: true } })) ??
    (await prisma.taxRate.findFirst({ where: { isActive: true, type: "STANDARD" }, orderBy: { sortOrder: "asc" } }));
  return rate ? toRateInfo(rate) : NO_TAX;
}

type CategoryNode = { id: string; parentId: string | null; taxRateId: string | null };

/** Walks up the category tree to the first category that sets a rate. */
function categoryRateId(categoryId: string, byId: Map<string, CategoryNode>): string | null {
  let cur = byId.get(categoryId);
  let guard = 0;
  while (cur && guard++ < 50) {
    if (cur.taxRateId) return cur.taxRateId;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return null;
}

/**
 * Effective VAT rate per product: its own rate, else the nearest category
 * (walking up parents) that has one, else the store default. Inactive rates
 * are skipped as if unset.
 */
export async function resolveProductTaxRates(productIds: string[]): Promise<Map<string, RateInfo>> {
  const result = new Map<string, RateInfo>();
  if (productIds.length === 0) return result;
  const [products, categories, rates, fallback] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, taxRateId: true, categoryId: true } }),
    prisma.category.findMany({ select: { id: true, parentId: true, taxRateId: true } }),
    prisma.taxRate.findMany({ where: { isActive: true } }),
    getDefaultTaxRate(),
  ]);
  const rateById = new Map(rates.map((r) => [r.id, toRateInfo(r)]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  for (const p of products) {
    const own = p.taxRateId ? rateById.get(p.taxRateId) : undefined;
    const fromCategory = own ? undefined : rateById.get(categoryRateId(p.categoryId, catById) ?? "");
    result.set(p.id, own ?? fromCategory ?? fallback);
  }
  return result;
}

/** Same resolution for a whole category tree (for the admin assignment screen). */
export async function resolveCategoryTaxRates(): Promise<Map<string, { rate: RateInfo; inherited: boolean }>> {
  const [categories, rates, fallback] = await Promise.all([
    prisma.category.findMany({ select: { id: true, parentId: true, taxRateId: true } }),
    prisma.taxRate.findMany({ where: { isActive: true } }),
    getDefaultTaxRate(),
  ]);
  const rateById = new Map(rates.map((r) => [r.id, toRateInfo(r)]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const out = new Map<string, { rate: RateInfo; inherited: boolean }>();
  for (const c of categories) {
    const own = c.taxRateId ? rateById.get(c.taxRateId) : undefined;
    if (own) {
      out.set(c.id, { rate: own, inherited: false });
      continue;
    }
    const parentRate = c.parentId ? rateById.get(categoryRateId(c.parentId, catById) ?? "") : undefined;
    out.set(c.id, { rate: parentRate ?? fallback, inherited: true });
  }
  return out;
}
