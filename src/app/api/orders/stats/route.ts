import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["admin.orders.view", "seller.orders.view"]))) {
      return forbidden();
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [grouped, revenueAgg, todayCount] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: "PAID" },
      }),
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    ]);

    const byStatus: Record<string, number> = {};
    let totalOrders = 0;
    for (const g of grouped) {
      byStatus[g.status] = g._count._all;
      totalOrders += g._count._all;
    }

    const pending = byStatus["PENDING"] || 0;
    const processing =
      (byStatus["CONFIRMED"] || 0) +
      (byStatus["PROCESSING"] || 0) +
      (byStatus["SHIPPED"] || 0);
    const delivered = byStatus["DELIVERED"] || 0;
    const cancelled =
      (byStatus["CANCELLED"] || 0) + (byStatus["REFUNDED"] || 0);
    const revenue = Number(revenueAgg._sum.total || 0);

    return ok({
      totalOrders,
      pending,
      processing,
      delivered,
      cancelled,
      revenue,
      today: todayCount,
      byStatus,
    });
  } catch (e) {
    return serverError(e);
  }
}
