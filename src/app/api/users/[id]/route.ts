import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { Role } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  nameEn: z.string().min(2).optional(),
  nameAr: z.string().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        nameEn: true,
        nameAr: true,
        role: true,
        isActive: true,
        avatar: true,
        createdAt: true,
        _count: { select: { orders: true, reviews: true } },
      },
    });

    if (!user) return notFound("User");
    return ok(user);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, email: true, nameEn: true, role: true, isActive: true },
    });

    return ok(user);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (admin.role !== Role.SUPER_ADMIN) return forbidden();

    const { id } = await params;
    if (id === admin.id) return error("Cannot delete your own account");

    await prisma.user.delete({ where: { id } });
    return ok({ message: "User deleted" });
  } catch (e) {
    return serverError(e);
  }
}
