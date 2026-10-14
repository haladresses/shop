import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { expenseDate, expenseSchema, toBusinessDateKey } from "@/lib/finance";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.finance.manage"))) return forbidden();
    const { id } = await params;

    const parsed = expenseSchema.partial().safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { date, ...rest } = parsed.data;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense");

    const updated = await prisma.expense.update({
      where: { id },
      data: { ...rest, ...(date ? { date: expenseDate(date) } : {}) },
    });
    return ok({ ...updated, amount: Number(updated.amount), date: toBusinessDateKey(updated.date) });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.finance.manage"))) return forbidden();
    const { id } = await params;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense");
    await prisma.expense.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
