import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ok, error, unauthorized, serverError } from "@/lib/api/response";
import { normalizePhone, parseIdentifier, phoneCandidates, PHONE_ACCOUNT_DOMAIN, publicEmail } from "@/lib/validations/auth";

// Everything under /api/account is scoped to the signed-in user only — no ids
// are taken from the client, so nobody can read or change someone else's data.

export async function GET(req: NextRequest) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const [user, orders, spent, active] = await Promise.all([
      prisma.user.findUnique({ where: { id: me.id }, select: { id: true, email: true, phone: true, nameEn: true, nameAr: true, createdAt: true } }),
      prisma.order.count({ where: { userId: me.id } }),
      prisma.order.aggregate({ where: { userId: me.id, paymentStatus: "PAID" }, _sum: { total: true } }),
      prisma.order.count({ where: { userId: me.id, status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"] } } }),
    ]);
    if (!user) return unauthorized();
    return ok({ ...user, email: publicEmail(user.email), stats: { orders, activeOrders: active, totalSpent: Number(spent._sum.total ?? 0) } });
  } catch (e) {
    return serverError(e);
  }
}

const profileSchema = z.object({
  nameEn: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  nameAr: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const b = parsed.data;
    const data: { nameEn?: string; nameAr?: string | null; email?: string; phone?: string | null } = {};
    if (b.nameEn) data.nameEn = b.nameEn;
    if (b.nameAr !== undefined) data.nameAr = b.nameAr || null;
    if (b.email) {
      const p = parseIdentifier(b.email);
      if (p.kind !== "email") return error("Enter a valid email");
      if (await prisma.user.findFirst({ where: { email: { equals: p.email, mode: "insensitive" }, NOT: { id: me.id } } })) {
        return error("That email is already used by another account", 409);
      }
      data.email = p.email;
    }
    if (b.phone !== undefined) {
      if (!b.phone) {
        // Phone-only accounts sign in with their phone — don't let them remove it.
        if (me.email.endsWith(`@${PHONE_ACCOUNT_DOMAIN}`)) return error("Your mobile number is how you sign in — it can't be removed.");
        data.phone = null;
      } else {
        const phone = normalizePhone(b.phone);
        if (!phone) return error("Enter a valid mobile number");
        if (await prisma.user.findFirst({ where: { phone: { in: phoneCandidates(phone) }, NOT: { id: me.id } } })) {
          return error("That mobile number is already used by another account", 409);
        }
        data.phone = phone;
      }
    }
    await prisma.user.update({ where: { id: me.id }, data });
    return ok({ message: "Profile updated" });
  } catch (e) {
    return serverError(e);
  }
}
