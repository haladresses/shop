import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getOpenShift, returnedByLine } from "@/lib/posShift";
import { businessDayStart, toBusinessDateKey } from "@/lib/finance";
import { lineRefund } from "@/lib/orderPricing";
import { orderItemCodeCondition } from "@/lib/barcodes";

/**
 * Sales for the POS "Recent sales" and "Returns" screens.
 *   ?q=HD-…        find an order (online or POS) by number, for a return
 *   ?scope=shift   sales in the cashier's current shift (default: today)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["pos.access", "admin.orders.view"]))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim();
    const scope = sp.get("scope") || "today";

    let where;
    if (q) {
      where = {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" as const } },
          { invoiceNumber: { contains: q, mode: "insensitive" as const } },
          // Scanning the item being brought back finds the sales it was on.
          orderItemCodeCondition(q),
        ],
      };
    } else if (scope === "shift") {
      const shift = await getOpenShift(user.id);
      where = shift ? { posShiftId: shift.id } : { id: "__none__" };
    } else {
      where = { source: "POS" as const, createdAt: { gte: businessDayStart(toBusinessDateKey(new Date())) } };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            unitPrice: true,
            total: true,
            productSnapshot: true,
            discountAmount: true,
            promotionDiscount: true,
            taxRate: true,
            taxCode: true,
            taxableAmount: true,
            taxAmount: true,
          },
        },
        payments: { select: { method: true, amount: true, status: true } },
        refunds: { select: { amount: true, items: true, createdAt: true } },
        cashier: { select: { nameEn: true } },
      },
    });

    return ok(
      orders.map((o) => {
        const returned = returnedByLine(o.refunds);
        const legacyRatio = Number(o.subtotal) > 0 ? Number(o.discount) / Number(o.subtotal) : 0;
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          source: o.source,
          status: o.status,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt.toISOString(),
          customerName: o.guestName || (o.shippingAddress as { nameEn?: string } | null)?.nameEn || "",
          cashierName: o.cashier?.nameEn || "",
          subtotal: Number(o.subtotal),
          discount: Number(o.discount),
          total: Number(o.total),
          refundedAmount: Number(o.refundedAmount),
          amountTendered: o.amountTendered == null ? null : Number(o.amountTendered),
          changeGiven: o.changeGiven == null ? null : Number(o.changeGiven),
          payments: o.payments.map((p) => ({ method: p.method, amount: Number(p.amount), status: p.status })),
          invoiceNumber: o.invoiceNumber,
          shippingCost: Number(o.shippingCost),
          shippingTax: Number(o.shippingTax),
          taxTotal: Number(o.taxTotal),
          pricesIncludeTax: o.pricesIncludeTax,
          taxBreakdown: o.taxBreakdown,
          promotionDiscount: Number(o.promotionDiscount),
          appliedPromotions: o.appliedPromotions,
          customerVatNumber: o.customerVatNumber,
          shippingAddress: o.shippingAddress,
          items: o.items.map((it) => {
            const snap = (it.productSnapshot ?? {}) as Record<string, unknown>;
            return {
              id: it.id,
              productId: it.productId,
              variantId: it.variantId,
              nameEn: String(snap.nameEn ?? ""),
              nameAr: String(snap.nameAr ?? ""),
              color: (snap.color as string) ?? null,
              size: (snap.size as string) ?? null,
              quantity: it.quantity,
              returnedQuantity: returned.get(it.id) ?? 0,
              unitPrice: Number(it.unitPrice),
              total: Number(it.total),
              productSnapshot: it.productSnapshot,
              discountAmount: Number(it.discountAmount),
              promotionDiscount: Number(it.promotionDiscount),
              taxRate: Number(it.taxRate),
              taxCode: it.taxCode,
              taxableAmount: it.taxableAmount == null ? null : Number(it.taxableAmount),
              taxAmount: Number(it.taxAmount),
              // What one returned unit refunds (after promotions/discount, incl. VAT).
              refundPerUnit: lineRefund(it, 1, legacyRatio).amount,
            };
          }),
        };
      }),
    );
  } catch (e) {
    return serverError(e);
  }
}
