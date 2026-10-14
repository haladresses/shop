import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { canManageUser } from "@/lib/permissions";

/** Sign a user out on every device. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.manage"))) return forbidden();

    const { id } = await params;
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) return notFound("User");
    if (!canManageUser(admin, target)) return error("You can't sign out an account at or above your own level.", 403);

    const { count } = await prisma.session.deleteMany({ where: { userId: id } });
    return ok({ signedOut: count });
  } catch (e) {
    return serverError(e);
  }
}
