import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { round3 } from "@/lib/finance";
import { returnedByLine } from "@/lib/posShift";
import { lineRefund } from "@/lib/orderPricing";
import { nextDocumentNumber } from "@/lib/sequences";

// Shared rules for taking goods back from a customer — used by plain returns
// (refund) and by exchanges (credit applied to a replacement sale). Each unit
// is worth exactly what the customer paid for it: price less its share of
// promotions / the order discount, plus its VAT.

export class ReturnError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type ReturnLineInput = { orderItemId: string; quantity: number };

export async function loadReturnableOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { costPrice: true } } } },
      refunds: { select: { items: true } },
    },
  });
  if (!order) throw new ReturnError("Order not found", 404);
  if (order.paymentStatus !== "PAID") throw new ReturnError("Only paid orders can be returned or exchanged.");
  return order;
}

export type ReturnableOrder = Awaited<ReturnType<typeof loadReturnableOrder>>;

export type ComputedReturn = {
  amount: number;
  taxAmount: number;
  refundItems: Prisma.InputJsonValue[];
  fullyReturned: boolean;
  units: number;
};

/** Value of the units coming back, validated against what's still returnable. */
export function computeReturn(order: ReturnableOrder, items: ReturnLineInput[], restock: boolean): ComputedReturn {
  const returned = returnedByLine(order.refunds);
  const discountRatio = Number(order.subtotal) > 0 ? Number(order.discount) / Number(order.subtotal) : 0;

  let amount = 0;
  let taxAmount = 0;
  const refundItems: Prisma.InputJsonValue[] = [];
  for (const r of items) {
    const line = order.items.find((i) => i.id === r.orderItemId);
    if (!line) throw new ReturnError("That item is not part of this order.");
    const left = line.quantity - (returned.get(line.id) ?? 0);
    if (r.quantity > left) throw new ReturnError(`Only ${left} unit(s) of this item can still be returned.`);
    const unitPrice = Number(line.unitPrice);
    const unitCost = line.unitCost != null ? Number(line.unitCost) : line.product.costPrice != null ? Number(line.product.costPrice) : 0;
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
    // Never credit more than is left on the order; scale the VAT with it.
    taxAmount = amount > 0 ? (taxAmount * cap) / amount : 0;
    amount = cap;
  }
  const totalUnits = order.items.reduce((s, i) => s + i.quantity, 0);
  const units = items.reduce((s, i) => s + i.quantity, 0);
  const unitsAfter = Array.from(returned.values()).reduce((s, n) => s + n, 0) + units;
  return {
    amount: round3(Math.max(0, amount)),
    taxAmount: round3(Math.max(0, taxAmount)),
    refundItems,
    fullyReturned: unitsAfter >= totalUnits,
    units,
  };
}

/** Puts the returned units back on the shelf (skip for damaged goods). */
export async function restockReturned(
  tx: Prisma.TransactionClient,
  order: ReturnableOrder,
  items: ReturnLineInput[],
  opts: { userId: string; reason?: string | null; label?: string },
) {
  for (const r of items) {
    const line = order.items.find((i) => i.id === r.orderItemId);
    if (!line?.variantId) continue;
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
        note: `${opts.label ?? "Return"} on ${order.orderNumber}${opts.reason ? `: ${opts.reason}` : ""}`,
        createdBy: opts.userId,
      },
    });
  }
}

/** Books the credit note against the original order and updates its refunded total / status. */
export async function recordRefund(
  tx: Prisma.TransactionClient,
  order: ReturnableOrder,
  computed: ComputedReturn,
  opts: {
    method: string;
    reason?: string | null;
    restock: boolean;
    userId: string;
    exchange?: { orderId: string; orderNumber: string };
  },
) {
  const refund = await tx.refund.create({
    data: {
      orderId: order.id,
      amount: computed.amount,
      taxAmount: computed.taxAmount,
      creditNoteNumber: await nextDocumentNumber(tx, "CN"),
      method: opts.method,
      reason: opts.reason || null,
      items: computed.refundItems,
      restocked: opts.restock,
      exchangeOrderId: opts.exchange?.orderId ?? null,
      exchangeOrderNumber: opts.exchange?.orderNumber ?? null,
      createdBy: opts.userId,
    },
  });
  await tx.order.update({
    where: { id: order.id },
    data: {
      refundedAmount: { increment: computed.amount },
      ...(computed.fullyReturned ? { status: "REFUNDED" as const, paymentStatus: "REFUNDED" as const } : {}),
    },
  });
  return refund;
}
