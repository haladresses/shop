import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, hashPassword, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { canManageUser } from "@/lib/permissions";

const schema = z.object({ password: z.string().min(6, "Password must be at least 6 characters") });

/** Admin sets a new password for a user; all their sessions are signed out. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.manage"))) return forbidden();

    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) return notFound("User");
    if (!canManageUser(admin, target)) return error("You can't reset the password of an account at or above your own level.", 403);

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.auditLog.create({ data: { userId: admin.id, action: "user.password_reset", entity: "User", entityId: id } }),
    ]);
    return ok({ message: "Password updated" });
  } catch (e) {
    return serverError(e);
  }
}
