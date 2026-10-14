import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ok, error, unauthorized, notFound, serverError } from "@/lib/api/response";

/**
 * A customer cancels their own order while it's still pending and unpaid
 * (paid orders go through a refund with the shop). Stock is returned.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const { id } = await params;
    const order = await prisma.order.findFirst({ where: { id, userId: me.id }, include: { items: true } });
    if (!order) return notFound("Order");
    if (order.status !== "PENDING" || order.paymentStatus === "PAID") {
      return error("This order can no longer be cancelled online — please contact us on WhatsApp.", 409);
    }
    await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so a concurrent status change wins.
      const res = await tx.order.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED" } });
      if (res.count !== 1) throw new Error("STATE_CHANGED");
      for (const item of order.items) {
        if (!item.variantId) continue;
        const inv = await tx.inventory.update({ where: { variantId: item.variantId }, data: { quantity: { increment: item.quantity } } });
        await tx.inventoryTransaction.create({
          data: { inventoryId: inv.id, type: "RETURN", quantity: item.quantity, balanceAfter: inv.quantity, reference: order.orderNumber, note: `Cancelled by customer — ${order.orderNumber}`, createdBy: me.id },
        });
      }
    });
    return ok({ status: "CANCELLED" });
  } catch (e) {
    if (e instanceof Error && e.message === "STATE_CHANGED") return error("This order was just updated by the shop — refresh to see its status.", 409);
    return serverError(e);
  }
}
