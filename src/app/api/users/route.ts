import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { hashPassword } from "@/lib/auth";
import { created, error, ok, serverError } from "@/lib/api/response";
import { getBuiltInRole, getCachedRole, parseOverrides, resolveUserRole } from "@/lib/permissions";
import { assignBlockReason, audit, getActor, roleMembersWhere, roleUserCounts, userBlockReason } from "@/lib/roles";
import { normalizePhone, parseIdentifier, phoneCandidates, PHONE_ACCOUNT_DOMAIN, publicEmail } from "@/lib/validations/auth";

const SORTS = {
  name: (dir: Prisma.SortOrder) => [{ nameEn: { sort: dir, nulls: "last" } }],
  email: (dir: Prisma.SortOrder) => [{ email: dir }],
  role: (dir: Prisma.SortOrder) => [{ appRole: { rank: dir } }, { role: dir }],
  lastLogin: (dir: Prisma.SortOrder) => [{ lastLoginAt: { sort: dir, nulls: "last" } }],
  createdAt: (dir: Prisma.SortOrder) => [{ createdAt: dir }],
  orders: (dir: Prisma.SortOrder) => [{ orders: { _count: dir } }],
  status: (dir: Prisma.SortOrder) => [{ isActive: dir }],
} satisfies Record<string, (dir: Prisma.SortOrder) => Prisma.UserOrderByWithRelationInput[]>;

const latinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Name, email or mobile; mobile matches whatever way it was typed or stored. */
function searchWhere(raw: string): Prisma.UserWhereInput | null {
  const search = raw.trim();
  if (!search) return null;
  const or: Prisma.UserWhereInput[] = [
    { email: { contains: search, mode: "insensitive" } },
    { nameEn: { contains: search, mode: "insensitive" } },
    { nameAr: { contains: search, mode: "insensitive" } },
  ];
  const digits = latinDigits(search).replace(/\D/g, "");
  if (digits.length >= 3 && /^[\d\s+()\-٠-٩۰-۹]+$/.test(search)) {
    or.push({ phone: { contains: digits } });
    const local = digits.startsWith("00968") ? digits.slice(5) : digits.startsWith("968") ? digits.slice(3) : digits;
    if (local !== digits) or.push({ phone: { contains: local } });
    const normalized = normalizePhone(search);
    if (normalized) or.push({ phone: { in: phoneCandidates(normalized) } });
  }
  return { OR: or };
}

