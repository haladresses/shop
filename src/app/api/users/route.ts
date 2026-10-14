import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, hashPassword, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { canAssignRole, ROLE_ORDER } from "@/lib/permissions";
import { parseIdentifier, phoneCandidates, PHONE_ACCOUNT_DOMAIN, publicEmail } from "@/lib/validations/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.users.view"))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "25")));
    const search = (sp.get("search") || "").trim();
    const role = sp.get("role") as Role | null;
    const status = sp.get("status"); // active | inactive
    const group = sp.get("group"); // staff | customers

    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { nameEn: { contains: search, mode: "insensitive" } },
          { nameAr: { contains: search } },
          { phone: { contains: search.replace(/\s/g, "") } },
        ],
      }),
      ...(role && (ROLE_ORDER as string[]).includes(role) && { role }),
      ...(status === "active" && { isActive: true }),
      ...(status === "inactive" && { isActive: false }),
      ...(group === "staff" && { role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF, Role.SELLER] } }),
      ...(group === "customers" && { role: Role.CUSTOMER }),
    };

    const [users, total, byRole] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          phone: true,
          nameEn: true,
          nameAr: true,
          role: true,
          isActive: true,
          avatar: true,
          createdAt: true,
          lastLoginAt: true,
          posPinHash: true,
          permissionOverrides: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.groupBy({ by: ["role"], _count: true }),
    ]);

    const spent = users.length
      ? await prisma.order.groupBy({
          by: ["userId"],
          where: { userId: { in: users.map((u) => u.id) }, paymentStatus: "PAID" },
          _sum: { total: true },
        })
      : [];
    const spentBy = new Map(spent.map((s) => [s.userId, Number(s._sum.total ?? 0)]));

    // Never send the PIN hash itself to the client — only whether one is set.
    const data = users.map(({ posPinHash, permissionOverrides, email, ...u }) => {
      const o = (permissionOverrides ?? {}) as { grant?: string[]; revoke?: string[] };
      return {
        ...u,
        email: publicEmail(email),
        posPinSet: posPinHash != null,
        hasOverrides: (o.grant?.length ?? 0) + (o.revoke?.length ?? 0) > 0,
        totalSpent: spentBy.get(u.id) ?? 0,
      };
    });

    return ok({
      items: data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      roleCounts: Object.fromEntries(byRole.map((r) => [r.role, r._count])),
    });
  } catch (e) {
    return serverError(e);
  }
}

const createUserSchema = z.object({
  identifier: z.string().trim().min(3, "Enter an email or mobile number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  nameEn: z.string().trim().min(2, "Name is required"),
  nameAr: z.string().optional(),
  role: z.nativeEnum(Role).default(Role.CUSTOMER),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.manage"))) return forbidden();

    const parsed = createUserSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { identifier, password, nameEn, nameAr, role } = parsed.data;

    if (role !== Role.CUSTOMER) {
      if (!(await userHasPermission(admin, "admin.users.assign_roles"))) return error("You can't create staff accounts.", 403);
      if (!canAssignRole(admin, role)) return error("You can't create an account with that role.", 403);
    }

    const id = parseIdentifier(identifier);
    if (id.kind === "invalid") return error("Enter a valid email or mobile number");
    const phone = id.kind === "phone" ? id.phone : null;
    const email = id.kind === "email" ? id.email : `${phone!.replace(/\D/g, "")}@${PHONE_ACCOUNT_DOMAIN}`;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: { equals: email, mode: "insensitive" } }, ...(phone ? [{ phone: { in: phoneCandidates(phone) } }] : [])] },
    });
    if (existing) return error("An account with this email or mobile already exists", 409);

    const user = await prisma.user.create({
      data: { email, phone, passwordHash: await hashPassword(password), nameEn, nameAr, role },
      select: { id: true, nameEn: true, role: true, createdAt: true },
    });
    return ok(user, 201);
  } catch (e) {
    return serverError(e);
  }
}
