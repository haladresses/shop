import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { round3 } from "@/lib/finance";
import { num, refundLinesCte, salesCte, type ReportFilters } from "./shared";

// Per-product (or per colour/size option) sales figures, shared by the
// by-product and by-category reports so both always agree.
//
//  • Sold figures come from the order lines of counted sales in the period.
//  • Net excl. VAT uses each line's taxableAmount (what VAT was charged on,
//    after offers and the order discount). Lines from before VAT tracking
//    fall back to line total less its share of the order discount.
//  • Returns come from the refunds made in the period (their own date):
//    quantity, money back (incl. VAT) and the cost that went back to stock
//    (damaged returns bring no cost back, so they stay a loss).
//  • Cost = Σ quantity × cost at the time of sale (falling back to the
//    product's current purchase price), less the cost of restocked returns.

export type ProductStatRow = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  sku: string | null;
  variantLabel: string;
  categoryId: string | null;
  categoryName: string;
  orders: number;
  qty: number;
  returnedQty: number;
  netQty: number;
  /** Σ line totals at shelf price (before offers / discounts). */
  gross: number;
  offers: number;
  discounts: number;
  vat: number;
  /** Sold, excl. VAT, after offers and discounts. */
  netSales: number;
  /** Money refunded for returns in the period (incl. VAT). */
  refunds: number;
  refundVat: number;
  /** netSales − refunds excl. VAT. */
  netExVat: number;
  cost: number;
  profit: number;
  /** % of netExVat. */
  margin: number;
  /** % of the report's total netExVat. */
  share: number;
  /** Average paid per unit sold (incl. VAT). */
  avgPrice: number;
  /** Units on hand now (null = product without stock tracking). */
  stock: number | null;
  /** All sold lines had a purchase price. */
  hasCost: boolean;
};

type SalesAgg = {
  productId: string;
  variantId: string | null;
  orders: number;
  qty: number;
  gross: unknown;
  offers: unknown;
  discounts: unknown;
  vat: unknown;
  net: unknown;
  cost: unknown;
  hasCost: boolean;
};

type RefundAgg = { productId: string; variantId: string | null; qty: unknown; amount: unknown; tax: unknown; cost: unknown };

