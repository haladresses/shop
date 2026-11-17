import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import {
  ALL_PERMISSIONS,
  SUPER_ADMIN_ROLE_KEY,
  getBuiltInRole,
  getCachedRole,
  getEffectivePermissions,
  getRoleBasePermissions,
  parseOverrides,
  resolveUserRole,
  sanitizePermissions,
  type CachedRole,
} from "@/lib/permissions";
import {
  RoleRuleError,
  applyRole,
  assertSuperAdminsRemain,
  assignBlockReason,
  audit,
  getActor,
  permissionsBeyond,
  userBlockReason,
} from "@/lib/roles";
import { normalizePhone, parseIdentifier, phoneCandidates, PHONE_ACCOUNT_DOMAIN, publicEmail } from "@/lib/validations/auth";

type Ctx = { params: Promise<{ id: string }> };

const isPlaceholder = (email: string) => email.endsWith(`@${PHONE_ACCOUNT_DOMAIN}`);
const placeholderFor = (phone: string) => `${phone.replace(/\D/g, "")}@${PHONE_ACCOUNT_DOMAIN}`;

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, "admin.users.view");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
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
        updatedAt: true,
        lastLoginAt: true,
        posPinHash: true,
        posPinLockedUntil: true,
        permissionOverrides: true,
        _count: { select: { orders: true, reviews: true, addresses: true, sessions: true, posSales: true } },
      },
    });
    if (!user) return notFound("User");

    const [spent, recentOrders, role, rolePermissions, effective, manageReason, lastSession, history, allRoles] = await Promise.all([
      prisma.order.aggregate({ where: { userId: id, paymentStatus: "PAID" }, _sum: { total: true } }),
      prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, orderNumber: true, total: true, status: true, source: true, createdAt: true },
      }),
      resolveUserRole(user),
      getRoleBasePermissions(user),
      getEffectivePermissions(user),
      userBlockReason(actor, user),
      prisma.session.findFirst({ where: { userId: id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.auditLog.findMany({
        where: { entity: "User", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, action: true, createdAt: true, newData: true, user: { select: { id: true, nameEn: true } } },
      }),
      prisma.appRole.findMany({
        orderBy: [{ rank: "desc" }, { sortOrder: "asc" }, { nameEn: "asc" }],
        select: { id: true, key: true, nameEn: true, nameAr: true, color: true, type: true, rank: true, permissions: true },
      }),
    ]);

    const { posPinHash, permissionOverrides, email, ...rest } = user;
    return ok({
      ...rest,
      email: publicEmail(email),
      roleId: role?.id ?? user.roleId,
      appRole: role ? { id: role.id, key: role.key, nameEn: role.nameEn, nameAr: role.nameAr, color: role.color, type: role.type, rank: role.rank } : null,
      posPinSet: posPinHash != null,
      overrides: parseOverrides(permissionOverrides),
      rolePermissions,
      effectivePermissions: effective,
      totalSpent: Number(spent._sum.total ?? 0),
      recentOrders: recentOrders.map((o) => ({ ...o, total: Number(o.total) })),
      lastSessionAt: lastSession?.createdAt ?? null,
      history: history.map((h) => ({ id: h.id, action: h.action, createdAt: h.createdAt, by: h.user, details: h.newData })),
      // What the viewer may do with this account.
      isSelf: actor.id === user.id,
      canManage: manageReason === null,
      manageReason,
      canAssignRoles: actor.permissions.has("admin.users.assign_roles"),
      viewerPermissions: Array.from(actor.permissions),
      roles: allRoles.map((r) => {
        const reason = assignBlockReason(actor, r);
        const permissions = r.key === SUPER_ADMIN_ROLE_KEY ? ALL_PERMISSIONS : sanitizePermissions(r.permissions);
        return { id: r.id, key: r.key, nameEn: r.nameEn, nameAr: r.nameAr, color: r.color, type: r.type, rank: r.rank, permissions, permissionCount: permissions.length, assignable: reason === null, reason };
      }),
    });
  } catch (e) {
    return serverError(e);
  }
}

