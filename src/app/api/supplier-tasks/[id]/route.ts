import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { taskUpdateSchema } from "@/lib/validations/purchasing";
import { TASK_INCLUDE, parseDay, serializeTask } from "@/lib/purchasing";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, ["admin.suppliers.manage", "admin.purchases.manage", "admin.purchases.receive"]);
    if ("res" in g) return g.res;
    const { id } = await params;
    const existing = await prisma.supplierTask.findUnique({ where: { id } });
    if (!existing) return notFound("Task");
    const parsed = taskUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    const updated = await prisma.supplierTask.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.type !== undefined && { type: d.type }),
        ...(d.priority !== undefined && { priority: d.priority }),
        ...(d.supplierId !== undefined && { supplierId: d.supplierId }),
        ...(d.purchaseOrderId !== undefined && { purchaseOrderId: d.purchaseOrderId }),
        ...(d.assigneeId !== undefined && { assigneeId: d.assigneeId }),
        ...(d.dueDate !== undefined && { dueDate: parseDay(d.dueDate) }),
        ...(d.status !== undefined && {
          status: d.status,
          completedAt: d.status === "DONE" ? existing.completedAt ?? new Date() : null,
        }),
      },
      include: TASK_INCLUDE,
    });
    return ok(serializeTask(updated));
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, ["admin.suppliers.manage", "admin.purchases.manage"]);
    if ("res" in g) return g.res;
    const { id } = await params;
    const existing = await prisma.supplierTask.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound("Task");
    await prisma.supplierTask.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
