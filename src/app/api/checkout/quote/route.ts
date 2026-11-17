import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { PricingError, getShippingRules, onlineShippingCost, priceCart } from "@/lib/orderPricing";

const quoteSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), variantId: z.string().optional().nullable(), quantity: z.number().int().positive() }))
    .min(1)
    .max(200),
  shippingMethod: z.enum(["STANDARD", "WASELLEE", "STORE_PICKUP"]).default("STANDARD"),
  waselleeBranchId: z.string().optional().nullable(),
  waselleeDeliveryType: z.enum(["HOME_DELIVERY", "OFFICE_PICKUP"]).optional().nullable(),
});

/**
 * Server-priced checkout summary (subtotal, shipping, VAT, total) — exactly
 * what POST /api/orders will charge for the same cart, so the checkout page
 * never shows a different total from the one on the invoice.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = quoteSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { items, shippingMethod, waselleeBranchId, waselleeDeliveryType } = parsed.data;

    const branch =
      shippingMethod === "WASELLEE" && waselleeBranchId
        ? await prisma.waselleeBranch.findUnique({ where: { id: waselleeBranchId } })
        : null;

    const shippingRules = await getShippingRules();
    const priced = await priceCart(items, {
      channel: "ONLINE",
      shipping: (subtotal) =>
        onlineShippingCost({ shippingMethod, branch: branch?.isActive ? branch : null, deliveryType: waselleeDeliveryType ?? "HOME_DELIVERY" }, subtotal, shippingRules),
    });
    const { pricing, settings } = priced;
    return ok({
      subtotal: pricing.subtotal,
      promotionDiscount: pricing.promotionDiscount,
      discount: pricing.discount,
      shipping: pricing.shipping,
      taxTotal: pricing.taxTotal,
      total: pricing.total,
      vatEnabled: pricing.vatEnabled,
      pricesIncludeTax: pricing.pricesIncludeTax,
      showOnStorefront: settings.showOnStorefront,
      breakdown: pricing.breakdown,
      appliedPromotions: pricing.appliedPromotions,
      hints: pricing.hints,
      // Per cart line, in the order sent: promotion savings.
      lines: pricing.lines.map((l) => ({ promotionDiscount: l.promotionDiscount, gross: l.gross })),
    });
  } catch (e) {
    if (e instanceof PricingError) return error(e.message, e.status);
    return serverError(e);
  }
}
