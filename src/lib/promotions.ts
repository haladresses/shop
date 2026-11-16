import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { PromotionRule, PromotionScopeKey, PromotionTypeKey, PromotionChannelKey } from "@/lib/promotionEngine";

// Server side of promotions: loading rules for the engine, and category
// ancestry so "category" deals also cover sub-categories.

export const PROMOTION_INCLUDE = {
  targets: { select: { side: true, productId: true, categoryId: true } },
} satisfies Prisma.PromotionInclude;

type PromotionWithTargets = Prisma.PromotionGetPayload<{ include: typeof PROMOTION_INCLUDE }>;

const n = (v: unknown) => (v == null ? null : Number(v));

export function toPromotionRule(p: PromotionWithTargets): PromotionRule {
  const ids = (side: string, key: "productId" | "categoryId") =>
    p.targets.filter((t) => t.side === side && t[key]).map((t) => t[key] as string);
  const days = Array.isArray(p.daysOfWeek) ? (p.daysOfWeek as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6) : null;
  return {
    id: p.id,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    badgeEn: p.badgeEn,
    badgeAr: p.badgeAr,
    descriptionEn: p.descriptionEn,
    descriptionAr: p.descriptionAr,
    type: p.type as PromotionTypeKey,
    channel: p.channel as PromotionChannelKey,
    isActive: p.isActive,
    startsAt: p.startsAt ? p.startsAt.toISOString() : null,
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
    daysOfWeek: days && days.length ? days : null,
    startTime: p.startTime,
    endTime: p.endTime,
    priority: p.priority,
    discountPercent: n(p.discountPercent),
    discountAmount: n(p.discountAmount),
    fixedPrice: n(p.fixedPrice),
    buyQuantity: p.buyQuantity,
    getQuantity: p.getQuantity,
    minSpend: n(p.minSpend),
    maxApplicationsPerOrder: p.maxApplicationsPerOrder,
    usageLimit: p.usageLimit,
    usedCount: p.usedCount,
    buyScope: p.buyScope as PromotionScopeKey,
    getScope: (p.getScope as PromotionScopeKey | null) ?? null,
    excludeSaleItems: p.excludeSaleItems,
    buyProductIds: ids("BUY", "productId"),
    buyCategoryIds: ids("BUY", "categoryId"),
    getProductIds: ids("GET", "productId"),
    getCategoryIds: ids("GET", "categoryId"),
  };
}

/**
 * Promotions that could apply now on a channel (switched on, within their
 * dates, not used up). Day-of-week / time-of-day windows are checked by the
 * engine at pricing time.
 */
export async function loadPromotionRules(channel: "ONLINE" | "POS"): Promise<PromotionRule[]> {
  const now = new Date();
  const rows = await prisma.promotion.findMany({
    where: {
      isActive: true,
      channel: { in: ["ALL", channel] },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    include: PROMOTION_INCLUDE,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(toPromotionRule).filter((r) => r.usageLimit == null || r.usedCount < r.usageLimit);
}

/** categoryId → [itself, parent, grandparent, …] */
export async function categoryAncestry(): Promise<Map<string, string[]>> {
  const cats = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const parent = new Map(cats.map((c) => [c.id, c.parentId]));
  const out = new Map<string, string[]>();
  for (const c of cats) {
    const chain: string[] = [];
    let cur: string | null | undefined = c.id;
    let guard = 0;
    while (cur && guard++ < 50) {
      chain.push(cur);
      cur = parent.get(cur);
    }
    out.set(c.id, chain);
  }
  return out;
}

/**
 * Books promotion usage for a new order (inside its transaction): one
 * redemption row per promotion, and bumps the usage counter.
 */
export async function recordPromotionRedemptions(
  tx: Prisma.TransactionClient,
  orderId: string,
  applied: { id: string; discount: number; units: number }[],
) {
  for (const a of applied) {
    if (a.discount <= 0) continue;
    await tx.promotionRedemption.create({ data: { promotionId: a.id, orderId, discount: a.discount, units: a.units } });
    await tx.promotion.update({ where: { id: a.id }, data: { usedCount: { increment: 1 } } });
  }
}
