import { Prisma } from "@prisma/client";
import { round3 } from "@/lib/finance";
import { num } from "./shared";

// Line-level (product / category) figures shared by the by-product and
// by-category reports.

/** Aggregate columns over order lines `oi` (joined to `so` and products `p`). */
export const LINE_AGGREGATES = Prisma.sql`
  COALESCE(SUM(oi.quantity), 0)::int AS qty,
  COUNT(DISTINCT oi."orderId")::int AS orders,
  COALESCE(SUM(oi.total), 0) AS gross,
  COALESCE(SUM(oi."promotionDiscount"), 0) AS offers,
  COALESCE(SUM(oi."discountAmount" - oi."promotionDiscount"), 0) AS discounts,
  COALESCE(SUM(oi."taxAmount"), 0) AS vat,
  COALESCE(SUM(COALESCE(oi."taxableAmount", oi.total - oi."discountAmount")), 0) AS net,
  COALESCE(SUM(oi.quantity * COALESCE(oi."unitCost", p."costPrice", 0)), 0) AS cost,
  BOOL_AND(COALESCE(oi."unitCost", p."costPrice") IS NOT NULL) AS "hasCost"`;

/** Aggregate columns over refund lines `rl`. */
export const RETURN_AGGREGATES = Prisma.sql`
  COALESCE(SUM(rl.qty), 0)::int AS qty,
  COALESCE(SUM(rl.amount), 0) AS amount,
  COALESCE(SUM(rl.tax), 0) AS tax,
  COALESCE(SUM(rl.cost), 0) AS cost`;

export type LineAgg = {
  qty: number;
  orders: number;
  gross: unknown;
  offers: unknown;
  discounts: unknown;
  vat: unknown;
  net: unknown;
  cost: unknown;
  hasCost: boolean | null;
};
export type ReturnAgg = { qty: number; amount: unknown; tax: unknown; cost: unknown };

export type LineFigures = {
  qtySold: number;
  qtyReturned: number;
  netQty: number;
  orders: number;
  /** Σ shelf price × qty (before offers/discounts, as charged incl. VAT when prices include VAT). */
  gross: number;
  offers: number;
  discounts: number;
  vat: number;
  /** Sold, excl. VAT, after offers/discounts. */
  netExVat: number;
  /** Refunded to customers (incl. VAT) and excl. VAT. */
  refunds: number;
  refundsExVat: number;
  /** Cost of goods sold less cost of restocked returns. */
  cost: number;
  /** netExVat − refundsExVat − cost */
  profit: number;
  margin: number;
  avgPrice: number;
  hasCost: boolean;
};

export function lineFigures(s?: Partial<LineAgg> | null, r?: Partial<ReturnAgg> | null): LineFigures {
  const qtySold = s?.qty ?? 0;
  const qtyReturned = r?.qty ?? 0;
  const netExVat = num(s?.net);
  const vat = num(s?.vat);
  const refunds = num(r?.amount);
  const refundsExVat = refunds - num(r?.tax);
  const cost = num(s?.cost) - num(r?.cost);
  const revenue = netExVat - refundsExVat;
  const profit = revenue - cost;
  return {
    qtySold,
    qtyReturned,
    netQty: qtySold - qtyReturned,
    orders: s?.orders ?? 0,
    gross: round3(num(s?.gross)),
    offers: round3(num(s?.offers)),
    discounts: round3(num(s?.discounts)),
    vat: round3(vat),
    netExVat: round3(netExVat),
    refunds: round3(refunds),
    refundsExVat: round3(refundsExVat),
    cost: round3(cost),
    profit: round3(profit),
    margin: revenue > 0 ? round3((profit / revenue) * 100) : 0,
    avgPrice: qtySold > 0 ? round3((netExVat + vat) / qtySold) : 0,
    hasCost: s?.hasCost !== false,
  };
}

/** Adds two figure sets (for totals and category roll-ups). */
export function addFigures(a: LineFigures, b: LineFigures): LineFigures {
  const sum = (k: keyof LineFigures) => (Number(a[k]) || 0) + (Number(b[k]) || 0);
  const netExVat = sum("netExVat");
  const refundsExVat = sum("refundsExVat");
  const cost = sum("cost");
  const vat = sum("vat");
  const qtySold = sum("qtySold");
  const revenue = netExVat - refundsExVat;
  const profit = revenue - cost;
  return {
    qtySold,
    qtyReturned: sum("qtyReturned"),
    netQty: sum("netQty"),
    orders: sum("orders"),
    gross: round3(sum("gross")),
    offers: round3(sum("offers")),
    discounts: round3(sum("discounts")),
    vat: round3(vat),
    netExVat: round3(netExVat),
    refunds: round3(sum("refunds")),
    refundsExVat: round3(refundsExVat),
    cost: round3(cost),
    profit: round3(profit),
    margin: revenue > 0 ? round3((profit / revenue) * 100) : 0,
    avgPrice: qtySold > 0 ? round3((netExVat + vat) / qtySold) : 0,
    hasCost: a.hasCost && b.hasCost,
  };
}

export const EMPTY_FIGURES: LineFigures = lineFigures(null, null);
