import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { taskSchema } from "@/lib/validations/purchasing";
import { addDaysTo, parseDay, todayStart } from "@/lib/purchasing";
import { serializeTask, TASK_INCLUDE, TASK_PRIORITY_WEIGHT } from "@/lib/purchasing";

/**
 * Purchasing follow-ups.
 *   ?status=open|done|all (default open)  ?supplierId=  ?purchaseOrderId=
 *   ?due=overdue|today|week  ?assignee=me|<userId>  ?search=
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.suppliers.view");
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "open";
    const due = sp.get("due") || "";
    const assignee = sp.get("assignee") || "";
    const search = (sp.get("search") || "").trim();
    const today = todayStart();
    const tomorrow = addDaysTo(today, 1);

    const base: Prisma.SupplierTaskWhereInput = {
      ...(sp.get("supplierId") && { supplierId: sp.get("supplierId")! }),
      ...(sp.get("purchaseOrderId") && { purchaseOrderId: sp.get("purchaseOrderId")! }),
      ...(assignee === "me" ? { assigneeId: g.user.id } : assignee ? { assigneeId: assignee } : {}),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { supplier: { nameEn: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };
    const where: Prisma.SupplierTaskWhereInput = {
      ...base,
      ...(status === "open" && { status: { not: "DONE" } }),
      ...(status === "done" && { status: "DONE" }),
      ...(due === "overdue" && { dueDate: { lt: today }, status: { not: "DONE" } }),
      ...(due === "today" && { dueDate: { gte: today, lt: tomorrow } }),
      ...(due === "week" && { dueDate: { gte: today, lt: addDaysTo(today, 7) } }),
    };

    const [rows, open, overdue, dueToday, done] = await Promise.all([
      prisma.supplierTask.findMany({ where, include: TASK_INCLUDE, take: 500 }),
      prisma.supplierTask.count({ where: { ...base, status: { not: "DONE" } } }),
      prisma.supplierTask.count({ where: { ...base, status: { not: "DONE" }, dueDate: { lt: today } } }),
      prisma.supplierTask.count({ where: { ...base, status: { not: "DONE" }, dueDate: { gte: today, lt: tomorrow } } }),
      prisma.supplierTask.count({ where: { ...base, status: "DONE" } }),
    ]);

    // Open first, then soonest due (no due date last), then most urgent.
    rows.sort((a, b) => {
      const sa = a.status === "DONE" ? 1 : 0;
      const sb = b.status === "DONE" ? 1 : 0;
      if (sa !== sb) return sa - sb;
      if (sa === 1) return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
      const da = a.dueDate?.getTime() ?? Infinity;
      const db = b.dueDate?.getTime() ?? Infinity;
      if (da !== db) return da - db;
      return TASK_PRIORITY_WEIGHT[b.priority] - TASK_PRIORITY_WEIGHT[a.priority];
    });

    return ok({ items: rows.map(serializeTask), counts: { open, overdue, dueToday, done } });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.suppliers.manage", "admin.purchases.manage"]);
    if ("res" in g) return g.res;
    const parsed = taskSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    let supplierId = d.supplierId ?? null;
    if (d.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: d.purchaseOrderId }, select: { supplierId: true } });
      if (!po) return error("That purchase order doesn't exist.");
      supplierId = supplierId ?? po.supplierId;
    }
    const created = await prisma.supplierTask.create({
      data: {
        supplierId,
        purchaseOrderId: d.purchaseOrderId ?? null,
        title: d.title,
        description: d.description,
        type: d.type,
        priority: d.priority,
        status: d.status,
        dueDate: parseDay(d.dueDate),
        assigneeId: d.assigneeId ?? null,
        completedAt: d.status === "DONE" ? new Date() : null,
        createdBy: g.user.id,
      },
      include: TASK_INCLUDE,
    });
    return ok(serializeTask(created), 201);
  } catch (e) {
    return serverError(e);
  }
}
