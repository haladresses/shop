import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { createRefund } from "@/lib/thawani";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: { where: { method: "THAWANI" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) return notFound("Order");

    const payment = order.payments[0];
    if (!payment || payment.status !== "PAID" || !payment.transactionId) {
      return error("This order has no paid Thawani payment to refund");
    }

    const result = await createRefund({ sessionId: payment.transactionId, amountOMR: Number(payment.amount) });
    if (!result.success) {
      return error(result.description || "Thawani rejected the refund request", 502);
    }

    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED", gatewayResponse: (result.data || {}) as never },
      }),
      prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } }),
    ]);

    return ok(updatedPayment);
  } catch (e) {
    return serverError(e);
  }
}
