import { NextRequest } from "next/server";
import type { PaymentMethod, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { round3 } from "@/lib/finance";
import { ONLINE_SELLER, SALE_METHODS, UNKNOWN_SELLER, num, parseFilters } from "../shared";

/**
 * Every receipt (sale) in the period, newest first, paged.
 *   ?scope=sales (default) — counted sales only (paid or refunded)
 *   ?scope=all            — also unpaid / cancelled orders
 *   ?search=              — invoice / order number, customer name or phone
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req);
    if ("error" in f) return error(f.error);
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(200, Math.max(10, parseInt(sp.get("pageSize") || "50")));
    const scope = sp.get("scope") === "all" ? "all" : "sales";
    const search = (sp.get("search") || "").trim();
    const sort = sp.get("sort") === "asc" ? "asc" : "desc";

    const and: Prisma.OrderWhereInput[] = [{ createdAt: { gte: f.from, lte: f.to } }];
    if (scope === "sales") and.push({ OR: [{ paymentStatus: "PAID" }, { refundedAmount: { gt: 0 } }] });
    if (f.channel !== "ALL") and.push({ source: f.channel });
    if (f.seller === ONLINE_SELLER) and.push({ source: "ONLINE" });
    else if (f.seller === UNKNOWN_SELLER) and.push({ source: "POS", cashierId: null });
    else if (f.seller) and.push({ cashierId: f.seller });
    if (f.method) {
      and.push(
        (SALE_METHODS as readonly string[]).includes(f.method)
          ? { payments: { some: { method: f.method as PaymentMethod } } }
          : { refunds: { some: { method: f.method } } },
      );
    }
    if (f.shiftId) and.push({ posShiftId: f.shiftId });
    if (search) {
      and.push({
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" } },
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { guestName: { contains: search, mode: "insensitive" } },
          { guestEmail: { contains: search, mode: "insensitive" } },
          { user: { nameEn: { contains: search, mode: "insensitive" } } },
          { user: { phone: { contains: search } } },
        ],
      });
    }
    const where: Prisma.OrderWhereInput = { AND: and };

    const [rows, count, agg] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: sort },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          invoiceNumber: true,
          orderNumber: true,
          source: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          discount: true,
          promotionDiscount: true,
          shippingCost: true,
          taxTotal: true,
          total: true,
          refundedAmount: true,
          guestName: true,
          shippingAddress: true,
          cashier: { select: { nameEn: true, email: true } },
          user: { select: { nameEn: true, phone: true } },
          items: { select: { quantity: true } },
          payments: { select: { method: true, amount: true, status: true } },
        },
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where,
        _sum: { subtotal: true, discount: true, promotionDiscount: true, shippingCost: true, taxTotal: true, total: true, refundedAmount: true },
      }),
    ]);

    const items = rows.map((o) => {
      const addr = (o.shippingAddress ?? {}) as { nameEn?: string; phone?: string };
      const customer = o.user?.nameEn || o.guestName || addr.nameEn || "";
      return {
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        invoiceNumber: o.invoiceNumber,
        orderNumber: o.orderNumber,
        source: o.source,
        seller: o.source === "ONLINE" ? "Online store" : o.cashier?.nameEn || o.cashier?.email || "Unassigned",
        customer: customer === "Walk-in Customer" ? "" : customer,
        phone: o.user?.phone || addr.phone || "",
        units: o.items.reduce((t, i) => t + i.quantity, 0),
        lines: o.items.length,
        subtotal: num(o.subtotal),
        offers: num(o.promotionDiscount),
        discount: round3(num(o.discount) - num(o.promotionDiscount)),
        shipping: num(o.shippingCost),
        vat: num(o.taxTotal),
        total: num(o.total),
        refunded: num(o.refundedAmount),
        payments: o.payments
          .filter((p) => p.status !== "FAILED")
          .map((p) => ({ method: p.method, amount: num(p.amount), status: p.status })),
        status: o.status,
        paymentStatus: o.paymentStatus,
      };
    });

    const s = agg._sum;
    return ok({
      range: { from: f.fromKey, to: f.toKey },
      items,
      meta: { page, pageSize, total: count, totalPages: Math.max(1, Math.ceil(count / pageSize)) },
      totals: {
        receipts: count,
        subtotal: round3(num(s.subtotal)),
        offers: round3(num(s.promotionDiscount)),
        discount: round3(num(s.discount) - num(s.promotionDiscount)),
        shipping: round3(num(s.shippingCost)),
        vat: round3(num(s.taxTotal)),
        total: round3(num(s.total)),
        refunded: round3(num(s.refundedAmount)),
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
