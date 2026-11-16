import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { generateOrderNumber } from "@/lib/utils";
import { round3 } from "@/lib/finance";
import { getOpenShift } from "@/lib/posShift";
import { PricingError, priceCart } from "@/lib/orderPricing";
import { nextDocumentNumber } from "@/lib/sequences";
import { recordPromotionRedemptions } from "@/lib/promotions";

const itemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER"]),
  amount: z.number().positive(),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1, "Add at least one item"),
  // Either a single method (legacy) or a split across several.
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER"]).optional(),
  payments: z.array(paymentSchema).optional(),
  // Cash handed over by the customer — anything above the cash share is change.
  amountTendered: z.number().min(0).optional(),
  discount: z.number().min(0).default(0),
  customerPhone: z.string().optional(),
  customerName: z.string().max(100).optional(),
  // Business customer's VAT number, printed on their tax invoice.
  customerVatNumber: z.string().trim().max(30).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const cashier = await getAuthFromRequest(req);
    if (!cashier) return unauthorized();
    if (!(await userHasPermission(cashier, "pos.access"))) return forbidden();

    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { items, customerPhone, customerName, notes } = parsed.data;

    // Promotions, the cashier's manual discount and VAT — the same shared
    // calculation the POS screen used to show the total.
    const { orderItemsData, orderMoney, pricing } = await priceCart(items, {
      channel: "POS",
      discount: parsed.data.discount,
    });
    const total = orderMoney.total;

    // Payments must cover the total exactly (cash overpayment is change, and
    // is tracked via amountTendered rather than as a payment).
    const payments = parsed.data.payments?.length
      ? parsed.data.payments.map((p) => ({ method: p.method, amount: round3(p.amount) }))
      : [{ method: parsed.data.paymentMethod ?? "CASH", amount: total }];
    const paid = round3(payments.reduce((s, p) => s + p.amount, 0));
    if (Math.abs(paid - total) > 0.0005) {
      return error(`Payments (${paid.toFixed(3)}) must equal the total (${total.toFixed(3)}).`);
    }
    const cashShare = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
    const tendered = parsed.data.amountTendered;
    if (tendered != null && cashShare > 0 && tendered + 0.0005 < cashShare) {
      return error("Cash tendered is less than the cash amount due.");
    }
    const changeGiven = tendered != null && cashShare > 0 ? round3(tendered - cashShare) : null;

    const shift = await getOpenShift(cashier.id);

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
          invoiceNumber: await nextDocumentNumber(tx, "INV"),
          userId: customer?.id ?? null,
          guestName: customer ? null : customerName?.trim() || "Walk-in Customer",
          ...orderMoney,
          customerVatNumber: parsed.data.customerVatNumber || null,
          notes,
          shippingAddress: {
            nameEn: customer?.nameEn || customerName?.trim() || "Walk-in Customer",
            phone: customerPhone || undefined,
            city: "In-Store",
            country: "OM",
          },
          shippingMethod: "STORE_PICKUP",
          status: "DELIVERED",
          paymentStatus: "PAID",
          source: "POS",
          cashierId: cashier.id,
          posShiftId: shift?.id ?? null,
          amountTendered: tendered ?? null,
          changeGiven,
          items: { create: orderItemsData },
          payments: {
            create: payments.map((p) => ({ amount: p.amount, method: p.method, status: "PAID" as const })),
          },
        },
        include: { items: true, payments: true, cashier: { select: { nameEn: true } } },
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
            note: `POS sale ${created.orderNumber}`,
            createdBy: cashier.id,
          },
        });
      }

      await recordPromotionRedemptions(tx, created.id, pricing.appliedPromotions);
      return created;
    });

    return ok(order, 201);
  } catch (e) {
    if (e instanceof PricingError) return error(e.message, e.status);
    if (e instanceof Error && e.message.includes("Not enough stock")) {
      return error(e.message, 409);
    }
    return serverError(e);
  }
}
