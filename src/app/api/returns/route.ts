import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { businessDayEnd, businessDayStart, isDateKey, round3 } from "@/lib/finance";

/** Returns & refunds ledger for the admin Returns screen. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["admin.orders.view", "admin.finance.view"]))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "25")));
    const from = sp.get("from");
    const to = sp.get("to");
    const search = (sp.get("search") || "").trim();
    const method = sp.get("method") || "";

    const where = {
      ...(isDateKey(from) || isDateKey(to)
        ? {
            createdAt: {
              ...(isDateKey(from) ? { gte: businessDayStart(from) } : {}),
              ...(isDateKey(to) ? { lte: businessDayEnd(to) } : {}),
            },
          }
        : {}),
      ...(method && { method }),
      ...(search && {
        OR: [
          { order: { orderNumber: { contains: search, mode: "insensitive" as const } } },
          { reason: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [rows, total, sum, restocked] = await Promise.all([
      prisma.refund.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { order: { select: { id: true, orderNumber: true, source: true, total: true, guestName: true } } },
      }),
      prisma.refund.count({ where }),
      prisma.refund.aggregate({ where, _sum: { amount: true } }),
      prisma.refund.count({ where: { ...where, restocked: false } }),
    ]);

    const userIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x)));
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nameEn: true, email: true } })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.nameEn || u.email]));

    return ok({
      items: rows.map((r) => {
        const items = Array.isArray(r.items) ? (r.items as { quantity?: number }[]) : [];
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          amount: Number(r.amount),
          method: r.method,
          reason: r.reason,
          restocked: r.restocked,
          units: items.reduce((s, it) => s + Number(it.quantity ?? 0), 0),
          order: { ...r.order, total: Number(r.order.total) },
          createdBy: r.createdBy ? nameOf.get(r.createdBy) ?? "" : "",
        };
      }),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      sum: round3(Number(sum._sum.amount ?? 0)),
      damagedCount: restocked,
    });
  } catch (e) {
    return serverError(e);
  }
}
