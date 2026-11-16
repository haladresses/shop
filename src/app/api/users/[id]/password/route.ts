import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { hashPassword } from "@/lib/auth";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { getActor, userBlockReason } from "@/lib/roles";

const schema = z.object({ password: z.string().min(6, "Password must be at least 6 characters") });

/** Admin sets a new password for a user; all their sessions are signed out. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.users.manage");
    if ("res" in g) return g.res;
    const admin = await getActor(g.user);

    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, roleId: true } });
    if (!target) return notFound("User");
    const reason = await userBlockReason(admin, target);
    if (reason) return error(reason === "You can't change your own access." ? "Change your own password from your account page." : reason, 403);

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
