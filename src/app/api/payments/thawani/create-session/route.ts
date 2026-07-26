import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { createCheckoutSession, buildCheckoutRedirectUrl } from "@/lib/thawani";
import { z } from "zod";

const bodySchema = z.object({ orderId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: { payments: { where: { method: "THAWANI" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) return notFound("Order");

    const payment = order.payments[0];
    if (!payment || payment.status === "PAID") {
      return error("This order has no pending Thawani payment to start");
    }

    // Prefer the public app URL (set to the real domain in production) over
    // the request's own origin, which can resolve to an internal container
    // address behind a reverse proxy (this project runs behind nginx-proxy).
    const origin = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
    const successUrl = `${origin}/payment/thawani/callback?orderId=${order.id}`;
    const cancelUrl = `${origin}/payment/thawani/callback?orderId=${order.id}&cancelled=1`;

    const shippingAddress = order.shippingAddress as { nameEn?: string; phone?: string } | null;

    const result = await createCheckoutSession({
      orderNumber: order.orderNumber,
      amountOMR: Number(order.total),
      successUrl,
      cancelUrl,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
        customer_name: shippingAddress?.nameEn || order.guestName || "",
        customer_phone: shippingAddress?.phone || "",
      },
    });

    if (!result.success || !result.data) {
      return error(result.description || "Could not start the Thawani payment session", 502);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { transactionId: result.data.session_id, gatewayResponse: result.data as never },
    });

    return ok({ redirectUrl: buildCheckoutRedirectUrl(result.data.session_id) });
  } catch (e) {
    return serverError(e);
  }
}
