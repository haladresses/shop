import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.payments.view"))) return forbidden();

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            user: {
              select: {
                nameEn: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const paid = payments.filter((payment) => payment.status === "PAID");
    const unpaid = payments.filter((payment) => payment.status === "UNPAID");

    return ok({
      payments,
      total: payments.length,
      stats: {
        totalRevenue: paid.reduce((sum, payment) => sum + Number(payment.amount), 0),
        pendingAmount: unpaid.reduce((sum, payment) => sum + Number(payment.amount), 0),
        paidCount: paid.length,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}