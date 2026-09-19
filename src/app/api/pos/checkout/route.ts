import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { generateOrderNumber } from "@/lib/utils";

const itemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1, "Add at least one item"),
  paymentMethod: z.enum(["CASH", "CARD"]),
  discount: z.number().min(0).default(0),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const cashier = await getAuthFromRequest(req);
    if (!cashier) return unauthorized();
    if (!(await userHasPermission(cashier, "pos.access"))) return forbidden();

    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { items, paymentMethod, customerPhone, notes } = parsed.data;

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { variants: { include: { inventory: true } } },
    });

    let subtotal = 0;
    const orderItemsData = [];
    // Stock is (re-)checked atomically inside the transaction below; this is
    // just to fail fast with a clear message before we even open one.
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return error(`Product ${item.productId} not found`);

      let variant = null;
      if (item.variantId) {
        variant = product.variants.find((v) => v.id === item.variantId) || null;
        if (!variant) return error(`Variant not found for ${product.nameEn}`);
        if ((variant.inventory?.quantity ?? 0) < item.quantity) {
          return error(`Not enough stock for ${product.nameEn}${variant.color ? ` (${variant.color})` : ""}`);
        }
      }

      const unitPrice = Number(product.salePrice ?? product.basePrice) + Number(variant?.priceAdjustment ?? 0);
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
          sku: variant?.sku || product.sku || null,
          color: variant?.color || null,
          colorHex: variant?.colorHex || null,
          colorParts: variant?.colorParts || null,
          size: variant?.size || null,
        },
      });
    }

    const discount = Math.min(parsed.data.discount, subtotal);
    const total = subtotal - discount;

    const customer = customerPhone
      ? await prisma.user.findUnique({ where: { phone: customerPhone } })
      : null;

    const order = await prisma.$transaction(async (tx) => {
      // Atomically decrement stock, aborting the whole sale if any line is
      // short — never oversell, even under concurrent POS checkouts.
      for (const item of items) {
        if (!item.variantId) continue;
        const res = await tx.inventory.updateMany({
          where: { variantId: item.variantId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (res.count !== 1) {
          throw new Error(`Not enough stock available — someone else may have just sold the last one.`);
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: customer?.id ?? null,
          guestName: customer ? null : "Walk-in Customer",
          subtotal,
          shippingCost: 0,
          discount,
          total,
          notes,
          shippingAddress: {
            nameEn: customer?.nameEn || "Walk-in Customer",
            phone: customerPhone || undefined,
            city: "In-Store",
            country: "OM",
          },
          shippingMethod: "STORE_PICKUP",
          status: "DELIVERED",
          paymentStatus: "PAID",
          source: "POS",
          cashierId: cashier.id,
          items: { create: orderItemsData },
          payments: {
            create: { amount: total, method: paymentMethod, status: "PAID" },
          },
        },
        include: { items: true, payments: true },
      });

      for (const item of items) {
        if (!item.variantId) continue;
        await tx.inventoryTransaction.create({
          data: {
            inventory: { connect: { variantId: item.variantId } },
            type: "SALE",
            quantity: item.quantity,
            note: `POS sale ${created.orderNumber}`,
            createdBy: cashier.id,
          },
        });
      }

      return created;
    });

    return ok(order, 201);
  } catch (e) {
    if (e instanceof Error && e.message.includes("Not enough stock")) {
      return error(e.message, 409);
    }
    return serverError(e);
  }
}
