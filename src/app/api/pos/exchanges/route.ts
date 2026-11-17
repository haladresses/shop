import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { generateOrderNumber } from "@/lib/utils";
import { round3 } from "@/lib/finance";
import { getOpenShift } from "@/lib/posShift";
import { PricingError, priceCart } from "@/lib/orderPricing";
import { nextDocumentNumber } from "@/lib/sequences";
import { recordPromotionRedemptions } from "@/lib/promotions";
import { ReturnError, computeReturn, loadReturnableOrder, recordRefund, restockReturned } from "@/lib/returns";

const schema = z.object({
  orderId: z.string().min(1),
  /** Units coming back from the original order. */
  returnItems: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().positive() })).min(1, "Choose what the customer is bringing back"),
  /** Replacement items they take instead. */
  newItems: z
    .array(z.object({ productId: z.string().min(1), variantId: z.string().optional().nullable(), quantity: z.number().int().positive() }))
    .min(1, "Add the item(s) the customer takes instead"),
  restock: z.boolean().default(true),
  reason: z.string().trim().max(300).optional(),
  /** How the difference is settled (paid by the customer, or paid back to them). */
  settlementMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER"]).default("CASH"),
  /** Cash handed over when the customer pays the difference in cash. */
  amountTendered: z.number().min(0).optional(),
  /** Only work out the figures; change nothing. */
  dryRun: z.boolean().optional(),
});

/**
 * Exchange: the customer brings back some items (any lines, any number of
 * units) and takes others instead.
 *  • The returned units get a credit note on the original order (method
 *    EXCHANGE) and go back into stock unless damaged.
 *  • The replacement items become a new sale, priced like any POS sale
 *    (current promotions + VAT), paid with the exchange credit.
 *  • The difference is settled: the customer pays the rest, or the store
 *    pays the excess back (recorded as a negative payment on the new sale,
 *    so the cash drawer, sales and VAT reports all add up).
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ["pos.access", "admin.orders.manage"]);
    if ("res" in g) return g.res;
    const user = g.user;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { orderId, returnItems, newItems, restock, reason, settlementMethod, amountTendered, dryRun } = parsed.data;

    const order = await loadReturnableOrder(orderId);
    const credit = computeReturn(order, returnItems, restock);
    const { orderItemsData, orderMoney, pricing } = await priceCart(newItems, { channel: "POS" });

    const newTotal = orderMoney.total;
    const difference = round3(newTotal - credit.amount); // > 0 customer pays · < 0 store pays back
    const direction = difference > 0.0005 ? "CUSTOMER_PAYS" : difference < -0.0005 ? "STORE_PAYS" : "EVEN";

    if (dryRun) {
      return ok({
        credit: credit.amount,
        creditTax: credit.taxAmount,
        returnedUnits: credit.units,
        newTotal,
        newTax: pricing.taxTotal,
        promotionDiscount: pricing.promotionDiscount,
        appliedPromotions: pricing.appliedPromotions,
        newLines: pricing.lines.map((l) => ({ gross: l.gross, promotionDiscount: l.promotionDiscount })),
        difference,
        direction,
      });
    }

    const owed = Math.abs(difference);
    if (direction === "CUSTOMER_PAYS" && settlementMethod === "CASH" && amountTendered != null && amountTendered + 0.0005 < owed) {
      return error("Cash tendered is less than the difference the customer has to pay.");
    }
    const changeGiven =
      direction === "CUSTOMER_PAYS" && settlementMethod === "CASH" && amountTendered != null ? round3(amountTendered - owed) : null;

    // New sale's payments: the credit, plus or minus the settled difference.
    const payments: { method: "EXCHANGE_CREDIT" | "CASH" | "CARD" | "BANK_TRANSFER"; amount: number }[] = [];
    if (credit.amount > 0) payments.push({ method: "EXCHANGE_CREDIT", amount: credit.amount });
    if (direction !== "EVEN") payments.push({ method: settlementMethod, amount: difference });

    const shift = await getOpenShift(user.id);
    const address = (order.shippingAddress ?? {}) as Record<string, unknown>;

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Returned units back on the shelf first (so a same-item swap can't fail on stock).
        if (restock) await restockReturned(tx, order, returnItems, { userId: user.id, reason, label: "Exchange" });

        // 2. Replacement items leave stock atomically — never oversell.
        for (const it of newItems) {
          if (!it.variantId) continue;
          const res = await tx.inventory.updateMany({
            where: { variantId: it.variantId, quantity: { gte: it.quantity } },
            data: { quantity: { decrement: it.quantity } },
          });
          if (res.count !== 1) throw new Error("Not enough stock for one of the replacement items. Someone may have just sold it.");
        }

        // 3. The replacement sale.
        const created = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            invoiceNumber: await nextDocumentNumber(tx, "INV"),
            userId: order.userId,
            guestName: order.userId ? null : order.guestName || "Walk-in Customer",
            guestEmail: order.userId ? null : order.guestEmail,
            ...orderMoney,
            customerVatNumber: order.customerVatNumber,
            notes: `Exchange for ${order.orderNumber}${reason ? `: ${reason}` : ""}`,
            shippingAddress: {
              nameEn: (address.nameEn as string) || order.guestName || "Walk-in Customer",
              phone: (address.phone as string) || undefined,
              city: "In-Store",
              country: "OM",
            },
            shippingMethod: "STORE_PICKUP",
            status: "DELIVERED",
            paymentStatus: "PAID",
            source: "POS",
            cashierId: user.id,
            posShiftId: shift?.id ?? null,
            amountTendered: changeGiven != null ? amountTendered ?? null : null,
            changeGiven,
            items: { create: orderItemsData },
            payments: { create: payments.map((p) => ({ amount: p.amount, method: p.method, status: "PAID" as const })) },
          },
          include: { items: true, payments: true, cashier: { select: { nameEn: true } } },
        });

        for (const it of newItems) {
          if (!it.variantId) continue;
          const inv = await tx.inventory.findUnique({ where: { variantId: it.variantId }, select: { quantity: true } });
          await tx.inventoryTransaction.create({
            data: {
              inventory: { connect: { variantId: it.variantId } },
              type: "SALE",
              quantity: it.quantity,
              reference: created.orderNumber,
              balanceAfter: inv?.quantity ?? null,
              note: `Exchange sale ${created.orderNumber} (for ${order.orderNumber})`,
              createdBy: user.id,
            },
          });
        }
        await recordPromotionRedemptions(tx, created.id, pricing.appliedPromotions);

        // 4. Credit note on the original order, linked to the replacement sale.
        const refund = await recordRefund(tx, order, credit, {
          method: "EXCHANGE",
          reason: reason ? `Exchange: ${reason}` : `Exchange for ${created.orderNumber}`,
          restock,
          userId: user.id,
          exchange: { orderId: created.id, orderNumber: created.orderNumber },
        });
        return { order: created, refund };
      },
      { timeout: 30000 },
    );

    return ok(
      {
        order: result.order,
        refund: { ...result.refund, amount: Number(result.refund.amount), taxAmount: Number(result.refund.taxAmount) },
        credit: credit.amount,
        newTotal,
        difference,
        direction,
        changeGiven,
      },
      201,
    );
  } catch (e) {
    if (e instanceof ReturnError || e instanceof PricingError) return error(e.message, e.status);
    if (e instanceof Error && e.message.includes("Not enough stock")) return error(e.message, 409);
    return serverError(e);
  }
}
