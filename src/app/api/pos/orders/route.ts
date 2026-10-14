import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getOpenShift, returnedByLine } from "@/lib/posShift";
import { businessDayStart, toBusinessDateKey } from "@/lib/finance";

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
      where = { orderNumber: { contains: q, mode: "insensitive" as const } };
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
        items: { select: { id: true, productId: true, variantId: true, quantity: true, unitPrice: true, total: true, productSnapshot: true } },
        payments: { select: { method: true, amount: true, status: true } },
        refunds: { select: { amount: true, items: true, createdAt: true } },
        cashier: { select: { nameEn: true } },
      },
    });

    return ok(
      orders.map((o) => {
        const returned = returnedByLine(o.refunds);
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
            };
          }),
        };
      }),
    );
  } catch (e) {
    return serverError(e);
  }
}
