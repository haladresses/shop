import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { BUSINESS_TZ, addDays, businessDayEnd, businessDayStart, enumerateBuckets, round3, toBusinessDateKey } from "@/lib/finance";

const PAID = Prisma.sql`(o."paymentStatus" = 'PAID' OR o."refundedAmount" > 0)`;
const num = (v: unknown) => (v == null ? 0 : Number(v));

async function salesBetween(from: Date, to: Date) {
  const [r] = await prisma.$queryRaw<{ orders: number; gross: unknown; online: unknown; pos: unknown }[]>`
    SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.total),0) AS gross,
           COALESCE(SUM(CASE WHEN o.source='ONLINE' THEN o.total ELSE 0 END),0) AS online,
           COALESCE(SUM(CASE WHEN o.source='POS' THEN o.total ELSE 0 END),0) AS pos
    FROM orders o WHERE ${PAID} AND o."createdAt" BETWEEN ${from} AND ${to}`;
  const refunds = await prisma.refund.aggregate({ where: { createdAt: { gte: from, lte: to } }, _sum: { amount: true } });
  const net = num(r.gross) - num(refunds._sum.amount);
  return { orders: r.orders, sales: round3(net), online: round3(num(r.online)), pos: round3(num(r.pos)) };
}

/**
 * Admin dashboard: today vs yesterday, month-to-date vs the same days last
 * month (net of refunds), month profit, a 30-day sales series, things needing
 * attention, recent orders and best sellers. All periods are Oman business days.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.dashboard.view"))) return forbidden();

    const today = toBusinessDateKey(new Date());
    const yesterday = addDays(today, -1);
    const monthStartKey = `${today.slice(0, 8)}01`;
    const [y, m] = today.split("-").map(Number);
    const lastMonthStartKey = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    const lastMonthEndKey = addDays(monthStartKey, -1);
    // Same point in last month, for a fair month-to-date comparison.
    const dayOfMonth = Number(today.slice(8));
    const lastMonthSameDayKey = addDays(lastMonthStartKey, Math.min(dayOfMonth, Number(lastMonthEndKey.slice(8))) - 1);
    const from30 = addDays(today, -29);

    const now = new Date();
    const [todayS, yesterdayS, monthS, lastMonthS] = await Promise.all([
      salesBetween(businessDayStart(today), now),
      salesBetween(businessDayStart(yesterday), businessDayEnd(yesterday)),
      salesBetween(businessDayStart(monthStartKey), now),
      salesBetween(businessDayStart(lastMonthStartKey), businessDayEnd(lastMonthSameDayKey)),
    ]);

    const localTs = Prisma.raw(`((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE '${BUSINESS_TZ}')`);
    const [series, monthCost, monthExpenses, pending, toShip, unpaidTransfers, lowStock, outOfStock, openShifts, newCustomers, recentOrders, top] =
      await Promise.all([
        prisma.$queryRaw<{ day: string; sales: unknown; orders: number }[]>`
          SELECT to_char(date_trunc('day', ${localTs}), 'YYYY-MM-DD') AS day, SUM(o.total) AS sales, COUNT(*)::int AS orders
          FROM orders o WHERE ${PAID} AND o."createdAt" >= ${businessDayStart(from30)}
          GROUP BY 1`,
        prisma.$queryRaw<{ cost: unknown }[]>`
          SELECT COALESCE(SUM(oi.quantity * COALESCE(oi."unitCost", p."costPrice", 0)),0) AS cost
          FROM order_items oi JOIN orders o ON o.id = oi."orderId" JOIN products p ON p.id = oi."productId"
          WHERE ${PAID} AND o."createdAt" >= ${businessDayStart(monthStartKey)}`,
        prisma.expense.aggregate({ where: { date: { gte: businessDayStart(monthStartKey) } }, _sum: { amount: true } }),
        prisma.order.count({ where: { status: "PENDING" } }),
        prisma.order.count({ where: { status: { in: ["CONFIRMED", "PROCESSING"] }, source: "ONLINE" } }),
        prisma.order.count({
          where: { paymentStatus: "UNPAID", payments: { some: { method: "BANK_TRANSFER" } }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
        }),
        prisma.inventory.count({ where: { quantity: { gt: 0, lte: prisma.inventory.fields.lowStockAlert } } }),
        prisma.inventory.count({ where: { quantity: { lte: 0 } } }),
        prisma.posShift.findMany({ where: { status: "OPEN" }, select: { openedAt: true, cashier: { select: { nameEn: true } } } }),
        prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: businessDayStart(monthStartKey) } } }),
        prisma.order.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            paymentStatus: true,
            source: true,
            createdAt: true,
            guestName: true,
            user: { select: { nameEn: true, email: true } },
            _count: { select: { items: true } },
          },
        }),
        prisma.$queryRaw<{ productId: string; nameEn: string; qty: number; revenue: unknown; image: string | null }[]>`
          SELECT p.id AS "productId", p."nameEn", SUM(oi.quantity)::int AS qty, SUM(oi.total) AS revenue,
                 (SELECT url FROM product_images pi WHERE pi."productId" = p.id ORDER BY pi."isPrimary" DESC, pi."sortOrder" ASC LIMIT 1) AS image
          FROM order_items oi JOIN orders o ON o.id = oi."orderId" JOIN products p ON p.id = oi."productId"
          WHERE ${PAID} AND o."createdAt" >= ${businessDayStart(from30)}
          GROUP BY p.id ORDER BY qty DESC, revenue DESC LIMIT 6`,
      ]);

    const byDay = new Map(series.map((r) => [r.day, r]));
    const monthProfit = monthS.sales - num(monthCost[0]?.cost) - num(monthExpenses._sum.amount);

    return ok({
      today: todayS,
      yesterday: yesterdayS,
      month: monthS,
      lastMonthToDate: lastMonthS,
      monthProfit: round3(monthProfit),
      newCustomers,
      series: enumerateBuckets(from30, today, "day").map((d) => ({
        day: d,
        sales: round3(num(byDay.get(d)?.sales)),
        orders: byDay.get(d)?.orders ?? 0,
      })),
      attention: {
        pending,
        toShip,
        unpaidTransfers,
        lowStock,
        outOfStock,
        openShifts: openShifts.map((s) => ({ cashier: s.cashier.nameEn || "", openedAt: s.openedAt.toISOString() })),
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        status: o.status,
        paymentStatus: o.paymentStatus,
        source: o.source,
        createdAt: o.createdAt.toISOString(),
        customer: o.user?.nameEn || o.guestName || o.user?.email || "Guest",
        items: o._count.items,
      })),
      topProducts: top.map((t) => ({ ...t, revenue: round3(num(t.revenue)) })),
    });
  } catch (e) {
    return serverError(e);
  }
}
