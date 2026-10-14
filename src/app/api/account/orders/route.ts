import { NextRequest } from "next/server";
import { OrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api/response";

/** The signed-in customer's own orders, newest first. */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("pageSize") || "10")));
    const status = sp.get("status"); // active | completed | cancelled
    const STATUS: Record<string, OrderStatus[]> = {
      active: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"],
      completed: ["DELIVERED"],
      cancelled: ["CANCELLED", "REFUNDED"],
    };
    const where: Prisma.OrderWhereInput = { userId: me.id, ...(status && STATUS[status] ? { status: { in: STATUS[status] } } : {}) };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          source: true,
          createdAt: true,
          items: {
            take: 4,
            select: { quantity: true, productSnapshot: true, product: { select: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } } } } },
          },
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return ok({
      items: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: Number(o.total),
        source: o.source,
        createdAt: o.createdAt.toISOString(),
        itemCount: o._count.items,
        units: o.items.reduce((n, i) => n + i.quantity, 0),
        thumbs: o.items.map((i) => i.product.images[0]?.url).filter(Boolean),
        firstName: String(((o.items[0]?.productSnapshot ?? {}) as { nameEn?: string }).nameEn ?? ""),
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (e) {
    return serverError(e);
  }
}
