import { NextRequest } from "next/server";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { round3 } from "@/lib/finance";
import { parseFilters, sellerBreakdown } from "../shared";

/**
 * One row per salesperson (POS cashier; online orders as "Online store"):
 * receipts, items, gross, offers, discounts, VAT, refunds they processed,
 * net, average ticket, share of sales and first/last sale.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req);
    if ("error" in f) return error(f.error);

    const { rows } = await sellerBreakdown(f);
    const sum = (k: "subtotal" | "offers" | "discounts" | "shipping" | "vat" | "gross" | "refunds" | "refundVat" | "net" | "netExVat") =>
      round3(rows.reduce((t, r) => t + r[k], 0));
    const orders = rows.reduce((t, r) => t + r.orders, 0);
    const gross = sum("gross");
    return ok({
      range: { from: f.fromKey, to: f.toKey },
      rows,
      totals: {
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
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
