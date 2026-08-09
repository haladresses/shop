import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { z } from "zod";

const branchUpdateSchema = z.object({
  cityEn: z.string().min(1).optional(),
  cityAr: z.string().min(1).optional(),
  regionEn: z.string().min(1).optional(),
  regionAr: z.string().min(1).optional(),
  phone: z.string().min(4).optional(),
  homeDeliveryCost: z.number().min(0).optional(),
  officePickupCost: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.shipping.manage"))) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = branchUpdateSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const existing = await prisma.waselleeBranch.findUnique({ where: { id } });
    if (!existing) return notFound("Branch");

    const branch = await prisma.waselleeBranch.update({ where: { id }, data: parsed.data });
    return ok(branch);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.shipping.manage"))) return forbidden();

    const { id } = await params;
    const existing = await prisma.waselleeBranch.findUnique({ where: { id } });
    if (!existing) return notFound("Branch");

    await prisma.waselleeBranch.delete({ where: { id } });
    return ok({ message: "Branch deleted" });
  } catch (e) {
    return serverError(e);
  }
}
