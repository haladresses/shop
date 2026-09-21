import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";

type SourceKey = "ONLINE" | "POS";

// The shop's own timezone — fixed (Oman doesn't observe DST), so "today" and
// daily buckets mean the same thing regardless of the server's own timezone.
const BUSINESS_TZ_OFFSET = "+04:00";
const BUSINESS_TZ = "Asia/Muscat";

/** Formats a stored UTC instant as a YYYY-MM-DD calendar day in the shop's timezone. */
function toBusinessDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Sales report — revenue/order counts split by channel (online storefront vs
 * in-store POS), for a date range. Only counts orders that have actually
 * been paid (matches the revenue figure already shown on the Orders page).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["admin.orders.view", "seller.orders.view"]))) {
      return forbidden();
    }

    const sp = req.nextUrl.searchParams;
    const now = new Date();
    // Query dates are calendar days in the shop's own timezone, not the
    // server's — parsed with an explicit offset so this is correct no
    // matter where the app happens to be deployed.
    const toParam = sp.get("to");
    const fromParam = sp.get("from");
    const to = toParam ? new Date(`${toParam}T23:59:59.999${BUSINESS_TZ_OFFSET}`) : now;
    const from = fromParam
      ? new Date(`${fromParam}T00:00:00.000${BUSINESS_TZ_OFFSET}`)
      : (() => {
          // Default: a 30-day window ending on `to`'s business calendar day,
          // starting at business midnight (not just "30 days before this instant").
          const start = new Date(`${toBusinessDateKey(to)}T00:00:00.000${BUSINESS_TZ_OFFSET}`);
          start.setDate(start.getDate() - 29);
          return start;
        })();

    const orders = await prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: from, lte: to } },
      select: { total: true, source: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const bySource: Record<SourceKey, { revenue: number; orders: number }> = {
      ONLINE: { revenue: 0, orders: 0 },
      POS: { revenue: 0, orders: 0 },
    };
    const byDayMap = new Map<string, { onlineRevenue: number; posRevenue: number; onlineOrders: number; posOrders: number }>();

    for (const o of orders) {
      const source = (o.source as SourceKey) || "ONLINE";
      const amount = Number(o.total);
      bySource[source].revenue += amount;
      bySource[source].orders += 1;

      const day = toBusinessDateKey(o.createdAt);
      const bucket = byDayMap.get(day) || { onlineRevenue: 0, posRevenue: 0, onlineOrders: 0, posOrders: 0 };
      if (source === "POS") {
        bucket.posRevenue += amount;
        bucket.posOrders += 1;
      } else {
        bucket.onlineRevenue += amount;
        bucket.onlineOrders += 1;
      }
      byDayMap.set(day, bucket);
    }

    const totalRevenue = bySource.ONLINE.revenue + bySource.POS.revenue;
    const totalOrders = bySource.ONLINE.orders + bySource.POS.orders;

    const byDay = Array.from(byDayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return ok({
      range: { from: toBusinessDateKey(from), to: toBusinessDateKey(to) },
      totals: {
        revenue: totalRevenue,
        orders: totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      },
      bySource,
      byDay,
    });
  } catch (e) {
    return serverError(e);
  }
}
