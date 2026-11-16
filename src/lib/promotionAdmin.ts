import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { describePromotion, promotionStatus } from "@/lib/promotionEngine";
import { toPromotionRule } from "@/lib/promotions";
import { dateToLocal, localToDate, type NormalizedPromotion, type PromotionInput } from "@/lib/validations/promotion";

// Server helpers for the promotions admin API (mapping DB ⇄ payload, stats).

export const PROMOTION_ADMIN_INCLUDE = {
  targets: {
    select: {
      side: true,
      productId: true,
      categoryId: true,
      product: {
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          basePrice: true,
          salePrice: true,
          isActive: true,
          categoryId: true,
          category: { select: { nameEn: true } },
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      },
      category: { select: { id: true, nameEn: true, nameAr: true } },
    },
  },
} satisfies Prisma.PromotionInclude;

export type PromotionAdminRow = Prisma.PromotionGetPayload<{ include: typeof PROMOTION_ADMIN_INCLUDE }>;

const num = (v: unknown) => (v == null ? null : Number(v));

/** Stored promotion → the create/update payload shape (for PATCH merges and duplicates). */
export function promotionToInput(p: PromotionAdminRow): PromotionInput {
  const ids = (side: string, key: "productId" | "categoryId") =>
    p.targets.filter((t) => t.side === side && t[key]).map((t) => t[key] as string);
  return {
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    descriptionEn: p.descriptionEn,
    descriptionAr: p.descriptionAr,
    badgeEn: p.badgeEn,
    badgeAr: p.badgeAr,
    type: p.type,
    channel: p.channel,
    isActive: p.isActive,
    startsAt: p.startsAt ? dateToLocal(p.startsAt) : null,
    endsAt: p.endsAt ? dateToLocal(p.endsAt) : null,
    daysOfWeek: Array.isArray(p.daysOfWeek) ? (p.daysOfWeek as unknown[]).map(Number) : null,
    startTime: p.startTime,
    endTime: p.endTime,
    priority: p.priority,
    discountPercent: num(p.discountPercent),
    discountAmount: num(p.discountAmount),
    fixedPrice: num(p.fixedPrice),
    buyQuantity: p.buyQuantity,
    getQuantity: p.getQuantity,
    minSpend: num(p.minSpend),
    maxApplicationsPerOrder: p.maxApplicationsPerOrder,
    usageLimit: p.usageLimit,
    buyScope: p.buyScope,
    getScope: p.getScope,
    excludeSaleItems: p.excludeSaleItems,
    buyProductIds: ids("BUY", "productId"),
    buyCategoryIds: ids("BUY", "categoryId"),
    getProductIds: ids("GET", "productId"),
    getCategoryIds: ids("GET", "categoryId"),
  };
}

/** Normalised payload → Promotion columns (targets are written separately). */
export function promotionData(n: NormalizedPromotion) {
  return {
    nameEn: n.nameEn,
    nameAr: n.nameAr,
    descriptionEn: n.descriptionEn,
    descriptionAr: n.descriptionAr,
    badgeEn: n.badgeEn,
    badgeAr: n.badgeAr,
    type: n.type,
    channel: n.channel,
    isActive: n.isActive,
    startsAt: n.startsAt ? localToDate(n.startsAt) : null,
    endsAt: n.endsAt ? localToDate(n.endsAt) : null,
    daysOfWeek: n.daysOfWeek ? (n.daysOfWeek as Prisma.InputJsonValue) : Prisma.JsonNull,
    startTime: n.startTime,
    endTime: n.endTime,
    priority: n.priority,
    discountPercent: n.discountPercent,
    discountAmount: n.discountAmount,
    fixedPrice: n.fixedPrice,
    buyQuantity: n.buyQuantity,
    getQuantity: n.getQuantity,
    minSpend: n.minSpend,
    maxApplicationsPerOrder: n.maxApplicationsPerOrder,
    usageLimit: n.usageLimit,
    buyScope: n.buyScope,
    getScope: n.getScope,
    excludeSaleItems: n.excludeSaleItems,
  };
}

export function targetRows(n: NormalizedPromotion) {
  return [
    ...n.buyProductIds.map((productId) => ({ side: "BUY", productId, categoryId: null })),
    ...n.buyCategoryIds.map((categoryId) => ({ side: "BUY", productId: null, categoryId })),
    ...n.getProductIds.map((productId) => ({ side: "GET", productId, categoryId: null })),
    ...n.getCategoryIds.map((categoryId) => ({ side: "GET", productId: null, categoryId })),
  ];
}

