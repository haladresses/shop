// Maps an order (as returned by the POS checkout, POS orders list or the
// admin order API) into the data a printed bill needs. Pure — used in the
// browser.

import type { TaxBreakdownRow, TaxSettings } from "@/lib/taxCalc";

export type StoreInfo = {
  store_name_en?: string;
  store_name_ar?: string;
  store_address?: string;
  store_phone?: string;
  store_email?: string;
};

export type InvoiceLine = {
  nameEn: string;
  nameAr: string;
  variant: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  /** quantity × unitPrice */
  shelf: number;
  /** promotions + share of the order discount */
  discount: number;
  promotionDiscount: number;
  taxRate: number;
  taxCode: string | null;
  /** Excl. VAT after discounts (null on orders from before VAT tracking). */
  taxable: number | null;
  tax: number;
  /** What the customer paid for the line. */
  gross: number;
};

export type InvoiceData = {
  kind: "invoice" | "credit-note";
  /** e.g. "Copy" / "Reprint" — printed under the title. */
  copyLabel?: string;
  invoiceNumber: string | null;
  orderNumber: string;
  createdAt: string;
  source: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  customerVatNumber?: string | null;
  customerAddress?: string;
  lines: InvoiceLine[];
  subtotal: number;
  promotionDiscount: number;
  /** Total discount (promotions + manual). */
  discount: number;
  shipping: number;
  shippingTax: number;
  taxTotal: number;
  total: number;
  pricesIncludeTax: boolean;
  breakdown: TaxBreakdownRow[];
  promotions: { nameEn: string; nameAr: string; discount: number }[];
  payments: { method: string; amount: number }[];
  amountTendered: number | null;
  changeGiven: number | null;
  paymentStatus?: string;
  refundedAmount?: number;
  notes?: string | null;
  creditNote?: {
    number: string | null;
    reason: string | null;
    method: string;
    restocked: boolean;
  };
};

export const METHOD_LABELS: Record<string, { en: string; ar: string }> = {
  CASH: { en: "Cash", ar: "نقداً" },
  CARD: { en: "Card", ar: "بطاقة" },
  BANK_TRANSFER: { en: "Bank transfer", ar: "تحويل بنكي" },
  STORE_CREDIT: { en: "Store credit", ar: "رصيد المتجر" },
  CASH_ON_DELIVERY: { en: "Cash on delivery", ar: "الدفع عند الاستلام" },
  THAWANI: { en: "Thawani", ar: "ثواني" },
  STRIPE: { en: "Card (online)", ar: "بطاقة (إلكتروني)" },
  CHEQUE: { en: "Cheque", ar: "شيك" },
  OTHER: { en: "Other", ar: "أخرى" },
};
export const methodLabels = (m: string) => METHOD_LABELS[m] ?? { en: m, ar: m };

const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const nn = (v: unknown) => (v == null || v === "" ? null : Number(v));

type AnyRecord = Record<string, unknown>;

function variantText(snap: AnyRecord, item: AnyRecord): string {
  const v = (item.variant ?? {}) as AnyRecord;
  const color = (snap.color ?? item.color ?? v.color) as string | null | undefined;
  const size = (snap.size ?? item.size ?? v.size) as string | null | undefined;
  const parts = (snap.colorParts ?? v.colorParts) as { part: string; color: string }[] | null | undefined;
  const colorText = color || (Array.isArray(parts) && parts.length ? parts.map((p) => `${p.part}: ${p.color}`).join(", ") : "");
  return [colorText, size].filter(Boolean).join(" / ");
}

/** Builds bill data from any order-shaped JSON object. */
export function orderToInvoice(order: AnyRecord, opts: { copyLabel?: string; cashierName?: string } = {}): InvoiceData {
  const items = (Array.isArray(order.items) ? order.items : []) as AnyRecord[];
  const addr = (order.shippingAddress ?? {}) as AnyRecord;
  const user = (order.user ?? null) as AnyRecord | null;
  const cashier = (order.cashier ?? null) as AnyRecord | null;
  const lines: InvoiceLine[] = items.map((it) => {
    const snap = (it.productSnapshot ?? {}) as AnyRecord;
    const product = (it.product ?? {}) as AnyRecord;
    const quantity = n(it.quantity);
    const unitPrice = n(it.unitPrice);
    const shelf = it.total != null ? n(it.total) : quantity * unitPrice;
    const taxable = nn(it.taxableAmount);
    const tax = n(it.taxAmount);
    const discount = n(it.discountAmount);
    return {
      nameEn: String(snap.nameEn ?? it.nameEn ?? product.nameEn ?? ""),
      nameAr: String(snap.nameAr ?? it.nameAr ?? product.nameAr ?? ""),
      variant: variantText(snap, it),
      sku: (snap.sku as string) ?? null,
      quantity,
      unitPrice,
      shelf,
      discount,
      promotionDiscount: n(it.promotionDiscount),
      taxRate: n(it.taxRate),
      taxCode: (it.taxCode as string) ?? null,
      taxable,
      tax,
      gross: taxable != null ? taxable + tax : shelf - discount,
    };
  });

  const breakdown = (Array.isArray(order.taxBreakdown) ? order.taxBreakdown : []) as TaxBreakdownRow[];
  const promos = (Array.isArray(order.appliedPromotions) ? order.appliedPromotions : []) as AnyRecord[];
  const payments = (Array.isArray(order.payments) ? order.payments : []) as AnyRecord[];

  const customerName =
    (order.customerName as string) ||
    (order.guestName as string) ||
    (user?.nameEn as string) ||
    (addr.nameEn as string) ||
    "";

  return {
    kind: "invoice",
    copyLabel: opts.copyLabel,
    invoiceNumber: (order.invoiceNumber as string) ?? null,
    orderNumber: String(order.orderNumber ?? ""),
    createdAt: String(order.createdAt ?? new Date().toISOString()),
    source: String(order.source ?? "POS"),
    cashierName: opts.cashierName || (order.cashierName as string) || (cashier?.nameEn as string) || undefined,
    customerName: customerName && customerName !== "Walk-in Customer" ? customerName : undefined,
    customerPhone: (addr.phone as string) || undefined,
    customerVatNumber: (order.customerVatNumber as string) ?? null,
    customerAddress:
      order.source === "ONLINE"
        ? [addr.street, addr.buildingNo, addr.area, addr.city].filter(Boolean).join(", ") || undefined
        : undefined,
    lines,
    subtotal: n(order.subtotal),
    promotionDiscount: n(order.promotionDiscount),
    discount: n(order.discount),
    shipping: n(order.shippingCost),
    shippingTax: n(order.shippingTax),
    taxTotal: n(order.taxTotal),
    total: n(order.total),
    pricesIncludeTax: order.pricesIncludeTax !== false,
    breakdown: breakdown.map((b) => ({ ...b, rate: n(b.rate), taxable: n(b.taxable), tax: n(b.tax) })),
    promotions: promos.map((p) => ({ nameEn: String(p.nameEn ?? ""), nameAr: String(p.nameAr ?? ""), discount: n(p.discount) })),
    payments: payments
      .filter((p) => p.status === undefined || p.status === "PAID" || order.source === "POS")
      .map((p) => ({ method: String(p.method), amount: n(p.amount) })),
    amountTendered: nn(order.amountTendered),
    changeGiven: nn(order.changeGiven),
    paymentStatus: (order.paymentStatus as string) ?? undefined,
    refundedAmount: n(order.refundedAmount),
    notes: (order.notes as string) ?? null,
  };
}