export async function productStats(
  f: ReportFilters,
  opts: { perVariant?: boolean; categoryIds?: string[] | null; search?: string } = {},
): Promise<ProductStatRow[]> {
  const perVariant = !!opts.perVariant;
  const cte = salesCte(f);
  const variantSales = perVariant ? Prisma.sql`oi."variantId"` : Prisma.sql`NULL::text`;
  const variantRefund = perVariant ? Prisma.sql`rl."variantId"` : Prisma.sql`NULL::text`;

  const conds: Prisma.Sql[] = [];
  if (opts.categoryIds && opts.categoryIds.length) conds.push(Prisma.sql`p."categoryId" IN (${Prisma.join(opts.categoryIds)})`);
  if (opts.search) {
    const like = `%${opts.search}%`;
    conds.push(Prisma.sql`(p."nameEn" ILIKE ${like} OR p."nameAr" ILIKE ${like} OR p.sku ILIKE ${like})`);
  }
  const productWhere = conds.length ? Prisma.join(conds, " AND ") : Prisma.sql`TRUE`;
  // Order discount share for lines recorded before per-line discounts existed.
  const legacyDiscount = Prisma.sql`COALESCE(oi.total * so.discount / NULLIF(so.subtotal, 0), 0)`;

  const [sales, refunds] = await Promise.all([
    prisma.$queryRaw<SalesAgg[]>`
      ${cte}
      SELECT oi."productId" AS "productId", ${variantSales} AS "variantId",
             COUNT(DISTINCT oi."orderId")::int AS orders,
             COALESCE(SUM(oi.quantity), 0)::int AS qty,
             COALESCE(SUM(oi.total), 0) AS gross,
             COALESCE(SUM(oi."promotionDiscount"), 0) AS offers,
             COALESCE(SUM(CASE WHEN oi."taxableAmount" IS NULL THEN ${legacyDiscount}
                               ELSE oi."discountAmount" - oi."promotionDiscount" END), 0) AS discounts,
             COALESCE(SUM(oi."taxAmount"), 0) AS vat,
             COALESCE(SUM(CASE WHEN oi."taxableAmount" IS NULL THEN oi.total - ${legacyDiscount}
                               ELSE oi."taxableAmount" END), 0) AS net,
             COALESCE(SUM(oi.quantity * COALESCE(oi."unitCost", p."costPrice", 0)), 0) AS cost,
             BOOL_AND(oi."unitCost" IS NOT NULL OR p."costPrice" IS NOT NULL) AS "hasCost"
      FROM order_items oi
      JOIN so ON so.id = oi."orderId"
      JOIN products p ON p.id = oi."productId"
      WHERE ${productWhere}
      GROUP BY 1, 2`,
    prisma.$queryRaw<RefundAgg[]>`
      WITH ${refundLinesCte(f)}
      SELECT rl."productId" AS "productId", ${variantRefund} AS "variantId",
             COALESCE(SUM(rl.qty), 0) AS qty, COALESCE(SUM(rl.amount), 0) AS amount,
             COALESCE(SUM(rl.tax), 0) AS tax, COALESCE(SUM(rl.cost), 0) AS cost
      FROM rl
      JOIN products p ON p.id = rl."productId"
      WHERE ${productWhere}
      GROUP BY 1, 2`,
  ]);

  const keyOf = (productId: string, variantId: string | null) => (perVariant ? `${productId}:${variantId ?? ""}` : productId);
  const keys = new Map<string, { productId: string; variantId: string | null }>();
  for (const r of [...sales, ...refunds]) keys.set(keyOf(r.productId, r.variantId), { productId: r.productId, variantId: r.variantId });
  if (keys.size === 0) return [];

  const productIds = Array.from(new Set(Array.from(keys.values()).map((k) => k.productId)));
  const variantIds = Array.from(new Set(Array.from(keys.values()).map((k) => k.variantId).filter((v): v is string => !!v)));
  const [products, variants, stock] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nameEn: true, nameAr: true, sku: true, categoryId: true, category: { select: { nameEn: true } } },
    }),
    variantIds.length
      ? prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, color: true, size: true, sku: true } })
      : Promise.resolve([]),
    prisma.$queryRaw<{ productId: string; variantId: string; qty: number }[]>`
      SELECT v."productId" AS "productId", v.id AS "variantId", COALESCE(i.quantity, 0)::int AS qty
      FROM product_variants v LEFT JOIN inventory i ON i."variantId" = v.id
      WHERE v."productId" IN (${Prisma.join(productIds)})`,
  ]);
  const productBy = new Map(products.map((p) => [p.id, p]));
  const variantBy = new Map(variants.map((v) => [v.id, v]));
  const stockByProduct = new Map<string, number>();
  const stockByVariant = new Map<string, number>();
  for (const s of stock) {
    stockByProduct.set(s.productId, (stockByProduct.get(s.productId) ?? 0) + s.qty);
    stockByVariant.set(s.variantId, s.qty);
  }
  const salesBy = new Map(sales.map((s) => [keyOf(s.productId, s.variantId), s]));
  const refundsBy = new Map(refunds.map((r) => [keyOf(r.productId, r.variantId), r]));

  const rows: ProductStatRow[] = Array.from(keys.entries()).map(([key, k]) => {
    const p = productBy.get(k.productId);
    const v = k.variantId ? variantBy.get(k.variantId) : undefined;
    const s = salesBy.get(key);
    const r = refundsBy.get(key);
    const qty = s?.qty ?? 0;
    const returnedQty = num(r?.qty);
    const netSales = num(s?.net);
    const vat = num(s?.vat);
    const refundAmt = num(r?.amount);
    const refundVat = num(r?.tax);
    const netExVat = netSales - (refundAmt - refundVat);
    const cost = num(s?.cost) - num(r?.cost);
    const profit = netExVat - cost;
    const variantLabel = perVariant
      ? k.variantId
        ? v
          ? [v.color, v.size].filter(Boolean).join(" / ") || "Standard"
          : "Option removed"
        : "Standard"
      : "";
    return {
      key,
      productId: k.productId,
      variantId: k.variantId,
      nameEn: p?.nameEn ?? "Deleted product",
      nameAr: p?.nameAr ?? "",
      sku: (perVariant && v?.sku) || p?.sku || null,
      variantLabel,
      categoryId: p?.categoryId ?? null,
      categoryName: p?.category?.nameEn ?? "—",
      orders: s?.orders ?? 0,
      qty,
      returnedQty,
      netQty: qty - returnedQty,
      gross: round3(num(s?.gross)),
      offers: round3(num(s?.offers)),
      discounts: round3(num(s?.discounts)),
      vat: round3(vat),
      netSales: round3(netSales),
      refunds: round3(refundAmt),
      refundVat: round3(refundVat),
      netExVat: round3(netExVat),
      cost: round3(cost),
      profit: round3(profit),
      margin: netExVat > 0 ? round3((profit / netExVat) * 100) : 0,
      share: 0,
      avgPrice: qty > 0 ? round3((netSales + vat) / qty) : 0,
      stock: perVariant
        ? k.variantId && stockByVariant.has(k.variantId)
          ? stockByVariant.get(k.variantId)!
          : null
        : stockByProduct.has(k.productId)
          ? stockByProduct.get(k.productId)!
          : null,
      hasCost: s ? !!s.hasCost : true,
    };
  });

  const totalNet = rows.reduce((t, r) => t + r.netExVat, 0);
  for (const r of rows) r.share = totalNet > 0 ? round3((r.netExVat / totalNet) * 100) : 0;
  rows.sort((a, b) => b.netExVat - a.netExVat || b.qty - a.qty);
  return rows;
}

export type StatTotals = Pick<
  ProductStatRow,
  "orders" | "qty" | "returnedQty" | "netQty" | "gross" | "offers" | "discounts" | "vat" | "netSales" | "refunds" | "refundVat" | "netExVat" | "cost" | "profit" | "margin"
>;

/** Column totals for a set of product rows (orders are not additive across products, so left out). */
export function statTotals(rows: Pick<ProductStatRow, keyof Omit<StatTotals, "margin" | "orders">>[]): Omit<StatTotals, "orders"> {
  const sum = (k: keyof Omit<StatTotals, "margin" | "orders">) => round3(rows.reduce((t, r) => t + Number(r[k] || 0), 0));
  const netExVat = sum("netExVat");
  const profit = sum("profit");
  return {
    qty: sum("qty"),
    returnedQty: sum("returnedQty"),
    netQty: sum("netQty"),
    gross: sum("gross"),
    offers: sum("offers"),
    discounts: sum("discounts"),
    vat: sum("vat"),
    netSales: sum("netSales"),
    refunds: sum("refunds"),
    refundVat: sum("refundVat"),
    netExVat,
    cost: sum("cost"),
    profit,
    margin: netExVat > 0 ? round3((profit / netExVat) * 100) : 0,
  };
}
