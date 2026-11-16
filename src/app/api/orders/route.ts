import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, paginated, error, unauthorized, serverError } from "@/lib/api/response";
import { createOrderSchema } from "@/lib/validations/order";
import { generateOrderNumber } from "@/lib/utils";
import { PricingError, onlineShippingCost, priceCart } from "@/lib/orderPricing";
import { nextDocumentNumber } from "@/lib/sequences";
import { recordPromotionRedemptions } from "@/lib/promotions";
import { orderItemCodeCondition } from "@/lib/barcodes";
import { publicEmail } from "@/lib/validations/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    const canViewAllOrders = await userHasAnyPermission(user, ["admin.orders.view", "seller.orders.view"]);

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = 20;
    const skip = (page - 1) * pageSize;
    const status = sp.get("status") || "";
    const paymentStatus = sp.get("paymentStatus") || "";
    const source = sp.get("source") || "";
    const search = sp.get("search") || "";

    const where = {
      ...(canViewAllOrders ? {} : { userId: user.id }),
      ...(status && { status: status as never }),
      ...(paymentStatus && { paymentStatus: paymentStatus as never }),
      ...(source && { source: source as never }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" as const } },
          { invoiceNumber: { contains: search, mode: "insensitive" as const } },
          { guestEmail: { contains: search, mode: "insensitive" as const } },
          { guestName: { contains: search, mode: "insensitive" as const } },
          orderItemCodeCondition(search),
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { nameEn: true, email: true } },
          cashier: { select: { nameEn: true } },
          items: {
            include: {
              product: { select: { nameEn: true, nameAr: true } },
              variant: { select: { color: true, colorParts: true, size: true } },
            },
          },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          waselleeBranch: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    // Phone-only accounts carry an internal placeholder email: never show it.
    return paginated(
      orders.map((o) => (o.user ? { ...o, user: { ...o.user, email: publicEmail(o.user.email) } } : o)),
      { page, pageSize, total },
    );
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const sessionUser = await getAuthFromRequest(req);
    const {
      items,
      shippingAddress,
      couponCode,
      notes,
      paymentMethod,
      shippingMethod,
      waselleeDeliveryType,
      waselleeBranchId,
    } = parsed.data;

    let waselleeBranch = null;
    if (shippingMethod === "WASELLEE") {
      waselleeBranch = await prisma.waselleeBranch.findUnique({
        where: { id: waselleeBranchId },
      });
      if (!waselleeBranch || !waselleeBranch.isActive) {
        return error("Selected Wasellee branch is not available");
      }
    }

    // Prices, promotions, delivery fee and VAT are all worked out server-side
    // (never trust client-submitted prices) by the same code that powers the
    // checkout summary, so the shopper is charged exactly what they saw.
    const { orderItemsData, orderMoney, pricing } = await priceCart(items, {
      channel: "ONLINE",
      shipping: (subtotal) =>
        onlineShippingCost({ shippingMethod, branch: waselleeBranch, deliveryType: waselleeDeliveryType ?? "HOME_DELIVERY" }, subtotal),
    });

    const order = await prisma.$transaction(async (tx) => {
      // Claim stock atomically — re-checks the live quantity (not the copy
      // read above) so two customers can't both buy the last unit. Applies
      // to every order regardless of payment method: an unpaid COD/bank
      // transfer order still holds the physical item the moment it's placed.
      for (const item of items) {
        if (!item.variantId) continue;
        const res = await tx.inventory.updateMany({
          where: { variantId: item.variantId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (res.count !== 1) {
          throw new Error("Not enough stock: someone else may have just bought the last one.");
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          invoiceNumber: await nextDocumentNumber(tx, "INV"),
          userId: sessionUser?.id || null,
          guestEmail: !sessionUser ? (typeof body.guestEmail === "string" && body.guestEmail.trim()) || null : null,
          guestName: !sessionUser ? body.guestName : null,
          ...orderMoney,
          couponCode: couponCode || null,
          notes,
          shippingAddress,
          shippingMethod: shippingMethod as never,
          waselleeDeliveryType: (waselleeDeliveryType as never) || null,
          waselleeBranchId: waselleeBranch?.id || null,
          source: "ONLINE",
          items: { create: orderItemsData },
          payments: {
            create: {
              amount: orderMoney.total,
              method: paymentMethod as never,
              status: "UNPAID",
            },
          },
        },
        include: {
          items: true,
          payments: true,
          waselleeBranch: true,
        },
      });

      for (const item of items) {
        if (!item.variantId) continue;
        const inv = await tx.inventory.findUnique({ where: { variantId: item.variantId }, select: { quantity: true } });
        await tx.inventoryTransaction.create({
          data: {
            inventory: { connect: { variantId: item.variantId } },
            type: "SALE",
            quantity: item.quantity,
            reference: created.orderNumber,
            balanceAfter: inv?.quantity ?? null,
            note: `Online order ${created.orderNumber}`,
            createdBy: sessionUser?.id || null,
          },
        });
      }

      await recordPromotionRedemptions(tx, created.id, pricing.appliedPromotions);
      return created;
    });

    if (couponCode) {
      await prisma.coupon.update({
        where: { code: couponCode.toUpperCase() },
        data: { usedCount: { increment: 1 } },
      }).catch(() => {});
    }

    // WhatsApp dispatch (to the driver / to Wasli) is sent MANUALLY by the admin
    // from the order screen via WhatsApp Web once the order is packed & ready —
    // no automatic WAHA send here.

    return ok(order, 201);
  } catch (e) {
    if (e instanceof PricingError) return error(e.message, e.status);
    if (e instanceof Error && e.message.includes("Not enough stock")) {
      return error(e.message, 409);
    }
    return serverError(e);
  }
}