/** Bill data for a refund (credit note) against an order. */
export function refundToCreditNote(order: AnyRecord, refund: AnyRecord): InvoiceData {
  const base = orderToInvoice(order);
  const byId = new Map(((order.items ?? []) as AnyRecord[]).map((it, i) => [String(it.id), base.lines[i]]));
  const items = (Array.isArray(refund.items) ? refund.items : []) as AnyRecord[];
  const lines: InvoiceLine[] = items.map((ri) => {
    const src = byId.get(String(ri.orderItemId));
    const quantity = n(ri.quantity);
    const amount = ri.amount != null ? n(ri.amount) : quantity * n(ri.unitPrice);
    const tax = n(ri.tax);
    return {
      nameEn: src?.nameEn ?? "",
      nameAr: src?.nameAr ?? "",
      variant: src?.variant ?? "",
      sku: src?.sku ?? null,
      quantity,
      unitPrice: n(ri.unitPrice),
      shelf: quantity * n(ri.unitPrice),
      discount: Math.max(0, quantity * n(ri.unitPrice) - amount),
      promotionDiscount: 0,
      taxRate: src?.taxRate ?? 0,
      taxCode: src?.taxCode ?? null,
      taxable: amount - tax,
      tax,
      gross: amount,
    };
  });
  const total = n(refund.amount);
  const taxTotal = n(refund.taxAmount);
  const groups = new Map<string, TaxBreakdownRow>();
  for (const l of lines) {
    if (!l.tax && !l.taxRate) continue;
    const key = `${l.taxCode}|${l.taxRate}`;
    const src = base.breakdown.find((b) => b.code === l.taxCode && b.rate === l.taxRate);
    const g = groups.get(key) ?? {
      code: l.taxCode ?? "",
      nameEn: src?.nameEn ?? `VAT ${l.taxRate}%`,
      nameAr: src?.nameAr ?? `ضريبة ${l.taxRate}%`,
      rate: l.taxRate,
      type: src?.type ?? "STANDARD",
      taxable: 0,
      tax: 0,
    };
    g.taxable += l.taxable ?? 0;
    g.tax += l.tax;
    groups.set(key, g);
  }
  return {
    ...base,
    kind: "credit-note",
    createdAt: String(refund.createdAt ?? new Date().toISOString()),
    lines,
    subtotal: lines.reduce((s, l) => s + l.shelf, 0),
    promotionDiscount: 0,
    discount: lines.reduce((s, l) => s + l.discount, 0),
    shipping: 0,
    shippingTax: 0,
    taxTotal,
    total,
    breakdown: Array.from(groups.values()),
    promotions: [],
    payments: [{ method: String(refund.method ?? "CASH"), amount: total }],
    amountTendered: null,
    changeGiven: null,
    creditNote: {
      number: (refund.creditNoteNumber as string) ?? null,
      reason: (refund.reason as string) ?? null,
      method: String(refund.method ?? "CASH"),
      restocked: refund.restocked !== false,
    },
  };
}

/** Document title in both languages for this bill. */
export function invoiceTitle(d: InvoiceData, tax: Pick<TaxSettings, "enabled" | "vatNumber">, layout: "thermal" | "a4") {
  if (d.kind === "credit-note") {
    return tax.enabled ? { en: "Tax Credit Note", ar: "إشعار دائن ضريبي" } : { en: "Credit Note", ar: "إشعار دائن" };
  }
  const vat = tax.enabled && d.breakdown.length > 0;
  if (!vat) return layout === "thermal" ? { en: "Sales Receipt", ar: "إيصال بيع" } : { en: "Invoice", ar: "فاتورة" };
  if (layout === "thermal" && !d.customerVatNumber) return { en: "Simplified Tax Invoice", ar: "فاتورة ضريبية مبسطة" };
  return { en: "Tax Invoice", ar: "فاتورة ضريبية" };
}
