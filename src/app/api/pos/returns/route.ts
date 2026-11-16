import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { round3 } from "@/lib/finance";
import { returnedByLine } from "@/lib/posShift";
import { lineRefund } from "@/lib/orderPricing";
import { nextDocumentNumber } from "@/lib/sequences";

const returnSchema = z.object({
  orderId: z.string().min(1),
  items: z
    .array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1, "Pick at least one item to return"),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "STORE_CREDIT"]).default("CASH"),
  reason: z.string().max(300).optional(),
  // false for damaged goods that should not go back on the shelf.
  restock: z.boolean().default(true),
});

/**
 * Return (part of) a sale — any number of units of any line, e.g. 1 of the 4
 * items bought: refunds the customer, puts those units back in stock (unless
 * damaged) and records a Refund (credit note) so finance and the VAT report
 * net it out. Each unit refunds exactly what was paid for it: price less its
 * share of promotions/discount, plus its VAT.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["pos.access", "admin.orders.manage"]))) return forbidden();

    const parsed = returnSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { orderId, items, method, reason, restock } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { costPrice: true } } } },
        refunds: { select: { items: true } },
      },
    });
    if (!order) return notFound("Order");
    if (order.paymentStatus !== "PAID") return error("Only paid orders can be returned.");

    const returned = returnedByLine(order.refunds);
    const discountRatio = Number(order.subtotal) > 0 ? Number(order.discount) / Number(order.subtotal) : 0;

    let amount = 0;
    let taxAmount = 0;
    const refundItems: Prisma.InputJsonValue[] = [];
    for (const r of items) {
      const line = order.items.find((i) => i.id === r.orderItemId);
      if (!line) return error("That item is not part of this order.");
      const left = line.quantity - (returned.get(line.id) ?? 0);
      if (r.quantity > left) {
        return error(`Only ${left} unit(s) of this item can still be returned.`);
      }
      const unitPrice = Number(line.unitPrice);
      const unitCost =
        line.unitCost != null ? Number(line.unitCost) : line.product.costPrice != null ? Number(line.product.costPrice) : 0;
      const due = lineRefund(line, r.quantity, discountRatio);
      amount += due.amount;
      taxAmount += due.tax;
      refundItems.push({
        orderItemId: line.id,
        productId: line.productId,
        variantId: line.variantId,
        quantity: r.quantity,
        unitPrice,
        amount: due.amount,
        tax: due.tax,
        // Damaged units are a loss: they stay in COGS, so no cost comes back.
        unitCost: restock ? unitCost : 0,
      });
    }
    const cap = Number(order.total) - Number(order.refundedAmount);
    if (amount > cap) {
      // Never refund more than is left on the order; scale the VAT with it.
      taxAmount = amount > 0 ? (taxAmount * cap) / amount : 0;
      amount = cap;
    }
    amount = round3(Math.max(0, amount));
    taxAmount = round3(Math.max(0, taxAmount));

    const totalUnits = order.items.reduce((s, i) => s + i.quantity, 0);
    const unitsAfter =
      Array.from(returned.values()).reduce((s, n) => s + n, 0) + items.reduce((s, i) => s + i.quantity, 0);
    const fullyReturned = unitsAfter >= totalUnits;

    const refund = await prisma.$transaction(async (tx) => {
      if (restock) {
        for (const r of items) {
          const line = order.items.find((i) => i.id === r.orderItemId)!;
          if (!line.variantId) continue;
          const inv = await tx.inventory.update({
            where: { variantId: line.variantId },
            data: { quantity: { increment: r.quantity } },
          });
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inv.id,
              type: "RETURN",
              quantity: r.quantity,
              reference: order.orderNumber,
              balanceAfter: inv.quantity,
              note: `Return on ${order.orderNumber}${reason ? ` — ${reason}` : ""}`,
              createdBy: user.id,
            },
          });
        }
      }

      const created = await tx.refund.create({
        data: {
          orderId,
          amount,
          taxAmount,
          creditNoteNumber: await nextDocumentNumber(tx, "CN"),
          method,
          reason: reason || null,
          items: refundItems,
          restocked: restock,
          createdBy: user.id,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          refundedAmount: { increment: amount },
          ...(fullyReturned ? { status: "REFUNDED" as const, paymentStatus: "REFUNDED" as const } : {}),
        },
      });
      return created;
    });

    return ok({ ...refund, amount: Number(refund.amount), taxAmount: Number(refund.taxAmount), fullyReturned }, 201);
  } catch (e) {
    return serverError(e);
  }
}
