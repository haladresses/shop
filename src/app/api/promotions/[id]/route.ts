import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { addDays, toBusinessDateKey } from "@/lib/finance";
import { normalizePromotion, promotionInputSchema } from "@/lib/validations/promotion";
import {
  PROMOTION_ADMIN_INCLUDE,
  checkTargetsExist,
  pickerProduct,
  promotionData,
  promotionStats,
  promotionToInput,
  serializePromotion,
  targetRows,
} from "@/lib/promotionAdmin";

type Ctx = { params: Promise<{ id: string }> };

/** One promotion with its products/categories, stats, 30-day series and recent orders. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, ["admin.promotions.view", "admin.promotions.manage"]);
    if ("res" in g) return g.res;
    const { id } = await params;

    const p = await prisma.promotion.findUnique({ where: { id }, include: PROMOTION_ADMIN_INCLUDE });
    if (!p) return notFound("Promotion");

    const todayKey = toBusinessDateKey(new Date());
    const fromKey = addDays(todayKey, -29);
    const since = new Date(`${fromKey}T00:00:00.000+04:00`);

    const [stats, seriesRows, recent] = await Promise.all([
      promotionStats([id]),
      prisma.$queryRaw<{ day: string; orders: number; discount: unknown }[]>`
        SELECT to_char((pr."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Muscat', 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS orders,
               COALESCE(SUM(pr.discount), 0) AS discount
        FROM promotion_redemptions pr
        WHERE pr."promotionId" = ${id} AND pr."createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1`,
      prisma.promotionRedemption.findMany({
        where: { promotionId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          order: {
            select: { id: true, orderNumber: true, total: true, source: true, createdAt: true, guestName: true, user: { select: { nameEn: true } } },
          },
        },
      }),
    ]);

    const byDay = new Map(seriesRows.map((r) => [r.day, r]));
    const series = Array.from({ length: 30 }, (_, i) => {
      const day = addDays(fromKey, i);
      const r = byDay.get(day);
      return { day, orders: r?.orders ?? 0, discount: Math.round(Number(r?.discount ?? 0) * 1000) / 1000 };
    });

    const products = (side: string) =>
      p.targets.filter((t) => t.side === side && t.product).map((t) => pickerProduct(t.product!));
    const categories = (side: string) =>
      p.targets.filter((t) => t.side === side && t.category).map((t) => t.category!);

    return ok({
      ...serializePromotion(p, stats.get(id)),
      buyProducts: products("BUY"),
      getProducts: products("GET"),
      buyCategories: categories("BUY"),
      getCategories: categories("GET"),
      series,
      recent: recent.map((r) => ({
        id: r.id,
        discount: Number(r.discount),
        units: r.units,
        createdAt: r.createdAt.toISOString(),
        order: {
          id: r.order.id,
          orderNumber: r.order.orderNumber,
          total: Number(r.order.total),
          source: r.order.source,
          customer: r.order.user?.nameEn || r.order.guestName || "",
        },
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Partial update. The body is merged over the stored promotion and the whole
 * result re-validated, so a one-field change (e.g. { isActive: false } to
 * pause) can never leave the promotion in an invalid state. Any target lists
 * sent replace the stored ones.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, "admin.promotions.manage");
    if ("res" in g) return g.res;
    const { id } = await params;

    const existing = await prisma.promotion.findUnique({ where: { id }, include: PROMOTION_ADMIN_INCLUDE });
    if (!existing) return notFound("Promotion");

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return error("Invalid body");
    const parsed = promotionInputSchema.safeParse({ ...promotionToInput(existing), ...body });
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const n = normalizePromotion(parsed.data);
    const missing = await checkTargetsExist(n);
    if (missing) return error(missing);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
      return tx.promotion.update({
        where: { id },
        data: { ...promotionData(n), targets: { create: targetRows(n) } },
        include: PROMOTION_ADMIN_INCLUDE,
      });
    });
    const stats = await promotionStats([id]);
    return ok(serializePromotion(updated, stats.get(id)));
  } catch (e) {
    return serverError(e);
  }
}

/** Only a promotion that was never used can be deleted — used ones keep their history; pause them instead. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, "admin.promotions.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const p = await prisma.promotion.findUnique({ where: { id }, include: { _count: { select: { redemptions: true } } } });
    if (!p) return notFound("Promotion");
    if (p._count.redemptions > 0) {
      return error(
        `This promotion was used on ${p._count.redemptions} order(s), so it's kept for your reports. Pause it instead — it will stop applying straight away.`,
        409,
      );
    }
    await prisma.promotion.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
