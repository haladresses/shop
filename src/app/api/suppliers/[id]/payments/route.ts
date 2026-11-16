import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { supplierPaymentSchema } from "@/lib/validations/purchasing";
import { TX_OPTIONS, num, parseDay, purchasingErrorResponse, recordSupplierPayment } from "@/lib/purchasing";

/**
 * Pay a supplier. With autoAllocate (default) the money settles their oldest
 * open orders first; otherwise `allocations` say which orders it pays. Any
 * remainder stays on their account as credit.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.supplier_payments.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const parsed = supplierPaymentSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    const res = await prisma.$transaction(
      (tx) =>
        recordSupplierPayment(tx, {
          supplierId: id,
          amount: d.amount,
          method: d.method,
          reference: d.reference,
          paidAt: parseDay(d.paidAt) ?? new Date(),
          note: d.note,
          userId: g.user.id,
          autoAllocate: d.autoAllocate && !(d.allocations && d.allocations.length),
          allocations: d.allocations,
        }),
      TX_OPTIONS,
    );
    return ok(
      {
        id: res.payment.id,
        number: res.payment.number,
        amount: num(res.payment.amount),
        allocated: res.allocated,
        unallocated: res.unallocated,
        allocations: res.payment.allocations.map((a) => ({ amount: num(a.amount), purchaseOrder: a.purchaseOrder })),
      },
      201,
    );
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
