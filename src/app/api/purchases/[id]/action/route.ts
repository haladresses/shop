import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { purchaseActionSchema } from "@/lib/validations/purchasing";
import { toBusinessDateKey } from "@/lib/finance";
import { PurchasingError, TX_OPTIONS, purchasingErrorResponse, rebalanceAllocations, recalcPurchaseOrder } from "@/lib/purchasing";

const appendNote = (notes: string | null, line: string) => (notes ? `${notes}\n${line}` : line);

/**
 * Lifecycle actions on a purchase order:
 *   order  — place a draft with the supplier (it becomes a payable)
 *   cancel — nothing received yet; payments on it become credit with the supplier
 *   close  — part-received and the rest will never come: settle on what arrived
 *   draft  — take a placed order back to draft (nothing received or paid)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.purchases.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const parsed = purchaseActionSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { action, reason } = parsed.data;
    const stamp = toBusinessDateKey(new Date());

    const status = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: { select: { id: true, quantity: true, receivedQty: true } }, _count: { select: { allocations: true } } },
      });
      if (!po) throw new PurchasingError("Purchase order not found", 404);
      const received = po.items.reduce((s, i) => s + i.receivedQty, 0);

      if (action === "order") {
        if (po.status !== "DRAFT") throw new PurchasingError("Only a draft can be placed.", 409);
        if (po.items.length === 0) throw new PurchasingError("Add at least one item first.");
        await tx.purchaseOrder.update({ where: { id }, data: { status: "ORDERED", orderedAt: new Date() } });
        return "ORDERED";
      }
      if (action === "cancel") {
        if (!["DRAFT", "ORDERED"].includes(po.status) || received > 0) {
          throw new PurchasingError("Goods have already been received. Return them to the supplier or close the order instead.", 409);
        }
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            notes: appendNote(po.notes, `Cancelled on ${stamp}${reason ? `: ${reason}` : ""}`),
          },
        });
        await rebalanceAllocations(tx, id);
        return "CANCELLED";
      }
      if (action === "close") {
        if (po.status !== "PARTIALLY_RECEIVED") throw new PurchasingError("Only a part-received order can be closed short.", 409);
        const short = po.items.reduce((s, i) => s + Math.max(0, i.quantity - i.receivedQty), 0);
        for (const i of po.items) {
          if (i.quantity !== i.receivedQty) await tx.purchaseOrderItem.update({ where: { id: i.id }, data: { quantity: i.receivedQty } });
        }
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: "RECEIVED",
            receivedAt: new Date(),
            notes: appendNote(po.notes, `Closed short on ${stamp}: ${short} unit(s) not delivered${reason ? `: ${reason}` : ""}`),
          },
        });
        await recalcPurchaseOrder(tx, id);
        return "RECEIVED";
      }
      // back to draft
      if (po.status !== "ORDERED" || received > 0) throw new PurchasingError("Only a placed order with nothing received can go back to draft.", 409);
      if (po._count.allocations > 0) throw new PurchasingError("This order has payments against it. Void them first.", 409);
      await tx.purchaseOrder.update({ where: { id }, data: { status: "DRAFT", orderedAt: null } });
      return "DRAFT";
    }, TX_OPTIONS);
    return ok({ id, status });
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
