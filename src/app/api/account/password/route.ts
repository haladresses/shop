import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, hashPassword, verifyPassword } from "@/lib/auth";
import { ok, error, unauthorized, serverError } from "@/lib/api/response";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

/** Change your own password; other devices are signed out, this one stays in. */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const user = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return error("Your current password is incorrect", 400);
    }
    const token = (await cookies()).get("session_token")?.value;
    await prisma.$transaction([
      prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } }),
      prisma.session.deleteMany({ where: { userId: me.id, ...(token ? { NOT: { token } } : {}) } }),
    ]);
    return ok({ message: "Password changed" });
  } catch (e) {
    return serverError(e);
  }
}
