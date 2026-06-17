import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { updateOrderSchema } from "@/lib/validations/order";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { nameEn: true, nameAr: true, email: true, phone: true } },
        items: {
          include: {
            product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
            variant: true,
          },
        },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) return notFound("Order");
    if (!isAdminRole(user.role) && order.userId !== user.id) return forbidden();

    return ok(order);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound("Order");

    const { status, paymentStatus, notes } = parsed.data;

    const data: Prisma.OrderUpdateInput = {};
    if (status !== undefined) data.status = status as never;
    if (notes !== undefined) data.notes = notes;

    // Determine the effective payment status: explicit value wins, otherwise
    // delivering an order implies it has been paid.
    const effectivePaymentStatus =
      paymentStatus ?? (status === "DELIVERED" ? "PAID" : undefined);

    if (effectivePaymentStatus !== undefined) {
      data.paymentStatus = effectivePaymentStatus as never;
      data.payments = {
        updateMany: {
          where: { orderId: id },
          data: { status: effectivePaymentStatus as never },
        },
      };
    }

    const order = await prisma.order.update({
      where: { id },
      data,
    });

    return ok(order);
  } catch (e) {
    return serverError(e);
  }
}
