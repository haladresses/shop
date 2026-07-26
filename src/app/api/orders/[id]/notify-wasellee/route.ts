import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { sendWaselleeOrderNotification } from "@/lib/wasellee";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { waselleeBranch: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!order) return notFound("Order");
    if (order.shippingMethod !== "WASELLEE" || !order.waselleeBranch) {
      return error("This order is not shipped via Wasellee");
    }

    const paymentMethod = order.payments[0]?.method || "CASH_ON_DELIVERY";
    const result = await sendWaselleeOrderNotification(order, order.waselleeBranch, paymentMethod);

    const updated = await prisma.order.update({
      where: { id },
      data: result.ok
        ? { whatsappNotifiedAt: new Date(), whatsappNotifyError: null }
        : { whatsappNotifyError: result.error },
    });

    if (!result.ok) return error(result.error || "Failed to send WhatsApp notification", 502);
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
