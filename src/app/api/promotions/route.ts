import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { isPromotionLive, type PromotionStatus } from "@/lib/promotionEngine";
import { normalizePromotion, promotionInputSchema } from "@/lib/validations/promotion";
import {
  PROMOTION_ADMIN_INCLUDE,
  checkTargetsExist,
  promotionData,
  promotionStats,
  serializePromotion,
  targetRows,
} from "@/lib/promotionAdmin";

const STATUSES: PromotionStatus[] = ["ACTIVE", "SCHEDULED", "PAUSED", "EXPIRED", "USED_UP"];
const TYPES = ["PERCENT_OFF", "AMOUNT_OFF", "FIXED_PRICE", "BUY_X_GET_Y", "MIX_AND_MATCH", "ORDER_THRESHOLD"] as const;
const CHANNELS = ["ALL", "ONLINE", "POS"] as const;

/**
 * Promotions list for the admin, with per-promotion performance and page KPIs.
 *   ?status=ACTIVE|SCHEDULED|PAUSED|EXPIRED|USED_UP  ?type=…  ?channel=…  ?search=…
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.promotions.view", "admin.promotions.manage"]);
    if ("res" in g) return g.res;

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") as PromotionStatus | null;
    const type = sp.get("type") || "";
    const channel = sp.get("channel") || "";
    const search = (sp.get("search") || "").trim();

    const rows = await prisma.promotion.findMany({
      where: {
        ...((TYPES as readonly string[]).includes(type) && { type: type as (typeof TYPES)[number] }),
        ...((CHANNELS as readonly string[]).includes(channel) && { channel: channel as (typeof CHANNELS)[number] }),
        ...(search && {
          OR: [
            { nameEn: { contains: search, mode: "insensitive" as const } },
            { nameAr: { contains: search } },
            { badgeEn: { contains: search, mode: "insensitive" as const } },
            { descriptionEn: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      },
      include: PROMOTION_ADMIN_INCLUDE,
      orderBy: [{ isActive: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    const stats = await promotionStats(rows.map((r) => r.id));
    const all = rows.map((r) => serializePromotion(r, stats.get(r.id)));

    const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((p) => p.status === s).length])) as Record<PromotionStatus, number>;
    const items = status && STATUSES.includes(status) ? all.filter((p) => p.status === status) : all;

    const since = new Date(Date.now() - 30 * 86400000);
    const [[last30]] = await Promise.all([
      prisma.$queryRaw<{ orders: number; discount: unknown; revenue: unknown }[]>`
        SELECT COUNT(*)::int AS orders,
               COALESCE(SUM(o."promotionDiscount"), 0) AS discount,
               COALESCE(SUM(o.total), 0) AS revenue
        FROM orders o
        WHERE o.id IN (SELECT DISTINCT pr."orderId" FROM promotion_redemptions pr WHERE pr."createdAt" >= ${since})`,
    ]);

    const now = new Date();
    return ok({
      items,
      counts: { ALL: all.length, ...counts },
      kpis: {
        active: counts.ACTIVE,
        // Running at this very moment (respects day-of-week / happy-hour windows).
        liveNow: all.filter((p) => isPromotionLive(p.rule, "ONLINE", now) || isPromotionLive(p.rule, "POS", now)).length,
        scheduled: counts.SCHEDULED,
        paused: counts.PAUSED,
        orders30d: last30?.orders ?? 0,
        discount30d: Math.round(Number(last30?.discount ?? 0) * 1000) / 1000,
        revenue30d: Math.round(Number(last30?.revenue ?? 0) * 1000) / 1000,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.promotions.manage");
    if ("res" in g) return g.res;

    const parsed = promotionInputSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const n = normalizePromotion(parsed.data);
    const missing = await checkTargetsExist(n);
    if (missing) return error(missing);

    const created = await prisma.promotion.create({
      data: {
        ...promotionData(n),
        createdBy: g.user.id,
        targets: { create: targetRows(n) },
      },
      include: PROMOTION_ADMIN_INCLUDE,
    });
    return ok(serializePromotion(created), 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return error("A selected product or category no longer exists.");
    }
    return serverError(e);
  }
}
