import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { ReturnError, computeReturn, loadReturnableOrder, recordRefund, restockReturned } from "@/lib/returns";

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
 * Return (part of) a sale: any number of units of any line, e.g. 1 of the 4
 * items bought. Refunds the customer, puts those units back in stock (unless
 * damaged) and records a Refund (credit note) so finance and the VAT report
 * net it out. Each unit refunds exactly what was paid for it: price less its
 * share of promotions/discount, plus its VAT. (Exchanges: /api/pos/exchanges.)
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ["pos.access", "admin.orders.manage"]);
    if ("res" in g) return g.res;
    const user = g.user;

    const parsed = returnSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { orderId, items, method, reason, restock } = parsed.data;

    const order = await loadReturnableOrder(orderId);
    const computed = computeReturn(order, items, restock);

    const refund = await prisma.$transaction(async (tx) => {
      if (restock) await restockReturned(tx, order, items, { userId: user.id, reason });
      return recordRefund(tx, order, computed, { method, reason, restock, userId: user.id });
    });

    return ok(
      { ...refund, amount: Number(refund.amount), taxAmount: Number(refund.taxAmount), fullyReturned: computed.fullyReturned },
      201,
    );
  } catch (e) {
    if (e instanceof ReturnError) return error(e.message, e.status);
    return serverError(e);
  }
}
