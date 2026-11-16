// Pure purchase-order arithmetic, shared by the purchase API (source of
// truth) and the PO editor (live totals). No database access here.

import { allocate, r3 } from "@/lib/taxCalc";

export type PurchaseLineInput = {
  quantity: number;
  /** As entered — incl. VAT when pricesIncludeTax. */
  unitCost: number;
  /** Line discount in percent (0–100). */
  discountPct?: number;
  /** VAT percentage for this line (0 when VAT is off or exempt). */
  taxRate: number;
};

export type PurchaseLineCalc = {
  /** Line value in the entry basis after the line discount, before the order discount. */
  base: number;
  /** Excl. VAT, before the order discount (what `subtotal` adds up). */
  netBeforeDiscount: number;
  /** Share of the order discount (entry basis). */
  discount: number;
  /** Excl. VAT after all discounts. */
  net: number;
  tax: number;
  /** Share of freight + other charges. */
  charges: number;
  /** Per-unit cost that goes into stock value. */
  landedUnitCost: number;
};

export type PurchaseCalc = {
  lines: PurchaseLineCalc[];
  subtotal: number;
  discount: number;
  netTotal: number;
  taxTotal: number;
  shippingCost: number;
  otherCharges: number;
  total: number;
};

/**
 * Totals for a purchase order. The order discount is spread over the lines by
 * value and reduces their VAT; freight and other charges are VAT-exclusive
 * and are spread over the lines by net value into each unit's landed cost.
 * When the business can't reclaim input VAT (VAT disabled) the VAT paid is a
 * real cost and is folded into the landed cost too.
 */
export function calculatePurchase(input: {
  lines: PurchaseLineInput[];
  pricesIncludeTax: boolean;
  discount?: number;
  shippingCost?: number;
  otherCharges?: number;
  reclaimTax: boolean;
}): PurchaseCalc {
  const inclusive = input.pricesIncludeTax;
  const bases = input.lines.map((l) => {
    const pct = Math.min(Math.max(l.discountPct ?? 0, 0), 100);
    return r3(Math.max(0, l.quantity) * Math.max(0, l.unitCost) * (1 - pct / 100));
  });
  const baseSum = r3(bases.reduce((s, b) => s + b, 0));
  const discount = r3(Math.min(Math.max(input.discount ?? 0, 0), baseSum));
  const shares = allocate(discount, bases);
  const shippingCost = r3(Math.max(0, input.shippingCost ?? 0));
  const otherCharges = r3(Math.max(0, input.otherCharges ?? 0));

  const partial = input.lines.map((l, i) => {
    const rate = Math.max(0, l.taxRate);
    const netBeforeDiscount = inclusive ? r3(bases[i] / (1 + rate / 100)) : bases[i];
    const after = r3(bases[i] - shares[i]);
    const net = inclusive ? r3(after / (1 + rate / 100)) : after;
    const tax = inclusive ? r3(after - net) : r3((net * rate) / 100);
    return { base: bases[i], netBeforeDiscount, discount: shares[i], net, tax };
  });

  const chargeShares = allocate(r3(shippingCost + otherCharges), partial.map((p) => p.net));
  const lines: PurchaseLineCalc[] = partial.map((p, i) => {
    const qty = Math.max(0, input.lines[i].quantity);
    const cost = p.net + chargeShares[i] + (input.reclaimTax ? 0 : p.tax);
    return { ...p, charges: chargeShares[i], landedUnitCost: qty > 0 ? r3(cost / qty) : 0 };
  });

  const subtotal = r3(lines.reduce((s, l) => s + l.netBeforeDiscount, 0));
  const netTotal = r3(lines.reduce((s, l) => s + l.net, 0));
  const taxTotal = r3(lines.reduce((s, l) => s + l.tax, 0));
  return {
    lines,
    subtotal,
    discount,
    netTotal,
    taxTotal,
    shippingCost,
    otherCharges,
    total: r3(netTotal + taxTotal + shippingCost + otherCharges),
  };
}

export const PO_STATUS_LABEL: Record<string, { en: string; ar: string; badge: string }> = {
  DRAFT: { en: "Draft", ar: "مسودة", badge: "bg-slate-100 text-slate-600" },
  ORDERED: { en: "Ordered", ar: "تم الطلب", badge: "bg-blue-50 text-blue-700" },
  PARTIALLY_RECEIVED: { en: "Partly received", ar: "استلام جزئي", badge: "bg-amber-50 text-amber-700" },
  RECEIVED: { en: "Received", ar: "تم الاستلام", badge: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { en: "Cancelled", ar: "ملغي", badge: "bg-rose-50 text-rose-700" },
};

export const PAY_STATUS_LABEL: Record<string, { en: string; badge: string }> = {
  UNPAID: { en: "Unpaid", badge: "bg-rose-50 text-rose-700" },
  PARTIAL: { en: "Part paid", badge: "bg-amber-50 text-amber-700" },
  PAID: { en: "Paid", badge: "bg-emerald-50 text-emerald-700" },
  NONE: { en: "—", badge: "bg-slate-100 text-slate-500" },
};

export const SUPPLIER_PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"] as const;
export const SUPPLIER_PAYMENT_METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
};

export const TASK_TYPES = ["TASK", "CALL", "FOLLOW_UP", "PAYMENT", "DELIVERY", "MEETING"] as const;
export const TASK_TYPE_LABEL: Record<string, string> = {
  TASK: "Task",
  CALL: "Call",
  FOLLOW_UP: "Follow-up",
  PAYMENT: "Payment",
  DELIVERY: "Delivery",
  MEETING: "Meeting",
};
export const TASK_PRIORITY_LABEL: Record<string, { en: string; badge: string }> = {
  LOW: { en: "Low", badge: "bg-slate-100 text-slate-600" },
  NORMAL: { en: "Normal", badge: "bg-sky-50 text-sky-700" },
  HIGH: { en: "High", badge: "bg-amber-50 text-amber-700" },
  URGENT: { en: "Urgent", badge: "bg-rose-50 text-rose-700" },
};
