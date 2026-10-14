import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/response";

/** One of the signed-in customer's orders (404 for anyone else's). No internal costs. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const { id } = await params;
    const o = await prisma.order.findFirst({
      where: { id, userId: me.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        shippingCost: true,
        discount: true,
        total: true,
        refundedAmount: true,
        couponCode: true,
        notes: true,
        shippingAddress: true,
        shippingMethod: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            total: true,
            productSnapshot: true,
            product: { select: { slug: true, images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } } } },
          },
        },
        payments: { select: { method: true, amount: true, status: true } },
        refunds: { select: { amount: true, createdAt: true, reason: true } },
      },
    });
    if (!o) return notFound("Order");
    return ok({
      ...o,
      subtotal: Number(o.subtotal),
      shippingCost: Number(o.shippingCost),
      discount: Number(o.discount),
      total: Number(o.total),
      refundedAmount: Number(o.refundedAmount),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      items: o.items.map((it) => {
        const snap = (it.productSnapshot ?? {}) as Record<string, unknown>;
        return {
          id: it.id,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          total: Number(it.total),
          nameEn: String(snap.nameEn ?? ""),
          nameAr: String(snap.nameAr ?? ""),
          color: (snap.color as string) ?? null,
          size: (snap.size as string) ?? null,
          image: it.product.images[0]?.url ?? null,
          slug: it.product.slug,
        };
      }),
      payments: o.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
      refunds: o.refunds.map((r) => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })),
      canCancel: o.status === "PENDING" && o.paymentStatus !== "PAID",
    });
  } catch (e) {
    return serverError(e);
  }
}
