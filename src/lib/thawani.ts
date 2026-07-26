import prisma from "@/lib/db";

const THAWANI_UAT_BASE = "https://uatcheckout.thawani.om";
const THAWANI_PROD_BASE = "https://checkout.thawani.om";

function getThawaniConfig() {
  const secretKey = process.env.THAWANI_SECRET_KEY;
  const publishableKey = process.env.THAWANI_PUBLISHABLE_KEY;
  const mode = process.env.THAWANI_MODE === "production" ? "production" : "uat";
  const baseUrl = mode === "production" ? THAWANI_PROD_BASE : THAWANI_UAT_BASE;
  return { secretKey, publishableKey, mode, baseUrl };
}

type ThawaniEnvelope<T> = {
  success: boolean;
  code: number;
  description: string;
  data?: T;
};

type ThawaniSessionData = {
  session_id: string;
  invoice?: string;
  client_reference_id?: string;
  payment_status?: "paid" | "unpaid" | string;
  total_amount?: number;
  currency?: string;
  [key: string]: unknown;
};

async function thawaniRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<ThawaniEnvelope<T>> {
  const { secretKey, baseUrl } = getThawaniConfig();
  if (!secretKey) {
    return { success: false, code: 0, description: "Thawani is not configured (THAWANI_SECRET_KEY missing)" };
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "thawani-api-key": secretKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as ThawaniEnvelope<T> | null;
  if (!json) {
    return { success: false, code: res.status, description: `Thawani returned an unexpected response (HTTP ${res.status})` };
  }
  return json;
}

/**
 * Charges a single aggregate line item for the full order total, rather than
 * one line per cart item — this guarantees the amount charged always exactly
 * matches order.total regardless of discounts/shipping, with no rounding drift.
 */
export async function createCheckoutSession(params: {
  orderNumber: string;
  amountOMR: number;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const unitAmount = Math.round(params.amountOMR * 1000);
  return thawaniRequest<ThawaniSessionData>("POST", "/api/v1/checkout/session", {
    client_reference_id: params.orderNumber,
    mode: "payment",
    products: [{ name: `Order #${params.orderNumber}`.slice(0, 39), unit_amount: unitAmount, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata || {},
  });
}

export async function retrieveSession(sessionId: string) {
  return thawaniRequest<ThawaniSessionData>("GET", `/api/v1/checkout/session/${sessionId}`);
}

export function buildCheckoutRedirectUrl(sessionId: string) {
  const { baseUrl, publishableKey } = getThawaniConfig();
  return `${baseUrl}/pay/${sessionId}?key=${publishableKey}`;
}

/**
 * Refund body fields aren't independently confirmed against Thawani's docs
 * (inaccessible to fetch) — implemented against the documented endpoint with
 * best-effort field names. Any rejection carries Thawani's own `description`
 * back to the caller so it's diagnosable without re-deriving the contract.
 */
export async function createRefund(params: { sessionId: string; amountOMR: number; reason?: string }) {
  return thawaniRequest<Record<string, unknown>>("POST", "/api/v1/refunds", {
    payment: params.sessionId,
    amount: Math.round(params.amountOMR * 1000),
    reason: params.reason || "requested_by_customer",
  });
}

/**
 * Re-fetches the true payment status from Thawani and idempotently syncs it
 * onto our Order/Payment rows. Never trusts a caller-supplied status (redirect
 * query params, unverified webhook bodies) — only what Thawani itself reports.
 */
export async function verifyAndSyncPayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { where: { method: "THAWANI" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const payment = order?.payments[0];
  if (!order || !payment || !payment.transactionId) {
    return { ok: false, error: "No Thawani payment found for this order" as string, order: null };
  }

  const result = await retrieveSession(payment.transactionId);
  if (!result.success || !result.data) {
    return { ok: false, error: result.description, order };
  }

  const isPaid = result.data.payment_status === "paid";
  const newPaymentStatus = isPaid ? "PAID" : "UNPAID";

  if (payment.status !== newPaymentStatus) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: newPaymentStatus as never, gatewayResponse: result.data as never },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: newPaymentStatus as never },
      }),
    ]);
  }

  return { ok: true, error: null, paid: isPaid, order };
}
