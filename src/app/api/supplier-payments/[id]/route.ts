import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, notFound } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { TX_OPTIONS, purchasingErrorResponse, rebalanceAllocations } from "@/lib/purchasing";

/** Voids a payment (e.g. entered by mistake). The orders it paid become unpaid again. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.supplier_payments.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const payment = await prisma.supplierPayment.findUnique({ where: { id }, include: { allocations: { select: { purchaseOrderId: true } } } });
    if (!payment) return notFound("Payment");
    await prisma.$transaction(async (tx) => {
      await tx.supplierPayment.delete({ where: { id } });
      for (const poId of new Set(payment.allocations.map((a) => a.purchaseOrderId))) {
        await rebalanceAllocations(tx, poId);
      }
      await tx.auditLog.create({
        data: {
          userId: g.user.id,
          action: "VOID_SUPPLIER_PAYMENT",
          entity: "SupplierPayment",
          entityId: id,
          oldData: { number: payment.number, supplierId: payment.supplierId, amount: Number(payment.amount), method: payment.method, reference: payment.reference },
        },
      });
    }, TX_OPTIONS);
    return ok({ voided: true });
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
