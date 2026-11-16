import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { BUSINESS_TZ, addDays, businessDayEnd, businessDayStart, daysBetween, isDateKey, round3, toBusinessDateKey } from "@/lib/finance";

// Shared filters and SQL building blocks for the sales reports.
//
// Counting rules (identical to Finance & P/L so the numbers reconcile):
//  • A sale counts when it was paid (paymentStatus = PAID) or has been
//    (partly) refunded through a Refund — dated by the order's createdAt.
//  • Refunds are counted on their own date (Refund.createdAt) and reported
//    separately: net = gross − refunds.
//  • Gross = order total as charged (incl. VAT and delivery); VAT-exclusive
//    net = net − (VAT collected − VAT reversed by refunds).

export const ONLINE_SELLER = "__online";
export const UNKNOWN_SELLER = "__unknown";

export const SALE_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "CASH_ON_DELIVERY", "THAWANI", "STRIPE"] as const;
export const REFUND_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "STORE_CREDIT"] as const;
const ALL_METHODS = new Set<string>([...SALE_METHODS, ...REFUND_METHODS]);

export type Channel = "ALL" | "POS" | "ONLINE";

export type ReportFilters = {
  fromKey: string;
  toKey: string;
  from: Date;
  to: Date;
  channel: Channel;
  /** Cashier user id, ONLINE_SELLER, or null for everyone. */
  seller: string | null;
  /** Payment method (sales) / refund method (refunds), or null. */
  method: string | null;
  shiftId: string | null;
};

export function parseFilters(req: NextRequest, opts: { maxDays?: number; defaultDays?: number } = {}): ReportFilters | { error: string } {
  const sp = req.nextUrl.searchParams;
  const todayKey = toBusinessDateKey(new Date());
  const toKey = isDateKey(sp.get("to")) ? sp.get("to")! : todayKey;
  const fromKey = isDateKey(sp.get("from")) ? sp.get("from")! : addDays(toKey, -((opts.defaultDays ?? 30) - 1));
  if (fromKey > toKey) return { error: "'From' must be on or before 'To'." };
  if (daysBetween(fromKey, toKey) > (opts.maxDays ?? 366 * 3)) return { error: "That date range is too long for this report." };
  const channelRaw = (sp.get("channel") || "ALL").toUpperCase();
  const channel: Channel = channelRaw === "POS" || channelRaw === "ONLINE" ? channelRaw : "ALL";
  const method = sp.get("method");
  return {
    fromKey,
    toKey,
    from: businessDayStart(fromKey),
    to: businessDayEnd(toKey),
    channel,
    seller: sp.get("seller") || null,
    method: method && ALL_METHODS.has(method) ? method : null,
    shiftId: sp.get("shift") || null,
  };
}

/** Converts a stored (UTC) timestamp column to shop-local time in SQL. */
export const localTs = (col: string) => Prisma.raw(`((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${BUSINESS_TZ}')`);
export const localDay = (col: string) => Prisma.sql`to_char(${localTs(col)}, 'YYYY-MM-DD')`;

export const COUNTED_SALE = Prisma.sql`(o."paymentStatus" = 'PAID' OR o."refundedAmount" > 0)`;

/** WHERE clause for counted sales (alias `o` = orders). */
export function saleWhere(f: ReportFilters, opts: { ignoreMethod?: boolean } = {}): Prisma.Sql {
  const parts: Prisma.Sql[] = [COUNTED_SALE, Prisma.sql`o."createdAt" BETWEEN ${f.from} AND ${f.to}`];
  if (f.channel !== "ALL") parts.push(Prisma.sql`o.source::text = ${f.channel}`);
  if (f.seller === ONLINE_SELLER) parts.push(Prisma.sql`o.source::text = 'ONLINE'`);
  else if (f.seller === UNKNOWN_SELLER) parts.push(Prisma.sql`(o.source::text = 'POS' AND o."cashierId" IS NULL)`);
  else if (f.seller) parts.push(Prisma.sql`o."cashierId" = ${f.seller}`);
  if (f.method && !opts.ignoreMethod) {
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM payments px WHERE px."orderId" = o.id AND px.method::text = ${f.method})`);
  }
  if (f.shiftId) parts.push(Prisma.sql`o."posShiftId" = ${f.shiftId}`);
  return Prisma.join(parts, " AND ");
}

/** WHERE clause for refunds in the period (alias `r` = refunds joined to `o` = its order). */
export function refundWhere(f: ReportFilters, opts: { ignoreMethod?: boolean } = {}): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`r."createdAt" BETWEEN ${f.from} AND ${f.to}`];
  if (f.channel !== "ALL") parts.push(Prisma.sql`o.source::text = ${f.channel}`);
  if (f.seller === ONLINE_SELLER) parts.push(Prisma.sql`o.source::text = 'ONLINE'`);
  else if (f.seller === UNKNOWN_SELLER) parts.push(Prisma.sql`r."createdBy" IS NULL`);
  else if (f.seller) parts.push(Prisma.sql`r."createdBy" = ${f.seller}`);
  if (f.method && !opts.ignoreMethod) parts.push(Prisma.sql`r.method = ${f.method}`);
  if (f.shiftId) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM pos_shifts s
      WHERE s.id = ${f.shiftId} AND r."createdBy" = s."cashierId"
        AND r."createdAt" >= s."openedAt" AND r."createdAt" <= COALESCE(s."closedAt", NOW()))`);
  }
  return Prisma.join(parts, " AND ");
}

