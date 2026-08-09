import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.dashboard.view"))) return forbidden();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalUsers,
      newUsersThisMonth,
      totalOrders,
      ordersThisMonth,
      revenueThisMonth,
      revenueLastMonth,
      totalProducts,
      activeProducts,
      pendingOrders,
      lowStockCount,
      recentOrders,
      topProducts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfMonth }, paymentStatus: "PAID" },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          paymentStatus: "PAID",
        },
        _sum: { total: true },
      }),
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.inventory.count({
        where: { quantity: { lte: 5 } },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { nameEn: true, email: true } },
        },
      }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

    const topProductIds = topProducts.map((p) => p.productId);
    const topProductDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      include: { images: { where: { isPrimary: true }, take: 1 } },
    });

    const thisMonthRevenue = Number(revenueThisMonth._sum.total || 0);
    const lastMonthRevenue = Number(revenueLastMonth._sum.total || 0);
    const revenueGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    return ok({
      stats: {
        totalUsers,
        newUsersThisMonth,
        totalOrders,
        ordersThisMonth,
        revenueThisMonth: thisMonthRevenue,
        revenueLastMonth: lastMonthRevenue,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        totalProducts,
        activeProducts,
        pendingOrders,
        lowStockCount,
      },
      recentOrders,
      topProducts: topProducts.map((tp) => ({
        ...tp,
        product: topProductDetails.find((p) => p.id === tp.productId),
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}
