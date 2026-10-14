import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { businessDayEnd, businessDayStart, expenseDate, expenseSchema, isDateKey, toBusinessDateKey } from "@/lib/finance";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.finance.view"))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "25")));
    const from = sp.get("from");
    const to = sp.get("to");
    const category = sp.get("category") || "";
    const search = (sp.get("search") || "").trim();

    const where = {
      ...(isDateKey(from) || isDateKey(to)
        ? {
            date: {
              ...(isDateKey(from) ? { gte: businessDayStart(from) } : {}),
              ...(isDateKey(to) ? { lte: businessDayEnd(to) } : {}),
            },
          }
        : {}),
      ...(category && { category }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: "insensitive" as const } },
          { reference: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [rows, total, sum] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return ok({
      items: rows.map((r) => ({ ...r, amount: Number(r.amount), date: toBusinessDateKey(r.date) })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      sum: Number(sum._sum.amount ?? 0),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.finance.manage"))) return forbidden();

    const parsed = expenseSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { date, ...rest } = parsed.data;

    const created = await prisma.expense.create({
      data: { ...rest, date: expenseDate(date), createdBy: user.id },
    });
    return ok({ ...created, amount: Number(created.amount), date }, 201);
  } catch (e) {
    return serverError(e);
  }
}
