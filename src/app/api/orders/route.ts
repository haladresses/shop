import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, paginated, error, unauthorized, serverError } from "@/lib/api/response";
import { createOrderSchema } from "@/lib/validations/order";
import { generateOrderNumber } from "@/lib/utils";
import { calculateWaselleeCost } from "@/lib/wasellee";

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
    const search = sp.get("search") || "";

    const where = {
      ...(canViewAllOrders ? {} : { userId: user.id }),
      ...(status && { status: status as never }),
      ...(paymentStatus && { paymentStatus: paymentStatus as never }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" as const } },
          { guestEmail: { contains: search, mode: "insensitive" as const } },
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
          items: { include: { product: { select: { nameEn: true, nameAr: true } } } },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          waselleeBranch: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return paginated(orders, { page, pageSize, total });
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

    let discount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase(), isActive: true },
      });
      if (coupon && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
        if (!coupon.expiresAt || coupon.expiresAt > new Date()) {
          // Apply discount (computed after subtotal is known)
        }
      }
    }

    // Calculate prices
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { variants: { include: { inventory: true } } },
    });

    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return error(`Product ${item.productId} not found`);

      let unitPrice = Number(product.salePrice || product.basePrice);
      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (variant) unitPrice += Number(variant.priceAdjustment);
      }

      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal,
        productSnapshot: {
          nameEn: product.nameEn,
          nameAr: product.nameAr,
          price: unitPrice,
        },
      });
    }

    // Shipping cost is always computed server-side — never trust a client-submitted price.
    const shippingCost =
      shippingMethod === "WASELLEE" && waselleeBranch
        ? calculateWaselleeCost(waselleeBranch, waselleeDeliveryType!)
        : subtotal >= 10
        ? 0
        : 1.5; // Free shipping over 10 OMR
    const total = subtotal + shippingCost - discount;

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: sessionUser?.id || null,
        guestEmail: !sessionUser ? body.guestEmail : null,
        guestName: !sessionUser ? body.guestName : null,
        subtotal,
        shippingCost,
        discount,
        total,
        couponCode: couponCode || null,
        notes,
        shippingAddress,
        shippingMethod: shippingMethod as never,
        waselleeDeliveryType: (waselleeDeliveryType as never) || null,
        waselleeBranchId: waselleeBranch?.id || null,
        items: { create: orderItemsData },
        payments: {
          create: {
            amount: total,
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
    return serverError(e);
  }
}
