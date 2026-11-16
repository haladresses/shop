// Pure end-to-end sale pricing: promotions first, then the manual/coupon
// discount, then VAT. Used by the server (orderPricing.ts) and by the POS
// and checkout UIs, so the number on screen is the number that gets charged.

import { applyPromotions, type AppliedPromotion, type PromoHint, type PromoLineInput, type PromotionRule } from "@/lib/promotionEngine";
import { calculateSaleTax, r3, type RateInfo, type TaxBreakdownRow, type TaxSettings } from "@/lib/taxCalc";

export type SaleLineInput = PromoLineInput & { tax: RateInfo };

export type SaleLineResult = {
  /** unitPrice × quantity. */
  shelf: number;
  promotionDiscount: number;
  /** Promotion + share of the manual discount. */
  discount: number;
  taxable: number;
  tax: number;
  /** What the customer pays for this line. */
  gross: number;
};

export type SalePricing = {
  lines: SaleLineResult[];
  /** Σ shelf amounts. */
  subtotal: number;
  promotionDiscount: number;
  manualDiscount: number;
  /** promotionDiscount + manualDiscount. */
  discount: number;
  shipping: number;
  shippingTax: number;
  taxableTotal: number;
  taxTotal: number;
  total: number;
  breakdown: TaxBreakdownRow[];
  pricesIncludeTax: boolean;
  vatEnabled: boolean;
  appliedPromotions: AppliedPromotion[];
  hints: PromoHint[];
};

export function priceSale(input: {
  lines: SaleLineInput[];
  promotions: PromotionRule[];
  channel: "ONLINE" | "POS";
  now?: Date;
  /** Extra discount on top of promotions (POS manual discount / coupon). */
  manualDiscount?: number;
  shipping?: number;
  shippingTax?: RateInfo | null;
  settings: Pick<TaxSettings, "enabled" | "pricesIncludeTax">;
}): SalePricing {
  const promo = applyPromotions(input.lines, input.promotions, input.channel, input.now ?? new Date());
  const shelves = input.lines.map((l) => r3(Math.max(0, l.unitPrice) * Math.max(0, l.quantity)));
  const tax = calculateSaleTax({
    lines: input.lines.map((l, i) => ({ amount: r3(shelves[i] - promo.lineDiscounts[i]), tax: l.tax })),
    discount: input.manualDiscount ?? 0,
    shipping: input.shipping ?? 0,
    shippingTax: input.shippingTax ?? null,
    settings: input.settings,
  });
  const subtotal = r3(shelves.reduce((s, a) => s + a, 0));
  return {
    lines: input.lines.map((_, i) => ({
      shelf: shelves[i],
      promotionDiscount: promo.lineDiscounts[i],
      discount: r3(promo.lineDiscounts[i] + tax.lines[i].discount),
      taxable: tax.lines[i].taxable,
      tax: tax.lines[i].tax,
      gross: tax.lines[i].gross,
    })),
    subtotal,
    promotionDiscount: promo.total,
    manualDiscount: tax.discount,
    discount: r3(promo.total + tax.discount),
    shipping: tax.shipping,
    shippingTax: tax.shippingTax,
    taxableTotal: tax.taxableTotal,
    taxTotal: tax.taxTotal,
    total: tax.total,
    breakdown: tax.breakdown,
    pricesIncludeTax: tax.pricesIncludeTax,
    vatEnabled: tax.enabled,
    appliedPromotions: promo.applied,
    hints: promo.hints,
  };
}
