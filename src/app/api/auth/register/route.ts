import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validations/auth";
import { created, error, serverError } from "@/lib/api/response";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.errors[0].message);

    const { email, password, nameEn, nameAr, phone } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
    });
    if (existing) return error("Email or phone already registered");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, nameEn, nameAr, phone },
    });

    const token = await createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return created({
      user: {
        id: user.id,
        email: user.email,
        nameEn: user.nameEn,
        role: user.role,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
