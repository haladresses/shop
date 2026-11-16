import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { getDefaultTaxRate, resolveCategoryTaxRates, resolveProductTaxRates } from "@/lib/tax";

/**
 * Which VAT rate applies where.
 *   GET                       categories with own + effective rate
 *   GET ?products=1&search=…  products (paged) with own + effective rate
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.tax.view", "admin.tax.manage"]);
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;

    if (sp.get("products")) {
      const search = (sp.get("search") || "").trim();
      const categoryId = sp.get("categoryId") || "";
      const rateFilter = sp.get("rate") || ""; // "own" | "inherited" | <taxRateId>
      const page = Math.max(1, parseInt(sp.get("page") || "1"));
      const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "50")));
      const where = {
        ...(categoryId && { categoryId }),
        ...(rateFilter === "own" && { taxRateId: { not: null } }),
        ...(rateFilter === "inherited" && { taxRateId: null }),
        ...(rateFilter && !["own", "inherited"].includes(rateFilter) && { taxRateId: rateFilter }),
        ...(search && {
          OR: [
            { nameEn: { contains: search, mode: "insensitive" as const } },
            { nameAr: { contains: search } },
            { sku: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };
      const [rows, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { nameEn: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            sku: true,
            basePrice: true,
            salePrice: true,
            taxRateId: true,
            category: { select: { nameEn: true } },
            images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          },
        }),
        prisma.product.count({ where }),
      ]);
      const effective = await resolveProductTaxRates(rows.map((r) => r.id));
      return ok({
        items: rows.map((r) => ({
          id: r.id,
          nameEn: r.nameEn,
          nameAr: r.nameAr,
          sku: r.sku,
          price: Number(r.salePrice ?? r.basePrice),
          categoryName: r.category.nameEn,
          imageUrl: r.images[0]?.url ?? null,
          taxRateId: r.taxRateId,
          effective: effective.get(r.id) ?? null,
        })),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    }

    const [categories, effective, defaultRate, counts] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
        select: { id: true, nameEn: true, nameAr: true, parentId: true, taxRateId: true },
      }),
      resolveCategoryTaxRates(),
      getDefaultTaxRate(),
      prisma.product.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    ]);
    const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return ok({
      defaultRate,
      categories: categories.map((c) => ({
        ...c,
        productCount: countBy.get(c.id) ?? 0,
        effective: effective.get(c.id)?.rate ?? defaultRate,
        inherited: effective.get(c.id)?.inherited ?? true,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

const assignSchema = z.object({
  target: z.enum(["categories", "products"]),
  ids: z.array(z.string().min(1)).min(1, "Select at least one item").max(2000),
  /** null = clear (inherit from category / default). */
  taxRateId: z.string().min(1).nullable(),
  /** For categories: also clear the products' own overrides so they follow the category. */
  resetProducts: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.tax.manage");
    if ("res" in g) return g.res;
    const parsed = assignSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { target, ids, taxRateId, resetProducts } = parsed.data;

    if (taxRateId) {
      const rate = await prisma.taxRate.findUnique({ where: { id: taxRateId } });
      if (!rate || !rate.isActive) return error("That tax rate doesn't exist or is inactive.");
    }

    if (target === "categories") {
      const res = await prisma.$transaction(async (tx) => {
        const c = await tx.category.updateMany({ where: { id: { in: ids } }, data: { taxRateId } });
        const p = resetProducts
          ? await tx.product.updateMany({ where: { categoryId: { in: ids } }, data: { taxRateId: null } })
          : { count: 0 };
        return { categories: c.count, productsReset: p.count };
      });
      return ok(res);
    }
    const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { taxRateId } });
    return ok({ products: res.count });
  } catch (e) {
    return serverError(e);
  }
}
