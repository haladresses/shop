import { z } from "zod";

// Promotion create/update payload. Pure zod — the admin editor runs the same
// schema in the browser for inline errors, and the API is the final check.
//
// Dates come in as shop-local "YYYY-MM-DDTHH:mm" (Asia/Muscat, UTC+4 with no
// DST); see localToDate / dateToLocal.

export const SHOP_UTC_OFFSET = "+04:00";
const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "2026-12-01T09:00" (shop time) → Date. */
export function localToDate(v: string): Date {
  const withSeconds = v.length === 16 ? `${v}:00` : v;
  return new Date(`${withSeconds}.000${SHOP_UTC_OFFSET}`);
}

/** Date → "2026-12-01T09:00" in shop time (for <input type="datetime-local">). */
export function dateToLocal(d: Date | string | null | undefined): string {
  if (!d) return "";
  const t = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return "";
  return new Date(t.getTime() + 4 * 3600 * 1000).toISOString().slice(0, 16);
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optNumber = (min: number, max: number) => z.number().min(min).max(max).optional().nullable();
const optInt = (min: number, max: number) => z.number().int().min(min).max(max).optional().nullable();
const optLocalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || LOCAL_DT_RE.test(v), "Use a valid date and time");
const optTime = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || HHMM_RE.test(v), "Use HH:MM (24-hour)");

export const PROMOTION_TYPE_ENUM = z.enum([
  "PERCENT_OFF",
  "AMOUNT_OFF",
  "FIXED_PRICE",
  "BUY_X_GET_Y",
  "MIX_AND_MATCH",
  "ORDER_THRESHOLD",
]);
export const PROMOTION_SCOPE_ENUM = z.enum(["ALL", "PRODUCTS", "CATEGORIES"]);
export const PROMOTION_CHANNEL_ENUM = z.enum(["ALL", "ONLINE", "POS"]);

const idList = z.array(z.string().min(1)).max(5000).default([]);

export const promotionInputSchema = z
  .object({
    nameEn: z.string().trim().min(2, "English name is required").max(120),
    nameAr: z.string().trim().min(1, "Arabic name is required").max(120),
    descriptionEn: optText(1000),
    descriptionAr: optText(1000),
    badgeEn: optText(40),
    badgeAr: optText(40),
    type: PROMOTION_TYPE_ENUM,
    channel: PROMOTION_CHANNEL_ENUM.default("ALL"),
    isActive: z.boolean().default(true),
    startsAt: optLocalDate,
    endsAt: optLocalDate,
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 && v.length < 7 ? Array.from(new Set(v)).sort() : null)),
    startTime: optTime,
    endTime: optTime,
    priority: z.number().int().min(-1000).max(1000).default(0),

    discountPercent: optNumber(0, 100),
    discountAmount: optNumber(0, 1_000_000),
    fixedPrice: optNumber(0, 1_000_000),
    buyQuantity: optInt(1, 1000),
    getQuantity: optInt(1, 1000),
    minSpend: optNumber(0, 10_000_000),
    maxApplicationsPerOrder: optInt(1, 10_000),
    usageLimit: optInt(1, 10_000_000),

    buyScope: PROMOTION_SCOPE_ENUM.default("PRODUCTS"),
    getScope: PROMOTION_SCOPE_ENUM.optional().nullable(),
    excludeSaleItems: z.boolean().default(false),
    buyProductIds: idList,
    buyCategoryIds: idList,
    getProductIds: idList,
    getCategoryIds: idList,
  })
  .superRefine((d, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const has = (v: number | null | undefined) => v != null && !Number.isNaN(v);

    switch (d.type) {
      case "PERCENT_OFF":
        if (!has(d.discountPercent) || d.discountPercent! <= 0 || d.discountPercent! > 100) {
          issue("discountPercent", "Enter a percentage between 0 and 100");
        }
        break;
      case "AMOUNT_OFF":
        if (!has(d.discountAmount) || d.discountAmount! <= 0) issue("discountAmount", "Enter an amount greater than zero");
        break;
      case "FIXED_PRICE":
        if (!has(d.fixedPrice) || d.fixedPrice! < 0) issue("fixedPrice", "Enter the price items sell for");
        break;
      case "BUY_X_GET_Y":
        if (!has(d.buyQuantity) || d.buyQuantity! < 1) issue("buyQuantity", "Buy quantity must be at least 1");
        if (!has(d.getQuantity) || d.getQuantity! < 1) issue("getQuantity", "Get quantity must be at least 1");
        if (has(d.discountPercent) && (d.discountPercent! < 1 || d.discountPercent! > 100)) {
          issue("discountPercent", "Reward discount must be between 1% and 100% (100% = free)");
        }
        break;
      case "MIX_AND_MATCH":
        if (!has(d.buyQuantity) || d.buyQuantity! < 2) issue("buyQuantity", "A set needs at least 2 items");
        if (!has(d.fixedPrice) || d.fixedPrice! <= 0) issue("fixedPrice", "Enter the price for the whole set");
        break;
      case "ORDER_THRESHOLD": {
        if (!has(d.minSpend) || d.minSpend! <= 0) issue("minSpend", "Enter the amount customers must spend");
        const pct = has(d.discountPercent) && d.discountPercent! > 0;
        const amt = has(d.discountAmount) && d.discountAmount! > 0;
        if (pct === amt) issue("discountPercent", "Choose either a percentage or an amount off (not both)");
        if (pct && d.discountPercent! > 100) issue("discountPercent", "Percentage can't exceed 100");
        if (amt && has(d.minSpend) && d.discountAmount! > d.minSpend!) {
          issue("discountAmount", "The saving can't be more than the amount customers must spend");
        }
        break;
      }
    }

    if (d.buyScope === "PRODUCTS" && d.buyProductIds.length === 0) issue("buyProductIds", "Pick at least one product");
    if (d.buyScope === "CATEGORIES" && d.buyCategoryIds.length === 0) issue("buyCategoryIds", "Pick at least one category");
    if (d.getScope != null) {
      if (d.type !== "BUY_X_GET_Y") issue("getScope", "Reward items only apply to Buy X, get Y deals");
      if (d.getScope === "PRODUCTS" && d.getProductIds.length === 0) issue("getProductIds", "Pick at least one reward product");
      if (d.getScope === "CATEGORIES" && d.getCategoryIds.length === 0) issue("getCategoryIds", "Pick at least one reward category");
    }

    if (d.startsAt && d.endsAt && localToDate(d.endsAt) <= localToDate(d.startsAt)) {
      issue("endsAt", "The end must be after the start");
    }
    if ((d.startTime == null) !== (d.endTime == null)) {
      issue(d.startTime == null ? "startTime" : "endTime", "Set both a start and an end time (or neither)");
    } else if (d.startTime && d.startTime === d.endTime) {
      issue("endTime", "Start and end time can't be the same");
    }
  });

