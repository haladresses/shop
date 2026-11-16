import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { round3 } from "@/lib/finance";
import { computeShiftSummary } from "@/lib/posShift";
import {
  ONLINE_SELLER,
  PAID_PAYMENT,
  SALE_AGGREGATES,
  UNKNOWN_SELLER,
  figures,
  num,
  parseFilters,
  refundWhere,
  salesCte,
  type SaleAggRow,
} from "../shared";

type RefundAgg = { count: number; amount: unknown; vat: unknown };

/**
 * Sales summary for a day (end-of-day report) or any short range: totals,
 * payment methods (with cash reconciliation), channels, salespeople, hours,
 * top products, offers used and the POS register shifts.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req, { maxDays: 92, defaultDays: 1 });
    if ("error" in f) return error(f.error);

    const cte = salesCte(f);
    const rw = refundWhere(f);
    const rwAnyMethod = refundWhere(f, { ignoreMethod: true });
    const methodFilter = f.method ? Prisma.sql`AND p.method::text = ${f.method}` : Prisma.empty;

    const [
      [totals],
      [refundTotals],
      byChannel,
      refundsByChannel,
      payments,
      refundsByMethod,
      bySeller,
      refundsBySeller,
      byHour,
      topProducts,
      promotions,
    ] = await Promise.all([
      prisma.$queryRaw<SaleAggRow[]>`${cte} SELECT ${SALE_AGGREGATES} FROM so`,
      prisma.$queryRaw<RefundAgg[]>`
        SELECT COUNT(*)::int AS count, COALESCE(SUM(r.amount), 0) AS amount, COALESCE(SUM(r."taxAmount"), 0) AS vat
        FROM refunds r JOIN orders o ON o.id = r."orderId" WHERE ${rw}`,
      prisma.$queryRaw<(SaleAggRow & { source: string })[]>`${cte} SELECT so.source, ${SALE_AGGREGATES} FROM so GROUP BY so.source ORDER BY so.source`,
      prisma.$queryRaw<(RefundAgg & { source: string })[]>`
        SELECT o.source::text AS source, COUNT(*)::int AS count, COALESCE(SUM(r.amount), 0) AS amount, COALESCE(SUM(r."taxAmount"), 0) AS vat
        FROM refunds r JOIN orders o ON o.id = r."orderId" WHERE ${rw} GROUP BY 1`,
      prisma.$queryRaw<{ method: string; transactions: number; orders: number; amount: unknown }[]>`
        ${cte}
        SELECT p.method::text AS method, COUNT(*)::int AS transactions, COUNT(DISTINCT p."orderId")::int AS orders, COALESCE(SUM(p.amount), 0) AS amount
        FROM payments p JOIN so ON so.id = p."orderId"
        WHERE ${PAID_PAYMENT} ${methodFilter}
        GROUP BY 1 ORDER BY amount DESC`,
      prisma.$queryRaw<(RefundAgg & { method: string })[]>`
        SELECT r.method, COUNT(*)::int AS count, COALESCE(SUM(r.amount), 0) AS amount, COALESCE(SUM(r."taxAmount"), 0) AS vat
        FROM refunds r JOIN orders o ON o.id = r."orderId" WHERE ${rwAnyMethod} ${f.method ? Prisma.sql`AND r.method = ${f.method}` : Prisma.empty}
        GROUP BY 1 ORDER BY amount DESC`,
      prisma.$queryRaw<(SaleAggRow & { source: string; cashierId: string | null; first: Date; last: Date })[]>`
        ${cte}
        SELECT so.source, so."cashierId", ${SALE_AGGREGATES}, MIN(so."createdAt") AS first, MAX(so."createdAt") AS last
        FROM so GROUP BY so.source, so."cashierId"`,
      prisma.$queryRaw<(RefundAgg & { createdBy: string | null })[]>`
        SELECT r."createdBy", COUNT(*)::int AS count, COALESCE(SUM(r.amount), 0) AS amount, COALESCE(SUM(r."taxAmount"), 0) AS vat
        FROM refunds r JOIN orders o ON o.id = r."orderId" WHERE ${rw} GROUP BY 1`,
      prisma.$queryRaw<{ hour: number; orders: number; items: number; gross: unknown; vat: unknown }[]>`
        ${cte}
        SELECT so.hour, COUNT(*)::int AS orders, COALESCE(SUM(so.items), 0)::int AS items, COALESCE(SUM(so.total), 0) AS gross, COALESCE(SUM(so."taxTotal"), 0) AS vat
        FROM so GROUP BY so.hour ORDER BY so.hour`,
      prisma.$queryRaw<{ productId: string; nameEn: string; nameAr: string; qty: number; shelf: unknown; paid: unknown }[]>`
        ${cte}
        SELECT p.id AS "productId", p."nameEn", p."nameAr", SUM(oi.quantity)::int AS qty,
               COALESCE(SUM(oi.total), 0) AS shelf,
               COALESCE(SUM(COALESCE(oi."taxableAmount" + oi."taxAmount", oi.total - oi."discountAmount")), 0) AS paid
        FROM order_items oi JOIN so ON so.id = oi."orderId" JOIN products p ON p.id = oi."productId"
        GROUP BY p.id ORDER BY paid DESC LIMIT 10`,
      prisma.$queryRaw<{ promotionId: string; nameEn: string; nameAr: string; uses: number; units: number; discount: unknown }[]>`
        ${cte}
        SELECT pr."promotionId", pm."nameEn", pm."nameAr", COUNT(*)::int AS uses, COALESCE(SUM(pr.units), 0)::int AS units, COALESCE(SUM(pr.discount), 0) AS discount
        FROM promotion_redemptions pr JOIN so ON so.id = pr."orderId" JOIN promotions pm ON pm.id = pr."promotionId"
        GROUP BY 1, 2, 3 ORDER BY discount DESC`,
    ]);

    // ── Payment methods: sales by payment method, refunds by refund method ──
    const methodKeys = new Set<string>([...payments.map((p) => p.method), ...refundsByMethod.map((r) => r.method)]);
    const byMethod = Array.from(methodKeys).map((m) => {
      const p = payments.find((x) => x.method === m);
      const r = refundsByMethod.find((x) => x.method === m);
      const amount = num(p?.amount);
      const refunds = num(r?.amount);
      return {
        method: m,
        transactions: p?.transactions ?? 0,
        orders: p?.orders ?? 0,
        amount: round3(amount),
        refundCount: r?.count ?? 0,
        refunds: round3(refunds),
        net: round3(amount - refunds),
      };
    });
    byMethod.sort((a, b) => b.amount - a.amount || b.refunds - a.refunds);
    const paymentsTotal = byMethod.reduce((s, m) => s + m.amount, 0);
    // Paid sales with no matching payment record (data gaps) — shown so the
    // payment table always adds up to gross sales.
    const unrecorded = f.method ? 0 : round3(num(totals?.gross) - paymentsTotal);

    const cashSales = byMethod.find((m) => m.method === "CASH")?.amount ?? 0;
    const cashRefunds = byMethod.find((m) => m.method === "CASH")?.refunds ?? 0;

    // ── Salespeople ──
    const sellerIds = new Set<string>();
    for (const s of bySeller) if (s.cashierId) sellerIds.add(s.cashierId);
    for (const r of refundsBySeller) if (r.createdBy) sellerIds.add(r.createdBy);
    const users = sellerIds.size
      ? await prisma.user.findMany({ where: { id: { in: Array.from(sellerIds) } }, select: { id: true, nameEn: true, nameAr: true, email: true } })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.nameEn || u.nameAr || u.email]));
    const sellerKey = (source: string, cashierId: string | null) => (source === "ONLINE" ? ONLINE_SELLER : cashierId ?? UNKNOWN_SELLER);
    const sellerName = (key: string) => (key === ONLINE_SELLER ? "Online store" : key === UNKNOWN_SELLER ? "Unassigned" : nameOf.get(key) ?? "Unknown user");
    const sellerMap = new Map<string, { sale?: (typeof bySeller)[number]; refund?: (typeof refundsBySeller)[number] }>();
    for (const s of bySeller) {
      const k = sellerKey(s.source, s.cashierId);
      const prev = sellerMap.get(k);
      // Several rows can fold into one key (e.g. online orders with a cashier) — merge.
      if (prev?.sale) {
        const a = prev.sale;
        prev.sale = {
          ...a,
          orders: a.orders + s.orders,
          items: a.items + s.items,
          subtotal: num(a.subtotal) + num(s.subtotal),
          offers: num(a.offers) + num(s.offers),
          discounts: num(a.discounts) + num(s.discounts),
          shipping: num(a.shipping) + num(s.shipping),
          vat: num(a.vat) + num(s.vat),
          gross: num(a.gross) + num(s.gross),
          first: a.first < s.first ? a.first : s.first,
          last: a.last > s.last ? a.last : s.last,
        };
      } else sellerMap.set(k, { ...prev, sale: s });
    }
    for (const r of refundsBySeller) {
      const k = r.createdBy ?? UNKNOWN_SELLER;
      sellerMap.set(k, { ...sellerMap.get(k), refund: r });
    }
    const grossTotal = num(totals?.gross);
    const sellers = Array.from(sellerMap.entries())
      .map(([key, v]) => ({
        sellerId: key,
        name: sellerName(key),
        ...figures(v.sale, v.refund ?? {}),
        share: grossTotal > 0 ? round3((num(v.sale?.gross) / grossTotal) * 100) : 0,
        firstSale: v.sale?.first ? new Date(v.sale.first).toISOString() : null,
        lastSale: v.sale?.last ? new Date(v.sale.last).toISOString() : null,
      }))
      .sort((a, b) => b.gross - a.gross || b.refunds - a.refunds);

    // ── POS register shifts that overlap the period ──
    const shiftRows =
      f.channel === "ONLINE"
        ? []
        : await prisma.posShift.findMany({
            where: {
              openedAt: { lte: f.to },
              OR: [{ closedAt: null }, { closedAt: { gte: f.from } }],
              ...(f.shiftId && { id: f.shiftId }),
              ...(f.seller && f.seller !== ONLINE_SELLER && f.seller !== UNKNOWN_SELLER && { cashierId: f.seller }),
            },
            select: { id: true },
            orderBy: { openedAt: "asc" },
            take: 60,
          });
    const shifts = (await Promise.all(shiftRows.map((s) => computeShiftSummary(s.id)))).filter((s): s is NonNullable<typeof s> => !!s);

    const channelRows = ["POS", "ONLINE"]
      .filter((c) => f.channel === "ALL" || f.channel === c)
      .map((c) => ({
        channel: c,
        ...figures(byChannel.find((x) => x.source === c), refundsByChannel.find((x) => x.source === c) ?? {}),
      }));

    return ok({
      range: { from: f.fromKey, to: f.toKey },
      generatedAt: new Date().toISOString(),
      totals: figures(totals, refundTotals ?? {}),
      byChannel: channelRows,
      byMethod,
      unrecorded: Math.abs(unrecorded) > 0.0005 ? unrecorded : 0,
      cash: { sales: round3(cashSales), refunds: round3(cashRefunds), net: round3(cashSales - cashRefunds) },
      bySeller: sellers,
      byHour: byHour.map((h) => ({ hour: h.hour, orders: h.orders, items: h.items, gross: round3(num(h.gross)), vat: round3(num(h.vat)) })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        qty: p.qty,
        shelf: round3(num(p.shelf)),
        paid: round3(num(p.paid)),
      })),
      promotions: promotions.map((p) => ({ promotionId: p.promotionId, nameEn: p.nameEn, nameAr: p.nameAr, uses: p.uses, units: p.units, discount: round3(num(p.discount)) })),
      refundsByMethod: refundsByMethod.map((r) => ({ method: r.method, count: r.count, amount: round3(num(r.amount)), vat: round3(num(r.vat)) })),
      shifts,
    });
  } catch (e) {
    return serverError(e);
  }
}
