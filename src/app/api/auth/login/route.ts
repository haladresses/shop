import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/permissions";
import { loginSchema, parseIdentifier, phoneCandidates } from "@/lib/validations/auth";
import { ok, error, serverError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const { password } = parsed.data;
    const id = parseIdentifier(parsed.data.identifier || parsed.data.email || "");
    if (id.kind === "invalid") return error("Enter a valid email or mobile number");

    const user =
      id.kind === "email"
        ? await prisma.user.findFirst({ where: { email: { equals: id.email, mode: "insensitive" } } })
        : await prisma.user.findFirst({ where: { phone: { in: phoneCandidates(id.phone) } } });

    if (!user || !user.isActive) return error("Incorrect email/mobile or password", 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return error("Incorrect email/mobile or password", 401);

    const token = await createSession(user.id);
    const permissions = await getEffectivePermissions(user);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

    const cookieStore = await cookies();
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        nameEn: user.nameEn,
        nameAr: user.nameAr,
        role: user.role,
        avatar: user.avatar,
        permissions,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
