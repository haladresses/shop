import { Prisma, type WaselleeBranch } from "@prisma/client";
import prisma from "@/lib/db";
import { getDefaultTaxRate, getTaxSettings, resolveProductTaxRates } from "@/lib/tax";
import { NO_TAX, r3, type RateInfo, type TaxSettings } from "@/lib/taxCalc";
import { categoryAncestry, loadPromotionRules } from "@/lib/promotions";
import { priceSale, type SalePricing } from "@/lib/salePricing";
import { calculateWaselleeCost } from "@/lib/wasellee";

// One pricing path for every sale (online checkout, POS, checkout quote):
// validates the cart against live products/stock, then applies promotions,
// the manual discount and VAT with the shared pure calculator.

export type CartItemInput = { productId: string; variantId?: string | null; quantity: number };

/** A cart problem the shopper/cashier can fix (missing option, not enough stock …). */
export class PricingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const FREE_SHIPPING_THRESHOLD = 10;
export const STANDARD_SHIPPING_COST = 1.5;

/** Delivery fee for an online order — always computed server-side. */
export function onlineShippingCost(
  opts: { shippingMethod: string; branch: WaselleeBranch | null; deliveryType: string },
  subtotal: number,
): number {
  if (opts.shippingMethod === "STORE_PICKUP") return 0; // collected in person
  if (opts.shippingMethod === "WASELLEE") {
    return opts.branch ? calculateWaselleeCost(opts.branch, opts.deliveryType as never) : 0;
  }
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : STANDARD_SHIPPING_COST;
}

export type PricedCart = {
  orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[];
  pricing: SalePricing;
  settings: TaxSettings;
  rates: Map<string, RateInfo>;
  /** Fields to spread into `order.create({ data })` (subtotal, discount, total, VAT, promotions). */
  orderMoney: {
    subtotal: number;
    discount: number;
    shippingCost: number;
    total: number;
    pricesIncludeTax: boolean;
    taxTotal: number;
    shippingTax: number;
    taxBreakdown: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    promotionDiscount: number;
    appliedPromotions: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  };
};

