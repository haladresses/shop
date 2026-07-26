import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAndSyncPayment } from "@/lib/thawani";

/**
 * Best-effort webhook receiver. Thawani does not publish a confirmed
 * signature-verification scheme anywhere accessible, so the payload's own
 * status is never trusted — only whatever reference it carries is used to
 * find our order, then the real status is re-fetched from Thawani via
 * verifyAndSyncPayment. This is a belt-and-suspenders sync in case a
 * customer closes the tab before the success_url redirect completes; the
 * callback page's own verify call is the primary path.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const reference: string | undefined =
      body?.data?.client_reference_id || body?.client_reference_id || body?.data?.metadata?.order_id || body?.metadata?.order_id;

    if (reference) {
      const order = await prisma.order.findFirst({
        where: { OR: [{ id: reference }, { orderNumber: reference }] },
        select: { id: true },
      });
      if (order) await verifyAndSyncPayment(order.id).catch(() => {});
    }
  } catch {
    // Never fail the webhook response — Thawani only cares about the 200.
  }

  return NextResponse.json({ received: true });
}