/**
 * CTE `so`: one row per counted sale with its money fields, item count and
 * local day/hour. Prefix a query with it: Prisma.sql`${salesCte(f)} SELECT … FROM so`.
 */
export function salesCte(f: ReportFilters, opts: { ignoreMethod?: boolean } = {}): Prisma.Sql {
  return Prisma.sql`WITH so AS (
    SELECT o.id, o.source::text AS source, o."cashierId", o."createdAt", o."posShiftId",
           o.subtotal, o.discount, o."promotionDiscount", o."shippingCost", o."taxTotal", o.total, o."refundedAmount",
           (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi."orderId" = o.id)::int AS items,
           ${localDay(`o."createdAt"`)} AS day,
           EXTRACT(HOUR FROM ${localTs(`o."createdAt"`)})::int AS hour
    FROM orders o
    WHERE ${saleWhere(f, opts)}
  )`;
}

/** Standard money aggregates over `so`. */
export const SALE_AGGREGATES = Prisma.sql`
  COUNT(*)::int AS orders,
  COALESCE(SUM(so.items), 0)::int AS items,
  COALESCE(SUM(so.subtotal), 0) AS subtotal,
  COALESCE(SUM(so."promotionDiscount"), 0) AS offers,
  COALESCE(SUM(so.discount - so."promotionDiscount"), 0) AS discounts,
  COALESCE(SUM(so."shippingCost"), 0) AS shipping,
  COALESCE(SUM(so."taxTotal"), 0) AS vat,
  COALESCE(SUM(so.total), 0) AS gross`;

export type SaleAggRow = {
  orders: number;
  items: number;
  subtotal: unknown;
  offers: unknown;
  discounts: unknown;
  shipping: unknown;
  vat: unknown;
  gross: unknown;
};

/** Payments that settled counted sales (POS split payments are several rows). */
export const PAID_PAYMENT = Prisma.sql`p.status::text IN ('PAID', 'REFUNDED')`;

export const num = (v: unknown) => (v == null ? 0 : Number(v));

export type SalesFigures = {
  orders: number;
  items: number;
  subtotal: number;
  offers: number;
  discounts: number;
  shipping: number;
  vat: number;
  gross: number;
  refundCount: number;
  refunds: number;
  refundVat: number;
  net: number;
  netExVat: number;
  avgTicket: number;
};

/** Combines a sales aggregate row with refund figures into the standard set. */
export function figures(s: Partial<SaleAggRow> | undefined, refunds: { count?: number; amount?: unknown; vat?: unknown } = {}): SalesFigures {
  const orders = s?.orders ?? 0;
  const gross = num(s?.gross);
  const vat = num(s?.vat);
  const refundAmt = num(refunds.amount);
  const refundVat = num(refunds.vat);
  const net = gross - refundAmt;
  return {
    orders,
    items: s?.items ?? 0,
    subtotal: round3(num(s?.subtotal)),
    offers: round3(num(s?.offers)),
    discounts: round3(num(s?.discounts)),
    shipping: round3(num(s?.shipping)),
    vat: round3(vat),
    gross: round3(gross),
    refundCount: refunds.count ?? 0,
    refunds: round3(refundAmt),
    refundVat: round3(refundVat),
    net: round3(net),
    netExVat: round3(net - (vat - refundVat)),
    avgTicket: orders > 0 ? round3(gross / orders) : 0,
  };
}
