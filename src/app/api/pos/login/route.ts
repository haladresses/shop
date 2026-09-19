import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyPin, isValidPin } from "@/lib/pos";
import { roleHasPermission } from "@/lib/permissions";
import { ok, error, forbidden, notFound, serverError } from "@/lib/api/response";

const bodySchema = z.object({
  userId: z.string().min(1),
  pin: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { userId, pin } = parsed.data;

    if (!isValidPin(pin)) return error("Incorrect PIN.");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        posPinHash: true,
        posPinAttempts: true,
        posPinLockedUntil: true,
      },
    });
    if (!user || !user.isActive) return notFound("Staff member");

    if (!(await roleHasPermission(user.role, "pos.access"))) return forbidden();

    const result = await verifyPin(user, pin);
    if (!result.ok) return error(result.error || "Incorrect PIN.");

    const token = await createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return ok({ userId: user.id });
  } catch (e) {
    return serverError(e);
  }
}
