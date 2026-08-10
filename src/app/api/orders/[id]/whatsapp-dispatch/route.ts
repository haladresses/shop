import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import {
  buildDriverDispatchMessage,
  buildWasliDispatchMessage,
  buildWhatsAppLink,
  getDispatchPhones,
  toWhatsAppNumber,
} from "@/lib/wasellee";
import { z } from "zod";

const DISPATCH_PERMS = ["admin.orders.manage", "admin.shipping.manage", "seller.orders.manage"];

async function buildDispatch(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      waselleeBranch: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { items: true } },
    },
  });
  if (!order) return null;

  const paymentMethod = order.payments[0]?.method || "CASH_ON_DELIVERY";
  const base = {
    orderNumber: order.orderNumber,
    guestName: order.guestName,
    notes: order.notes,
    total: order.total,
    shippingAddress: order.shippingAddress,
    itemsCount: order._count.items,
    paymentMethod,
  };

  const { driver, wasli } = await getDispatchPhones();
  const driverText = buildDriverDispatchMessage(base);
  const wasliText = buildWasliDispatchMessage(base, order.waselleeBranch?.cityEn ?? null);

  return {
    driver: {
      phone: driver ? toWhatsAppNumber(driver) : "",
      link: driver ? buildWhatsAppLink(driver, driverText) : null,
      text: driverText,
      sentAt: order.driverWhatsappSentAt,
    },
    wasellee: {
      phone: wasli ? toWhatsAppNumber(wasli) : "",
      link: wasli ? buildWhatsAppLink(wasli, wasliText) : null,
      text: wasliText,
      sentAt: order.waselleeWhatsappSentAt,
    },
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasAnyPermission(admin, DISPATCH_PERMS))) return forbidden();

    const { id } = await params;
    const dispatch = await buildDispatch(id);
    if (!dispatch) return notFound("Order");
    return ok(dispatch);
  } catch (e) {
    return serverError(e);
  }
}

const bodySchema = z.object({
  channel: z.enum(["driver", "wasellee"]),
  sent: z.boolean(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasAnyPermission(admin, DISPATCH_PERMS))) return forbidden();

    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound("Order");

    const value = parsed.data.sent ? new Date() : null;
    await prisma.order.update({
      where: { id },
      data:
        parsed.data.channel === "driver"
          ? { driverWhatsappSentAt: value }
          : { waselleeWhatsappSentAt: value },
    });

    const dispatch = await buildDispatch(id);
    return ok(dispatch);
  } catch (e) {
    return serverError(e);
  }
}
