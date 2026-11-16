import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { supplierRefundSchema } from "@/lib/validations/purchasing";
import { TX_OPTIONS, num, parseDay, purchasingErrorResponse, recordSupplierRefund } from "@/lib/purchasing";

/** Money the supplier paid back to us (stored as a negative supplier payment). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.supplier_payments.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const parsed = supplierRefundSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    const supplier = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!supplier) return error("Supplier not found", 404);
    const refund = await prisma.$transaction(
      (tx) =>
        recordSupplierRefund(tx, {
          supplierId: id,
          amount: d.amount,
          method: d.method,
          reference: d.reference,
          receivedAt: parseDay(d.receivedAt) ?? new Date(),
          note: d.note ? `Refund received: ${d.note}` : "Refund received",
          userId: g.user.id,
        }),
      TX_OPTIONS,
    );
    return ok({ id: refund.id, number: refund.number, amount: -num(refund.amount) }, 201);
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