/** Every chosen product / category must still exist. Returns an error message or null. */
export async function checkTargetsExist(n: NormalizedPromotion): Promise<string | null> {
  const productIds = Array.from(new Set([...n.buyProductIds, ...n.getProductIds]));
  const categoryIds = Array.from(new Set([...n.buyCategoryIds, ...n.getCategoryIds]));
  const [pc, cc] = await Promise.all([
    productIds.length ? prisma.product.count({ where: { id: { in: productIds } } }) : 0,
    categoryIds.length ? prisma.category.count({ where: { id: { in: categoryIds } } }) : 0,
  ]);
  if (pc !== productIds.length) return "Some of the selected products no longer exist — please re-select them.";
  if (cc !== categoryIds.length) return "Some of the selected categories no longer exist — please re-select them.";
  return null;
}

export type PromotionStats = { redemptions: number; discount: number; revenue: number; lastUsedAt: string | null };

/** Redemption count, Σ discount and Σ order totals per promotion. */
export async function promotionStats(ids?: string[]): Promise<Map<string, PromotionStats>> {
  const filter = ids && ids.length ? Prisma.sql`WHERE pr."promotionId" IN (${Prisma.join(ids)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<
    { promotionId: string; redemptions: number; discount: unknown; revenue: unknown; lastUsedAt: Date | null }[]
  >`
    SELECT pr."promotionId",
           COUNT(*)::int AS redemptions,
           COALESCE(SUM(pr.discount), 0) AS discount,
           COALESCE(SUM(o.total), 0) AS revenue,
           MAX(pr."createdAt") AS "lastUsedAt"
    FROM promotion_redemptions pr
    JOIN orders o ON o.id = pr."orderId"
    ${filter}
    GROUP BY pr."promotionId"`;
  return new Map(
    rows.map((r) => [
      r.promotionId,
      {
        redemptions: r.redemptions,
        discount: Math.round(Number(r.discount) * 1000) / 1000,
        revenue: Math.round(Number(r.revenue) * 1000) / 1000,
        lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      },
    ]),
  );
}

const EMPTY_STATS: PromotionStats = { redemptions: 0, discount: 0, revenue: 0, lastUsedAt: null };

/** A promotion as the admin screens see it. */
export function serializePromotion(p: PromotionAdminRow, stats?: PromotionStats) {
  const rule = toPromotionRule(p);
  const names = (side: string) =>
    p.targets
      .filter((t) => t.side === side)
      .map((t) => t.product?.nameEn ?? t.category?.nameEn)
      .filter((v): v is string => !!v);
  const count = (side: string, key: "productId" | "categoryId") => p.targets.filter((t) => t.side === side && t[key]).length;
  return {
    id: p.id,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    descriptionEn: p.descriptionEn,
    descriptionAr: p.descriptionAr,
    badgeEn: p.badgeEn,
    badgeAr: p.badgeAr,
    type: rule.type,
    channel: rule.channel,
    isActive: p.isActive,
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
    startsAtLocal: dateToLocal(p.startsAt),
    endsAtLocal: dateToLocal(p.endsAt),
    daysOfWeek: rule.daysOfWeek,
    startTime: p.startTime,
    endTime: p.endTime,
    priority: p.priority,
    discountPercent: rule.discountPercent,
    discountAmount: rule.discountAmount,
    fixedPrice: rule.fixedPrice,
    buyQuantity: rule.buyQuantity,
    getQuantity: rule.getQuantity,
    minSpend: rule.minSpend,
    maxApplicationsPerOrder: rule.maxApplicationsPerOrder,
    usageLimit: rule.usageLimit,
    usedCount: rule.usedCount,
    buyScope: rule.buyScope,
    getScope: rule.getScope,
    excludeSaleItems: rule.excludeSaleItems,
    status: promotionStatus(rule),
    description: describePromotion(rule),
    targets: {
      buyProducts: count("BUY", "productId"),
      buyCategories: count("BUY", "categoryId"),
      getProducts: count("GET", "productId"),
      getCategories: count("GET", "categoryId"),
      buyNames: names("BUY").slice(0, 4),
      getNames: names("GET").slice(0, 4),
    },
    stats: stats ?? EMPTY_STATS,
    rule,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Product as shown in the admin pickers / editor. */
export function pickerProduct(p: {
  id: string;
  nameEn: string;
  nameAr: string;
  basePrice: unknown;
  salePrice: unknown;
  isActive: boolean;
  categoryId: string;
  category?: { nameEn: string } | null;
  images?: { url: string }[];
}) {
  const base = Number(p.basePrice);
  const sale = p.salePrice != null ? Number(p.salePrice) : null;
  return {
    id: p.id,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    basePrice: base,
    salePrice: sale,
    price: sale ?? base,
    onSale: sale != null && sale < base,
    isActive: p.isActive,
    categoryId: p.categoryId,
    categoryName: p.category?.nameEn ?? "",
    imageUrl: p.images?.[0]?.url ?? null,
  };
}

export type PickerProduct = ReturnType<typeof pickerProduct>;
