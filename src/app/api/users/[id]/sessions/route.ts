import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { getActor, userBlockReason } from "@/lib/roles";

/** Sign a user out on every device. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.users.manage");
    if ("res" in g) return g.res;
    const admin = await getActor(g.user);

    const { id } = await params;
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, roleId: true } });
    if (!target) return notFound("User");
    const reason = await userBlockReason(admin, target);
    if (reason) return error(reason, 403);

    const { count } = await prisma.session.deleteMany({ where: { userId: id } });
    return ok({ signedOut: count });
  } catch (e) {
    return serverError(e);
  }
}
