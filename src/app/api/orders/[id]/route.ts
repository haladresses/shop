import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { updateOrderStatusSchema } from "@/lib/validations/order";

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
    const parsed = updateOrderStatusSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.errors[0].message);

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: parsed.data.status as never,
        ...(parsed.data.status === "DELIVERED" && {
          payments: {
            updateMany: {
              where: { orderId: id },
              data: { status: "PAID" as never },
            },
          },
        }),
      },
    });

    return ok(order);
  } catch (e) {
    return serverError(e);
  }
}
