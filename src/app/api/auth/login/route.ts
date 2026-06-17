import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";
import { ok, error, serverError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) return error("Invalid credentials", 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return error("Invalid credentials", 401);

    const token = await createSession(user.id);

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
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
