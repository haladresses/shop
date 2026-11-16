import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { round3 } from "@/lib/finance";
import { PAID_PAYMENT, localDay, num, parseFilters, refundWhere, salesCte } from "../shared";

/**
 * Takings by payment method (sales by how they were paid, refunds by how the
 * money went back) plus a day × method matrix. A split POS payment counts
 * once per method. With a method filter only that method's money is shown.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req, { maxDays: 400 });
    if ("error" in f) return error(f.error);

    const cte = salesCte(f, { ignoreMethod: true });
    const payMethod = f.method ? Prisma.sql`AND p.method::text = ${f.method}` : Prisma.empty;
    const [payments, refunds, payDays, refundDays, [sales]] = await Promise.all([
      prisma.$queryRaw<{ method: string; transactions: number; orders: number; amount: unknown; pos: unknown; online: unknown }[]>`
        ${cte}
        SELECT p.method::text AS method, COUNT(*)::int AS transactions, COUNT(DISTINCT p."orderId")::int AS orders,
               COALESCE(SUM(p.amount), 0) AS amount,
               COALESCE(SUM(CASE WHEN so.source = 'POS' THEN p.amount ELSE 0 END), 0) AS pos,
               COALESCE(SUM(CASE WHEN so.source = 'ONLINE' THEN p.amount ELSE 0 END), 0) AS online
        FROM payments p JOIN so ON so.id = p."orderId"
        WHERE ${PAID_PAYMENT} ${payMethod}
        GROUP BY 1`,
      prisma.$queryRaw<{ method: string; count: number; amount: unknown; vat: unknown }[]>`
        SELECT r.method, COUNT(*)::int AS count, COALESCE(SUM(r.amount), 0) AS amount, COALESCE(SUM(r."taxAmount"), 0) AS vat
        FROM refunds r JOIN orders o ON o.id = r."orderId"
        WHERE ${refundWhere(f)} GROUP BY 1`,
      prisma.$queryRaw<{ day: string; method: string; amount: unknown }[]>`
        ${cte}
        SELECT so.day, p.method::text AS method, COALESCE(SUM(p.amount), 0) AS amount
        FROM payments p JOIN so ON so.id = p."orderId"
        WHERE ${PAID_PAYMENT} ${payMethod}
        GROUP BY 1, 2`,
      prisma.$queryRaw<{ day: string; amount: unknown }[]>`
        SELECT ${localDay(`r."createdAt"`)} AS day, COALESCE(SUM(r.amount), 0) AS amount
        FROM refunds r JOIN orders o ON o.id = r."orderId"
        WHERE ${refundWhere(f)} GROUP BY 1`,
      prisma.$queryRaw<{ orders: number; gross: unknown }[]>`${cte} SELECT COUNT(*)::int AS orders, COALESCE(SUM(so.total), 0) AS gross FROM so`,
    ]);

    const keys = Array.from(new Set([...payments.map((p) => p.method), ...refunds.map((r) => r.method)]));
    const paidTotal = payments.reduce((t, p) => t + num(p.amount), 0);
    const rows = keys
      .map((m) => {
        const p = payments.find((x) => x.method === m);
        const r = refunds.find((x) => x.method === m);
        const amount = num(p?.amount);
        const refundAmt = num(r?.amount);
        return {
          method: m,
          transactions: p?.transactions ?? 0,
          orders: p?.orders ?? 0,
          amount: round3(amount),
          pos: round3(num(p?.pos)),
          online: round3(num(p?.online)),
          avg: p?.transactions ? round3(amount / p.transactions) : 0,
          share: paidTotal > 0 ? round3((amount / paidTotal) * 100) : 0,
          refundCount: r?.count ?? 0,
          refunds: round3(refundAmt),
          net: round3(amount - refundAmt),
        };
      })
      .sort((a, b) => b.amount - a.amount || b.refunds - a.refunds);

    // Day × method matrix (only days with activity).
    const days = Array.from(new Set([...payDays.map((d) => d.day), ...refundDays.map((d) => d.day)])).sort();
    const matrixMethods = Array.from(new Set(payDays.map((d) => d.method))).sort((a, b) => {
      const ia = rows.findIndex((r) => r.method === a);
      const ib = rows.findIndex((r) => r.method === b);
      return ia - ib;
    });
    const matrix = days.map((day) => {
      const cells: Record<string, number> = {};
      let total = 0;
      for (const m of matrixMethods) {
        const v = num(payDays.find((d) => d.day === day && d.method === m)?.amount);
        cells[m] = round3(v);
        total += v;
      }
      const refundsAmt = num(refundDays.find((d) => d.day === day)?.amount);
      return { day, cells, total: round3(total), refunds: round3(refundsAmt), net: round3(total - refundsAmt) };
    });

    const gross = num(sales?.gross);
    return ok({
      range: { from: f.fromKey, to: f.toKey },
      rows,
      totals: {
        transactions: rows.reduce((t, r) => t + r.transactions, 0),
        amount: round3(paidTotal),
        pos: round3(rows.reduce((t, r) => t + r.pos, 0)),
        online: round3(rows.reduce((t, r) => t + r.online, 0)),
        refundCount: rows.reduce((t, r) => t + r.refundCount, 0),
        refunds: round3(rows.reduce((t, r) => t + r.refunds, 0)),
        net: round3(rows.reduce((t, r) => t + r.net, 0)),
      },
      grossSales: round3(gross),
      orders: sales?.orders ?? 0,
      // Paid sales with no payment record — keeps the table reconciled with gross sales.
      unrecorded: f.method ? 0 : Math.abs(gross - paidTotal) > 0.0005 ? round3(gross - paidTotal) : 0,
      matrix: { methods: matrixMethods, rows: matrix },
    });
  } catch (e) {
    return serverError(e);
  }
}
