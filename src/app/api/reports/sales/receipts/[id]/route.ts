import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";

/**
 * One receipt with its lines, payments and returns — for the report's
 * receipt drill-down and reprint. Purchase costs are left out.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { nameEn: true, nameAr: true, email: true, phone: true } },
        cashier: { select: { nameEn: true } },
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
            product: { select: { nameEn: true, nameAr: true } },
            variant: { select: { color: true, colorParts: true, size: true } },
          },
        },
        payments: { orderBy: { createdAt: "asc" }, select: { method: true, amount: true, status: true, createdAt: true } },
        refunds: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) return notFound("Receipt");
    return ok(order);
  } catch (e) {
    return serverError(e);
  }
}
