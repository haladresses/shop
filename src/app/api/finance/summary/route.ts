import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  BUSINESS_TZ,
  GRANULARITIES,
  Granularity,
  addDays,
  bucketKey,
  businessDayEnd,
  businessDayStart,
  daysBetween,
  enumerateBuckets,
  isDateKey,
  round3,
  toBusinessDateKey,
} from "@/lib/finance";

// An order counts toward sales once it has been paid. Orders that were later
// (partly) returned through a Refund stay in gross sales and the refund is
// subtracted separately, so the numbers reconcile with the refunds ledger.
const PAID_ORDER = Prisma.sql`(o."paymentStatus" = 'PAID' OR o."refundedAmount" > 0)`;

const localTs = (col: string) =>
  Prisma.raw(`((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${BUSINESS_TZ}')`);

type Totals = {
  grossSales: number;
  discounts: number;
  shipping: number;
  refunds: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  expenses: number;
  netProfit: number;
  orders: number;
  itemsSold: number;
  avgOrderValue: number;
  onlineSales: number;
  posSales: number;
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Cost of the units a refund put back on the shelf (they're no longer COGS). */
function returnedCost(items: Prisma.JsonValue | null): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce<number>((s, it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    return s + num(o.quantity) * num(o.unitCost);
  }, 0);
}

async function computeTotals(from: Date, to: Date): Promise<Totals> {
  const [[sales], [cogsRow], refunds, expenseAgg] = await Promise.all([
    prisma.$queryRaw<
      { orders: number; gross: unknown; discount: unknown; shipping: unknown; online: unknown; pos: unknown }[]
    >`
      SELECT COUNT(*)::int AS orders,
             COALESCE(SUM(o.total), 0) AS gross,
             COALESCE(SUM(o.discount), 0) AS discount,
             COALESCE(SUM(o."shippingCost"), 0) AS shipping,
             COALESCE(SUM(CASE WHEN o.source = 'ONLINE' THEN o.total ELSE 0 END), 0) AS online,
             COALESCE(SUM(CASE WHEN o.source = 'POS' THEN o.total ELSE 0 END), 0) AS pos
      FROM orders o
      WHERE ${PAID_ORDER} AND o."createdAt" BETWEEN ${from} AND ${to}`,
    prisma.$queryRaw<{ cogs: unknown; items: number }[]>`
      SELECT COALESCE(SUM(oi.quantity * COALESCE(oi."unitCost", p."costPrice", 0)), 0) AS cogs,
             COALESCE(SUM(oi.quantity), 0)::int AS items
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      JOIN products p ON p.id = oi."productId"
      WHERE ${PAID_ORDER} AND o."createdAt" BETWEEN ${from} AND ${to}`,
    prisma.refund.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { amount: true, items: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
  ]);

  const refundTotal = refunds.reduce((s, r) => s + num(r.amount), 0);
  const refundedCost = refunds.reduce((s, r) => s + returnedCost(r.items), 0);

  const gross = num(sales.gross);
  const netSales = gross - refundTotal;
  const cogs = num(cogsRow.cogs) - refundedCost;
  const grossProfit = netSales - cogs;
  const expenses = num(expenseAgg._sum.amount);

  return {
    grossSales: round3(gross),
    discounts: round3(num(sales.discount)),
    shipping: round3(num(sales.shipping)),
    refunds: round3(refundTotal),
    netSales: round3(netSales),
    cogs: round3(cogs),
    grossProfit: round3(grossProfit),
    grossMargin: netSales > 0 ? round3((grossProfit / netSales) * 100) : 0,
    expenses: round3(expenses),
    netProfit: round3(grossProfit - expenses),
    orders: sales.orders,
    itemsSold: cogsRow.items,
    avgOrderValue: sales.orders > 0 ? round3(gross / sales.orders) : 0,
    onlineSales: round3(num(sales.online)),
    posSales: round3(num(sales.pos)),
  };
}

/**
 * Finance summary (profit & loss): totals, a per-period breakdown (daily /
 * weekly / monthly / yearly), comparison against the previous equal-length
 * period, and the top products, categories, payment methods and expense
 * categories. Profit uses each product's purchase price (costPrice), as
 * snapshotted on the order line at the time of sale.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.finance.view"))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const g = (sp.get("granularity") || "day") as Granularity;
    if (!GRANULARITIES.includes(g)) return error("Invalid granularity");

    const todayKey = toBusinessDateKey(new Date());
    const toKey = isDateKey(sp.get("to")) ? sp.get("to")! : todayKey;
    const fromKey = isDateKey(sp.get("from")) ? sp.get("from")! : addDays(toKey, -29);
    if (fromKey > toKey) return error("'from' must be before 'to'");
    if (daysBetween(fromKey, toKey) > 366 * 10) return error("Range too large");

    const from = businessDayStart(fromKey);
    const to = businessDayEnd(toKey);

    // Previous period of the same length, ending the day before `from`.
    const span = daysBetween(fromKey, toKey);
    const prevToKey = addDays(fromKey, -1);
    const prevFromKey = addDays(prevToKey, -span);

    const unit = Prisma.raw(`'${g}'`);
    const orderTs = localTs(`o."createdAt"`);

    const [
      totals,
      previous,
      salesBuckets,
      cogsBuckets,
      refunds,
      expenseBuckets,
      topProducts,
      topCategories,
      payments,
      expenseCats,
      missingCost,
    ] = await Promise.all([
      computeTotals(from, to),
      computeTotals(businessDayStart(prevFromKey), businessDayEnd(prevToKey)),
      prisma.$queryRaw<
        { bucket: string; orders: number; gross: unknown; discount: unknown; online: unknown; pos: unknown }[]
      >`
        SELECT to_char(date_trunc(${unit}, ${orderTs}), 'YYYY-MM-DD') AS bucket,
               COUNT(*)::int AS orders,
               SUM(o.total) AS gross,
               SUM(o.discount) AS discount,
               SUM(CASE WHEN o.source = 'ONLINE' THEN o.total ELSE 0 END) AS online,
               SUM(CASE WHEN o.source = 'POS' THEN o.total ELSE 0 END) AS pos
        FROM orders o
        WHERE ${PAID_ORDER} AND o."createdAt" BETWEEN ${from} AND ${to}
        GROUP BY 1`,
      prisma.$queryRaw<{ bucket: string; cogs: unknown; items: number }[]>`
        SELECT to_char(date_trunc(${unit}, ${orderTs}), 'YYYY-MM-DD') AS bucket,
               SUM(oi.quantity * COALESCE(oi."unitCost", p."costPrice", 0)) AS cogs,
               SUM(oi.quantity)::int AS items
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN products p ON p.id = oi."productId"
        WHERE ${PAID_ORDER} AND o."createdAt" BETWEEN ${from} AND ${to}
        GROUP BY 1`,
      prisma.refund.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { amount: true, items: true, createdAt: true },
      }),
      prisma.$queryRaw<{ bucket: string; amount: unknown }[]>`
        SELECT to_char(date_trunc(${unit}, ${localTs(`e.date`)}), 'YYYY-MM-DD') AS bucket,
               SUM(e.amount) AS amount
        FROM expenses e
        WHERE e.date BETWEEN ${from} AND ${to}
        GROUP BY 1`,
      prisma.$queryRaw<
        { productId: string; nameEn: string; nameAr: string; qty: number; revenue: unknown; cost: unknown; hasCost: boolean }[]
      >`
        SELECT p.id AS "productId", p."nameEn", p."nameAr",
               SUM(oi.quantity)::int AS qty,
               SUM(oi.total) AS revenue,
               SUM(oi.quantity * COALESCE(oi."unitCost", p."costPrice", 0)) AS cost,
               BOOL_AND(COALESCE(oi."unitCost", p."costPrice") IS NOT NULL) AS "hasCost"
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN products p ON p.id = oi."productId"
        WHERE ${PAID_ORDER} AND o."createdAt" BETWEEN ${from} AND ${to}
        GROUP BY p.id
        ORDER BY revenue DESC
        LIMIT 15`,
      prisma.$queryRaw<{ categoryId: string; nameEn: string; qty: number; revenue: unknown; cost: unknown }[]>`
        SELECT c.id AS "categoryId", c."nameEn",
               SUM(oi.quantity)::int AS qty,
               SUM(oi.total) AS revenue,
               SUM(oi.quantity * COALESCE(oi."unitCost", p."costPrice", 0)) AS cost
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN products p ON p.id = oi."productId"
        JOIN categories c ON c.id = p."categoryId"
        WHERE ${PAID_ORDER} AND o."createdAt" BETWEEN ${from} AND ${to}
        GROUP BY c.id
        ORDER BY revenue DESC
        LIMIT 8`,
      prisma.$queryRaw<{ method: string; amount: unknown; count: number }[]>`
        SELECT pm.method::text AS method, SUM(pm.amount) AS amount, COUNT(*)::int AS count
        FROM payments pm
        JOIN orders o ON o.id = pm."orderId"
        WHERE ${PAID_ORDER} AND pm.status = 'PAID' AND o."createdAt" BETWEEN ${from} AND ${to}
        GROUP BY pm.method
        ORDER BY amount DESC`,
      prisma.expense.groupBy({
        by: ["category"],
        where: { date: { gte: from, lte: to } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
      // Sold lines with no purchase price — their profit is overstated.
      prisma.$queryRaw<{ lines: number }[]>`
        SELECT COUNT(*)::int AS lines
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN products p ON p.id = oi."productId"
        WHERE ${PAID_ORDER} AND o."createdAt" BETWEEN ${from} AND ${to}
          AND oi."unitCost" IS NULL AND p."costPrice" IS NULL`,
    ]);

    // Merge everything into one continuous series of buckets.
    const keys = enumerateBuckets(fromKey, toKey, g);
    const series = new Map(
      keys.map((k) => [
        k,
        { bucket: k, orders: 0, grossSales: 0, discounts: 0, online: 0, pos: 0, refunds: 0, cogs: 0, items: 0, expenses: 0 },
      ]),
    );
    for (const r of salesBuckets) {
      const b = series.get(r.bucket);
      if (!b) continue;
      b.orders = r.orders;
      b.grossSales = num(r.gross);
      b.discounts = num(r.discount);
      b.online = num(r.online);
      b.pos = num(r.pos);
    }
    for (const r of cogsBuckets) {
      const b = series.get(r.bucket);
      if (!b) continue;
      b.cogs += num(r.cogs);
      b.items += r.items;
    }
    for (const r of refunds) {
      const b = series.get(bucketKey(toBusinessDateKey(r.createdAt), g));
      if (!b) continue;
      b.refunds += num(r.amount);
      b.cogs -= returnedCost(r.items);
    }
    for (const r of expenseBuckets) {
      const b = series.get(r.bucket);
      if (b) b.expenses = num(r.amount);
    }

    const breakdown = Array.from(series.values()).map((b) => {
      const netSales = b.grossSales - b.refunds;
      const grossProfit = netSales - b.cogs;
      return {
        bucket: b.bucket,
        orders: b.orders,
        itemsSold: b.items,
        grossSales: round3(b.grossSales),
        discounts: round3(b.discounts),
        refunds: round3(b.refunds),
        netSales: round3(netSales),
        onlineSales: round3(b.online),
        posSales: round3(b.pos),
        cogs: round3(b.cogs),
        grossProfit: round3(grossProfit),
        expenses: round3(b.expenses),
        netProfit: round3(grossProfit - b.expenses),
      };
    });

    return ok({
      range: { from: fromKey, to: toKey, granularity: g },
      previousRange: { from: prevFromKey, to: prevToKey },
      totals,
      previous,
      breakdown,
      linesMissingCost: missingCost[0]?.lines ?? 0,
      topProducts: topProducts.map((p) => {
        const revenue = num(p.revenue);
        const profit = revenue - num(p.cost);
        return {
          productId: p.productId,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          quantity: p.qty,
          revenue: round3(revenue),
          cost: round3(num(p.cost)),
          profit: round3(profit),
          margin: revenue > 0 ? round3((profit / revenue) * 100) : 0,
          hasCost: p.hasCost,
        };
      }),
      topCategories: topCategories.map((c) => ({
        categoryId: c.categoryId,
        name: c.nameEn,
        quantity: c.qty,
        revenue: round3(num(c.revenue)),
        profit: round3(num(c.revenue) - num(c.cost)),
      })),
      paymentMethods: payments.map((p) => ({ method: p.method, amount: round3(num(p.amount)), count: p.count })),
      expensesByCategory: expenseCats.map((e) => ({ category: e.category, amount: round3(num(e._sum.amount)) })),
    });
  } catch (e) {
    return serverError(e);
  }
}