export type PromotionInput = z.input<typeof promotionInputSchema>;
export type PromotionParsed = z.output<typeof promotionInputSchema>;

/** Keeps only the parameters that mean something for the chosen type. */
export function normalizePromotion(d: PromotionParsed) {
  const t = d.type;
  const keep = {
    discountPercent:
      t === "PERCENT_OFF" || t === "ORDER_THRESHOLD" ? d.discountPercent ?? null : t === "BUY_X_GET_Y" ? d.discountPercent ?? 100 : null,
    discountAmount: t === "AMOUNT_OFF" || t === "ORDER_THRESHOLD" ? d.discountAmount ?? null : null,
    fixedPrice: t === "FIXED_PRICE" || t === "MIX_AND_MATCH" ? d.fixedPrice ?? null : null,
    buyQuantity: t === "BUY_X_GET_Y" || t === "MIX_AND_MATCH" ? d.buyQuantity ?? null : null,
    getQuantity: t === "BUY_X_GET_Y" ? d.getQuantity ?? null : null,
    minSpend: t === "ORDER_THRESHOLD" ? d.minSpend ?? null : null,
  };
  // Spend & save: exactly one of % / amount.
  if (t === "ORDER_THRESHOLD") {
    if (keep.discountPercent && keep.discountPercent > 0) keep.discountAmount = null;
    else keep.discountPercent = null;
  }
  const getScope = t === "BUY_X_GET_Y" ? d.getScope ?? null : null;
  return {
    ...d,
    ...keep,
    getScope,
    // A per-order cap means nothing for spend & save (it applies once).
    maxApplicationsPerOrder: t === "ORDER_THRESHOLD" ? null : d.maxApplicationsPerOrder ?? null,
    buyProductIds: d.buyScope === "PRODUCTS" ? Array.from(new Set(d.buyProductIds)) : [],
    buyCategoryIds: d.buyScope === "CATEGORIES" ? Array.from(new Set(d.buyCategoryIds)) : [],
    getProductIds: getScope === "PRODUCTS" ? Array.from(new Set(d.getProductIds)) : [],
    getCategoryIds: getScope === "CATEGORIES" ? Array.from(new Set(d.getCategoryIds)) : [],
  };
}

export type NormalizedPromotion = ReturnType<typeof normalizePromotion>;
