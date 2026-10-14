import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";

/** Look up a registered customer by phone so the cashier can greet them and link the sale. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "pos.access"))) return forbidden();

    const phone = (req.nextUrl.searchParams.get("phone") || "").trim();
    if (phone.length < 6) return ok(null);

    const customer = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, nameEn: true, nameAr: true, phone: true },
    });
    if (!customer) return ok(null);

    const stats = await prisma.order.aggregate({
      where: { userId: customer.id, paymentStatus: "PAID" },
      _count: true,
      _sum: { total: true },
    });

    return ok({
      ...customer,
      orders: stats._count,
      totalSpent: Number(stats._sum.total ?? 0),
    });
  } catch (e) {
    return serverError(e);
  }
}
