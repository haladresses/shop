import { NextRequest } from "next/server";
import { ok, error, serverError } from "@/lib/api/response";
import { verifyAndSyncPayment } from "@/lib/thawani";

// Possession-based: the orderId cuid is unguessable, same trust model most
// guest-checkout "thank you" pages use. Only returns minimal display fields,
// never the full order/address.
export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) return error("orderId is required");

    const result = await verifyAndSyncPayment(orderId);
    if (!result.ok || !result.order) {
      return error(result.error || "Could not verify payment", 502);
    }

    return ok({
      orderNumber: result.order.orderNumber,
      status: result.order.status,
      paymentStatus: result.paid ? "PAID" : "UNPAID",
      total: result.order.total,
    });
  } catch (e) {
    return serverError(e);
  }
}