export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.users.view");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "25") || 25));
    const type = (sp.get("type") || sp.get("role")) as Role | null; // `role` kept for older callers
    const roleId = sp.get("roleId");
    const status = sp.get("status"); // active | inactive
    const group = sp.get("group"); // staff | customers
    const sortKey = (sp.get("sort") || "createdAt") as keyof typeof SORTS;
    const dir: Prisma.SortOrder = sp.get("dir") === "asc" ? "asc" : "desc";

    const and: Prisma.UserWhereInput[] = [];
    const s = searchWhere(sp.get("search") || "");
    if (s) and.push(s);
    if (type && (Object.values(Role) as string[]).includes(type)) and.push({ role: type });
    if (roleId) {
      const role = await prisma.appRole.findUnique({ where: { id: roleId }, select: { id: true, key: true, type: true, isSystem: true } });
      and.push(role ? roleMembersWhere(role) : { id: "__none__" });
    }
    if (status === "active") and.push({ isActive: true });
    if (status === "inactive") and.push({ isActive: false });
    if (group === "staff") and.push({ role: { not: Role.CUSTOMER } });
    if (group === "customers") and.push({ role: Role.CUSTOMER });
    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

    const [users, total, roleCounts, byType, byStatus] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [...(SORTS[sortKey] ?? SORTS.createdAt)(dir), { id: "asc" }],
        select: {
          id: true,
          email: true,
          phone: true,
          nameEn: true,
          nameAr: true,
          role: true,
          roleId: true,
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
      roleUserCounts(),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["isActive"], _count: { _all: true } }),
    ]);

    const spent = users.length
      ? await prisma.order.groupBy({
          by: ["userId"],
          where: { userId: { in: users.map((u) => u.id) }, paymentStatus: "PAID" },
          _sum: { total: true },
        })
      : [];
    const spentBy = new Map(spent.map((x) => [x.userId, Number(x._sum.total ?? 0)]));

    const items = await Promise.all(
      users.map(async ({ posPinHash, permissionOverrides, email, ...u }) => {
        const o = parseOverrides(permissionOverrides);
        const role = await resolveUserRole(u);
        return {
          ...u,
          // Never send the PIN hash or a phone account's placeholder email.
          email: publicEmail(email),
          roleId: role?.id ?? u.roleId,
          appRole: role ? { id: role.id, key: role.key, nameEn: role.nameEn, nameAr: role.nameAr, color: role.color, rank: role.rank } : null,
          posPinSet: posPinHash != null,
          hasOverrides: o.grant.length + o.revoke.length > 0,
          overrideCount: o.grant.length + o.revoke.length,
          totalSpent: spentBy.get(u.id) ?? 0,
          isSelf: u.id === actor.id,
          canManage: (await userBlockReason(actor, u)) === null,
        };
      }),
    );

    return ok({
      items,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      roleCounts: Object.fromEntries(Array.from(roleCounts, ([id, c]) => [id, c.total])),
      typeCounts: Object.fromEntries(byType.map((r) => [r.role, r._count._all])),
      statusCounts: {
        active: byStatus.find((r) => r.isActive)?._count._all ?? 0,
        inactive: byStatus.find((r) => !r.isActive)?._count._all ?? 0,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

const createUserSchema = z
  .object({
    nameEn: z.string().trim().min(2, "Enter a name of at least 2 characters").max(120),
    nameAr: z.string().trim().max(120).optional().nullable(),
    email: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    /** Older clients: one field holding an email or a mobile number. */
    identifier: z.string().trim().optional(),
    password: z.string().min(6, "Password must be at least 6 characters").max(200),
    roleId: z.string().optional().nullable(),
    /** Older clients: account type; the matching built-in role is used. */
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => !!(d.email || d.phone || d.identifier), { message: "Enter a mobile number or an email" });

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.users.manage");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);

    const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const body = parsed.data;

    // Mobile and/or email, normalised the same way as self sign-up.
    let email: string | null = null;
    let phone: string | null = null;
    if (body.identifier) {
      const id = parseIdentifier(body.identifier);
      if (id.kind === "invalid") return error("Enter a valid email or mobile number");
      if (id.kind === "email") email = id.email;
      else phone = id.phone;
    }
    if (body.email) {
      const id = parseIdentifier(body.email);
      if (id.kind !== "email") return error("Enter a valid email");
      email = id.email;
    }
    if (body.phone) {
      phone = normalizePhone(body.phone);
      if (!phone) return error("Enter a valid mobile number");
    }
    if (!email && !phone) return error("Enter a mobile number or an email");
    const storedEmail = email ?? `${phone!.replace(/\D/g, "")}@${PHONE_ACCOUNT_DOMAIN}`;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: { equals: storedEmail, mode: "insensitive" } }, ...(phone ? [{ phone: { in: phoneCandidates(phone) } }] : [])],
      },
      select: { email: true, phone: true },
    });
    if (existing) {
      const phoneTaken = !!phone && !!existing.phone && phoneCandidates(phone).includes(existing.phone);
      return error(phoneTaken ? "This mobile number already has an account." : "This email already has an account.", 409);
    }

    // Role: chosen role, else the built-in role for the given type, else Customer.
    const role = body.roleId ? await getCachedRole(body.roleId) : await getBuiltInRole(body.role ?? Role.CUSTOMER);
    if (!role) return error("That role no longer exists.", 404);
    if (role.key !== "customer" && !actor.permissions.has("admin.users.assign_roles")) {
      return error("You can only create customer accounts.", 403);
    }
    const block = assignBlockReason(actor, role);
    if (block) return error(block, 403);

    const user = await prisma.user.create({
      data: {
        email: storedEmail,
        phone,
        passwordHash: await hashPassword(body.password),
        nameEn: body.nameEn,
        nameAr: body.nameAr || null,
        role: role.type,
        roleId: role.id,
        isActive: body.isActive ?? true,
      },
      select: { id: true, nameEn: true, role: true, roleId: true, createdAt: true },
    });
    await audit(actor.id, "user.create", "User", user.id, undefined, { roleId: role.id, role: role.type }, req.headers.get("x-forwarded-for"));

    return created(user);
  } catch (e) {
    return serverError(e);
  }
}