export async function priceCart(
  items: CartItemInput[],
  opts: {
    channel: "ONLINE" | "POS";
    /** Manual (POS) or coupon discount on top of promotions. */
    discount?: number;
    /** Delivery fee from the subtotal after promotions. */
    shipping?: (subtotalAfterPromotions: number) => number;
  },
): Promise<PricedCart> {
  if (items.length === 0) throw new PricingError("Add at least one item");
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { variants: { include: { inventory: true } } },
  });

  type Prepared = {
    product: (typeof products)[number];
    variant: (typeof products)[number]["variants"][number] | null;
    quantity: number;
    unitPrice: number;
  };
  const prepared: Prepared[] = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new PricingError(`Product ${item.productId} not found`);
    // A product sold in sizes/colours must be ordered as one exact option,
    // otherwise stock can't be reduced and the order wouldn't say what was sold.
    const activeOptions = product.variants.filter((v) => v.isActive);
    if (!item.variantId && activeOptions.length > 0) {
      throw new PricingError(`Please choose the size / colour for ${product.nameEn}`);
    }
    let variant: Prepared["variant"] = null;
    if (item.variantId) {
      variant = activeOptions.find((v) => v.id === item.variantId) || null;
      if (!variant) throw new PricingError(`Variant not found for ${product.nameEn}`);
      // Stock is re-checked atomically when the order is written; this is the fast, friendly failure.
      if ((variant.inventory?.quantity ?? 0) < item.quantity) {
        const label = [variant.color, variant.size].filter(Boolean).join(" / ") || "this option";
        throw new PricingError(`Not enough stock for ${product.nameEn} (${label}): ${variant.inventory?.quantity ?? 0} left`);
      }
    }
    const unitPrice = r3(Number(product.salePrice ?? product.basePrice) + Number(variant?.priceAdjustment ?? 0));
    prepared.push({ product, variant, quantity: item.quantity, unitPrice });
  }

  const [settings, rates, shippingRate, promotions, ancestry] = await Promise.all([
    getTaxSettings(),
    resolveProductTaxRates(productIds),
    getDefaultTaxRate(),
    loadPromotionRules(opts.channel),
    categoryAncestry(),
  ]);

  const lineRates = prepared.map((p) => rates.get(p.product.id) ?? NO_TAX);
  const saleLines = prepared.map((p, i) => ({
    productId: p.product.id,
    categoryIds: ancestry.get(p.product.categoryId) ?? [p.product.categoryId],
    unitPrice: p.unitPrice,
    quantity: p.quantity,
    onSale: p.product.salePrice != null && Number(p.product.salePrice) < Number(p.product.basePrice),
    tax: lineRates[i],
  }));

  // Shipping depends on the subtotal after promotions, so price once without
  // it to learn that, then for real.
  const base = { lines: saleLines, promotions, channel: opts.channel, manualDiscount: opts.discount ?? 0, settings, now: new Date() };
  const preview = priceSale(base);
  const shipping = opts.shipping ? opts.shipping(r3(preview.subtotal - preview.promotionDiscount)) : 0;
  const pricing = priceSale({ ...base, shipping, shippingTax: settings.taxShipping ? shippingRate : null });

  const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = prepared.map((p, i) => {
    const t = lineRates[i];
    const line = pricing.lines[i];
    return {
      product: { connect: { id: p.product.id } },
      ...(p.variant ? { variant: { connect: { id: p.variant.id } } } : {}),
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      unitCost: p.product.costPrice,
      total: line.shelf,
      discountAmount: line.discount,
      promotionDiscount: line.promotionDiscount,
      taxRate: pricing.vatEnabled ? t.rate : 0,
      taxCode: pricing.vatEnabled ? t.code || null : null,
      taxableAmount: line.taxable,
      taxAmount: line.tax,
      // A durable copy of what was actually sold (name, colour, size, SKU)
      // so the order stays readable even if the product is later edited.
      productSnapshot: {
        nameEn: p.product.nameEn,
        nameAr: p.product.nameAr,
        price: p.unitPrice,
        sku: p.variant?.sku || p.product.sku || null,
        barcode: p.variant?.barcode || p.product.barcode || null,
        color: p.variant?.color || null,
        colorHex: p.variant?.colorHex || null,
        colorParts: (p.variant?.colorParts as Prisma.InputJsonValue) || null,
        size: p.variant?.size || null,
        taxCode: pricing.vatEnabled ? t.code : null,
        taxNameEn: pricing.vatEnabled ? t.nameEn : null,
        taxNameAr: pricing.vatEnabled ? t.nameAr : null,
      },
    };
  });

  return {
    orderItemsData,
    pricing,
    settings,
    rates,
    orderMoney: {
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shippingCost: pricing.shipping,
      total: pricing.total,
      pricesIncludeTax: pricing.pricesIncludeTax,
      taxTotal: pricing.taxTotal,
      shippingTax: pricing.shippingTax,
      taxBreakdown: pricing.breakdown.length ? (pricing.breakdown as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      promotionDiscount: pricing.promotionDiscount,
      appliedPromotions: pricing.appliedPromotions.length
        ? (pricing.appliedPromotions as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  };
}

/**
 * Refund owed for returning `quantity` units of an order line: what the
 * customer actually paid per unit (after promotions and the order discount,
 * incl. VAT), and the VAT part of it. Orders from before VAT tracking fall
 * back to the old "price less discount share" rule with no VAT.
 */
export function lineRefund(
  line: { quantity: number; unitPrice: unknown; taxableAmount: unknown | null; taxAmount: unknown },
  quantity: number,
  legacyDiscountRatio: number,
): { amount: number; tax: number } {
  if (line.taxableAmount != null && line.quantity > 0) {
    const paid = Number(line.taxableAmount) + Number(line.taxAmount);
    const amount = r3((paid / line.quantity) * quantity);
    const tax = r3((Number(line.taxAmount) / line.quantity) * quantity);
    return { amount, tax };
  }
  return { amount: r3(Number(line.unitPrice) * quantity * (1 - legacyDiscountRatio)), tax: 0 };
}
