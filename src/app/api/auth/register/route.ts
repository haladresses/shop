import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { normalizePhone, parseIdentifier, phoneCandidates, PHONE_ACCOUNT_DOMAIN, publicEmail, registerSchema } from "@/lib/validations/auth";
import { created, error, serverError } from "@/lib/api/response";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const { password, nameEn, nameAr } = parsed.data;
    const id = parseIdentifier(parsed.data.identifier || parsed.data.email || "");
    if (id.kind === "invalid") return error("Enter a valid email or mobile number");

    // A separate optional phone (older clients) is normalised too.
    const extraPhone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
    const phone = id.kind === "phone" ? id.phone : extraPhone;
    const email = id.kind === "email" ? id.email : `${phone!.replace(/\D/g, "")}@${PHONE_ACCOUNT_DOMAIN}`;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          ...(phone ? [{ phone: { in: phoneCandidates(phone) } }] : []),
        ],
      },
    });
    if (existing) {
      return error(id.kind === "phone" ? "This mobile number already has an account. Sign in instead." : "This email already has an account. Sign in instead.", 409);
    }

    const passwordHash = await hashPassword(password);
    // New shoppers get the built-in Customer role straight away.
    const customerRole = await prisma.appRole.findUnique({ where: { key: "customer" }, select: { id: true } });
    const user = await prisma.user.create({
      data: { email, passwordHash, nameEn, nameAr, phone, roleId: customerRole?.id ?? null },
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
        email: publicEmail(user.email),
        phone: user.phone,
        nameEn: user.nameEn,
        role: user.role,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
