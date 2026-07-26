import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { z } from "zod";

const rateUpdateSchema = z.object({
  countryEn: z.string().min(1).optional(),
  countryAr: z.string().min(1).optional(),
  countryCode: z.string().min(2).max(3).toUpperCase().optional(),
  baseWeightKg: z.number().positive().optional(),
  baseCost: z.number().min(0).optional(),
  additionalKgCost: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = rateUpdateSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const existing = await prisma.waselleeInternationalRate.findUnique({ where: { id } });
    if (!existing) return notFound("Rate");

    const rate = await prisma.waselleeInternationalRate.update({ where: { id }, data: parsed.data });
    return ok(rate);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const { id } = await params;
    const existing = await prisma.waselleeInternationalRate.findUnique({ where: { id } });
    if (!existing) return notFound("Rate");

    await prisma.waselleeInternationalRate.delete({ where: { id } });
    return ok({ message: "Rate deleted" });
  } catch (e) {
    return serverError(e);
  }
}
