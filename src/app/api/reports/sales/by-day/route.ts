import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { enumerateBuckets, round3 } from "@/lib/finance";
import { PAID_PAYMENT, SALE_AGGREGATES, figures, localDay, num, parseFilters, refundWhere, salesCte, type SaleAggRow } from "../shared";

/** One row per business day: sales, offers, discounts, VAT, refunds, net and how it was paid. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req, { maxDays: 400 });
    if ("error" in f) return error(f.error);

    const cte = salesCte(f);
    const [sales, refunds, payments] = await Promise.all([
      prisma.$queryRaw<(SaleAggRow & { day: string; pos: unknown; online: unknown })[]>`
        ${cte}
        SELECT so.day, ${SALE_AGGREGATES},
               COALESCE(SUM(CASE WHEN so.source = 'POS' THEN so.total ELSE 0 END), 0) AS pos,
               COALESCE(SUM(CASE WHEN so.source = 'ONLINE' THEN so.total ELSE 0 END), 0) AS online
        FROM so GROUP BY so.day`,
      prisma.$queryRaw<{ day: string; count: number; amount: unknown; vat: unknown }[]>`
        SELECT ${localDay(`r."createdAt"`)} AS day, COUNT(*)::int AS count,
               COALESCE(SUM(r.amount), 0) AS amount, COALESCE(SUM(r."taxAmount"), 0) AS vat
        FROM refunds r JOIN orders o ON o.id = r."orderId"
        WHERE ${refundWhere(f)} GROUP BY 1`,
      prisma.$queryRaw<{ day: string; method: string; amount: unknown }[]>`
        ${cte}
        SELECT so.day, p.method::text AS method, COALESCE(SUM(p.amount), 0) AS amount
        FROM payments p JOIN so ON so.id = p."orderId"
        WHERE ${PAID_PAYMENT}
        GROUP BY 1, 2`,
    ]);

    const salesBy = new Map(sales.map((s) => [s.day, s]));
    const refundsBy = new Map(refunds.map((r) => [r.day, r]));
    const pay = new Map<string, { cash: number; card: number; other: number }>();
    for (const p of payments) {
      const b = pay.get(p.day) ?? { cash: 0, card: 0, other: 0 };
      if (p.method === "CASH") b.cash += num(p.amount);
      else if (p.method === "CARD") b.card += num(p.amount);
      else b.other += num(p.amount);
      pay.set(p.day, b);
    }

    const rows = enumerateBuckets(f.fromKey, f.toKey, "day").map((day) => {
      const s = salesBy.get(day);
      const r = refundsBy.get(day);
      const p = pay.get(day) ?? { cash: 0, card: 0, other: 0 };
      return {
        day,
        ...figures(s, r ?? {}),
        pos: round3(num(s?.pos)),
        online: round3(num(s?.online)),
        cash: round3(p.cash),
        card: round3(p.card),
        other: round3(p.other),
      };
    });

    const sum = (k: keyof (typeof rows)[number]) => round3(rows.reduce((t, r) => t + (Number(r[k]) || 0), 0));
    const orders = rows.reduce((t, r) => t + r.orders, 0);
    const gross = sum("gross");
    const totals = {
      orders,
      items: rows.reduce((t, r) => t + r.items, 0),
      subtotal: sum("subtotal"),
      offers: sum("offers"),
      discounts: sum("discounts"),
      shipping: sum("shipping"),
      vat: sum("vat"),
      gross,
      refundCount: rows.reduce((t, r) => t + r.refundCount, 0),
      refunds: sum("refunds"),
      refundVat: sum("refundVat"),
      net: sum("net"),
      netExVat: sum("netExVat"),
      avgTicket: orders > 0 ? round3(gross / orders) : 0,
      pos: sum("pos"),
      online: sum("online"),
      cash: sum("cash"),
      card: sum("card"),
      other: sum("other"),
      activeDays: rows.filter((r) => r.orders > 0 || r.refundCount > 0).length,
    };

    return ok({ range: { from: f.fromKey, to: f.toKey }, rows, totals });
  } catch (e) {
    return serverError(e);
  }
}
