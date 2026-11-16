import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { num, refundNoteFor, serializePurchaseReturn } from "@/lib/purchasing";

/** One debit note with everything needed to print it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.suppliers.view");
    if ("res" in g) return g.res;
    const { id } = await params;
    const r = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseOrder: { select: { id: true, number: true, supplierReference: true, orderDate: true } },
      },
    });
    if (!r) return notFound("Return");
    const [refund, user] = await Promise.all([
      prisma.supplierPayment.findFirst({ where: { note: refundNoteFor(r.number), amount: { lt: 0 } } }),
      r.createdBy ? prisma.user.findUnique({ where: { id: r.createdBy }, select: { nameEn: true, email: true } }) : null,
    ]);
    const s = r.supplier;
    return ok({
      ...serializePurchaseReturn({ ...r, supplier: { id: s.id, code: s.code, nameEn: s.nameEn, nameAr: s.nameAr }, purchaseOrder: r.purchaseOrder }),
      supplierDetails: {
        id: s.id,
        code: s.code,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        vatNumber: s.vatNumber,
        crNumber: s.crNumber,
        phone: s.phone,
        email: s.email,
        address: s.address,
        city: s.city,
        country: s.country,
      },
      purchaseOrderRef: r.purchaseOrder?.supplierReference ?? null,
      createdBy: user ? user.nameEn || user.email : "",
      settlement: refund ? "REFUND" : "CREDIT",
      refund: refund ? { id: refund.id, number: refund.number, method: refund.method, reference: refund.reference, amount: -num(refund.amount) } : null,
    });
  } catch (e) {
    return serverError(e);
  }
}
