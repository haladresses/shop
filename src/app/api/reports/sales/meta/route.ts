import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { REFUND_METHODS, SALE_METHODS, loadCategories, parseFilters } from "../shared";

/** Filter options for the sales reports: salespeople, POS shifts in the period, payment methods, categories. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req);
    if ("error" in f) return error(f.error);

    const [users, shifts, categories] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } }, { posSales: { some: {} } }] },
        select: { id: true, nameEn: true, nameAr: true, email: true, role: true, isActive: true },
        orderBy: [{ isActive: "desc" }, { nameEn: "asc" }],
      }),
      prisma.posShift.findMany({
        where: { openedAt: { lte: f.to }, OR: [{ closedAt: null }, { closedAt: { gte: f.from } }] },
        select: { id: true, status: true, openedAt: true, closedAt: true, cashier: { select: { nameEn: true, email: true } } },
        orderBy: { openedAt: "desc" },
        take: 300,
      }),
      loadCategories(),
    ]);

    return ok({
      sellers: users.map((u) => ({ id: u.id, name: u.nameEn || u.nameAr || u.email, role: u.role, isActive: u.isActive })),
      shifts: shifts.map((s) => ({
        id: s.id,
        status: s.status,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
        cashierName: s.cashier.nameEn || s.cashier.email,
      })),
      saleMethods: SALE_METHODS,
      refundMethods: REFUND_METHODS,
      categories,
    });
  } catch (e) {
    return serverError(e);
  }
}