const updateSchema = z.object({
  nameEn: z.string().trim().min(2, "Enter a name of at least 2 characters").max(120).optional(),
  nameAr: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  roleId: z.string().min(1).optional(),
  /** Older clients: account type; the matching built-in role is used. */
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  overrides: z.object({ grant: z.array(z.string()), revoke: z.array(z.string()) }).optional(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, "admin.users.manage");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);

    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const body = parsed.data;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return notFound("User");

    const isSelf = actor.id === target.id;
    const touchesAccess = body.roleId !== undefined || body.role !== undefined || body.isActive !== undefined || body.overrides !== undefined;

    // Your own account: profile fields only, never your own role, status or permissions.
    if (isSelf && touchesAccess) return error("You can't change your own role, status or permissions.", 403);
    if (!isSelf) {
      const reason = await userBlockReason(actor, target);
      if (reason) return error(reason, 403);
    }

    const data: Prisma.UserUpdateInput = {};
    if (body.nameEn !== undefined) data.nameEn = body.nameEn;
    if (body.nameAr !== undefined) data.nameAr = body.nameAr || null;

    // Contact: keep at least one of a real email or a mobile number.
    let email = target.email;
    let phone = target.phone;
    if (body.phone !== undefined) {
      if (!body.phone) phone = null;
      else {
        const p = normalizePhone(body.phone);
        if (!p) return error("Enter a valid mobile number");
        phone = p;
      }
    }
    if (body.email !== undefined) {
      if (!body.email) email = phone ? placeholderFor(phone) : "";
      else {
        const p = parseIdentifier(body.email);
        if (p.kind !== "email") return error("Enter a valid email");
        email = p.email;
      }
    }
    if (isPlaceholder(email) && phone) email = placeholderFor(phone); // placeholder follows the mobile
    if (!email || (isPlaceholder(email) && !phone)) return error("Keep a mobile number or an email on the account.");
    if (email !== target.email) {
      const clash = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, NOT: { id } }, select: { id: true } });
      if (clash) return error(isPlaceholder(email) ? "That mobile number belongs to another account" : "That email belongs to another account", 409);
      data.email = email;
    }
    if (phone !== target.phone) {
      if (phone) {
        const clash = await prisma.user.findFirst({ where: { phone: { in: phoneCandidates(phone) }, NOT: { id } }, select: { id: true } });
        if (clash) return error("That mobile number belongs to another account", 409);
      }
      data.phone = phone;
    }

    // Role
    let newRole: CachedRole | null = null;
    if (body.roleId !== undefined || body.role !== undefined) {
      if (!actor.permissions.has("admin.users.assign_roles")) return error("You can't change roles.", 403);
      newRole = body.roleId ? await getCachedRole(body.roleId) : await getBuiltInRole(body.role!);
      if (!newRole) return error("That role no longer exists.", 404);
      const current = await resolveUserRole(target);
      if (current?.id === newRole.id && target.role === newRole.type) newRole = null; // no change
      else {
        const block = assignBlockReason(actor, newRole);
        if (block) return error(block, 403);
      }
    }

    // Personal permission overrides
    if (body.overrides !== undefined) {
      if (!actor.permissions.has("admin.users.assign_roles")) return error("You can't change permissions.", 403);
      const o = parseOverrides(body.overrides);
      // No escalation: you can only hand out permissions you hold yourself.
      const beyond = permissionsBeyond(actor, o.grant);
      if (beyond.length) return error(`You can't grant permissions you don't have: ${beyond.join(", ")}`, 403);
      data.permissionOverrides = o.grant.length || o.revoke.length ? o : Prisma.JsonNull;
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const leavesSuper =
      target.role === Role.SUPER_ADMIN && target.isActive && (body.isActive === false || (newRole !== null && newRole.type !== Role.SUPER_ADMIN));

    const updated = await prisma.$transaction(async (tx) => {
      if (leavesSuper) await assertSuperAdminsRemain(tx, [id]);
      const u = await tx.user.update({ where: { id }, data, select: { id: true, role: true, roleId: true, isActive: true } });
      if (newRole) await applyRole(tx, [id], newRole);
      // Deactivation takes effect immediately: sign them out everywhere.
      if (body.isActive === false) await tx.session.deleteMany({ where: { userId: id } });
      return newRole ? { ...u, role: newRole.type, roleId: newRole.id } : u;
    });

    await audit(
      actor.id,
      "user.update",
      "User",
      id,
      { role: target.role, roleId: target.roleId, isActive: target.isActive, permissionOverrides: target.permissionOverrides ?? null },
      {
        ...body,
        ...(newRole && { roleId: newRole.id, roleName: newRole.nameEn }),
      },
      req.headers.get("x-forwarded-for"),
    );

    return ok(updated);
  } catch (e) {
    if (e instanceof RoleRuleError) return error(e.message, e.status);
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, "admin.users.delete");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);

    const { id } = await params;
    if (id === actor.id) return error("You can't delete your own account");
    const target = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { orders: true, posSales: true, posShifts: true, reviews: true } } } });
    if (!target) return notFound("User");
    const reason = await userBlockReason(actor, target);
    if (reason) return error(reason, 403);

    // Accounts with sales history are kept for the books: deactivate them instead.
    if (target._count.orders + target._count.posSales + target._count.posShifts + target._count.reviews > 0) {
      return error("This account has orders, reviews or POS history. Deactivate it instead so records stay intact.", 409);
    }

    await prisma.$transaction(async (tx) => {
      if (target.role === Role.SUPER_ADMIN && target.isActive) await assertSuperAdminsRemain(tx, [id]);
      await tx.user.delete({ where: { id } });
    });
    await audit(actor.id, "user.delete", "User", id, { email: target.email, role: target.role, roleId: target.roleId }, undefined, req.headers.get("x-forwarded-for"));
    return ok({ message: "User deleted" });
  } catch (e) {
    if (e instanceof RoleRuleError) return error(e.message, e.status);
    return serverError(e);
  }
}
