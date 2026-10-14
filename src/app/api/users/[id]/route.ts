import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { canAssignRole, canManageUser, getEffectivePermissions, getPermissionsForRole, parseOverrides, PERMISSION_CATALOG, ROLE_ORDER } from "@/lib/permissions";
import { normalizePhone, parseIdentifier, phoneCandidates, publicEmail } from "@/lib/validations/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.view"))) return forbidden();

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
        isActive: true,
        avatar: true,
        createdAt: true,
        lastLoginAt: true,
        posPinHash: true,
        permissionOverrides: true,
        _count: { select: { orders: true, reviews: true, addresses: true, sessions: true } },
      },
    });
    if (!user) return notFound("User");

    const [spent, recentOrders, rolePermissions, effective] = await Promise.all([
      prisma.order.aggregate({ where: { userId: id, paymentStatus: "PAID" }, _sum: { total: true } }),
      prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, orderNumber: true, total: true, status: true, source: true, createdAt: true },
      }),
      getPermissionsForRole(user.role),
      getEffectivePermissions(user),
    ]);

    const { posPinHash, permissionOverrides, email, ...rest } = user;
    return ok({
      ...rest,
      email: publicEmail(email),
      posPinSet: posPinHash != null,
      overrides: parseOverrides(permissionOverrides),
      rolePermissions,
      effectivePermissions: effective,
      totalSpent: Number(spent._sum.total ?? 0),
      recentOrders: recentOrders.map((o) => ({ ...o, total: Number(o.total) })),
      canManage: canManageUser(admin, user),
      isSelf: admin.id === user.id,
      // What the viewer is allowed to do with this account.
      assignableRoles: ROLE_ORDER.filter((r) => canAssignRole(admin, r)),
      viewerPermissions: await getEffectivePermissions(admin),
      catalog: PERMISSION_CATALOG.filter((p) => p.area !== "system" || p.key.startsWith("panel.")),
    });
  } catch (e) {
    return serverError(e);
  }
}

const updateSchema = z.object({
  nameEn: z.string().trim().min(2).optional(),
  nameAr: z.string().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  overrides: z.object({ grant: z.array(z.string()), revoke: z.array(z.string()) }).optional(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.manage"))) return forbidden();

    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const body = parsed.data;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return notFound("User");

    const isSelf = admin.id === target.id;
    const touchesAccess = body.role !== undefined || body.isActive !== undefined || body.overrides !== undefined;

    // Your own account: profile fields only — never your own role, status or permissions.
    if (isSelf && touchesAccess) return error("You can't change your own role, status or permissions.", 403);
    if (!isSelf && !canManageUser(admin, target)) return error("You can't edit an account at or above your own level.", 403);

    const data: Prisma.UserUpdateInput = {};
    if (body.nameEn !== undefined) data.nameEn = body.nameEn;
    if (body.nameAr !== undefined) data.nameAr = body.nameAr || null;

    if (body.email !== undefined && body.email) {
      const p = parseIdentifier(body.email);
      if (p.kind !== "email") return error("Enter a valid email");
      const clash = await prisma.user.findFirst({ where: { email: { equals: p.email, mode: "insensitive" }, NOT: { id } } });
      if (clash) return error("That email belongs to another account", 409);
      data.email = p.email;
    }
    if (body.phone !== undefined) {
      if (!body.phone) data.phone = null;
      else {
        const phone = normalizePhone(body.phone);
        if (!phone) return error("Enter a valid mobile number");
        const clash = await prisma.user.findFirst({ where: { phone: { in: phoneCandidates(phone) }, NOT: { id } } });
        if (clash) return error("That mobile number belongs to another account", 409);
        data.phone = phone;
      }
    }

    if (body.role !== undefined && body.role !== target.role) {
      if (!(await userHasPermission(admin, "admin.users.assign_roles"))) return error("You can't change roles.", 403);
      if (!canAssignRole(admin, body.role)) return error("You can't give that role.", 403);
      if (target.role === Role.SUPER_ADMIN) {
        const supers = await prisma.user.count({ where: { role: Role.SUPER_ADMIN, isActive: true } });
        if (supers <= 1) return error("This is the last super admin — promote someone else first.", 409);
      }
      data.role = body.role;
    }

    if (body.isActive === false && target.role === Role.SUPER_ADMIN) {
      const supers = await prisma.user.count({ where: { role: Role.SUPER_ADMIN, isActive: true } });
      if (supers <= 1) return error("You can't deactivate the last super admin.", 409);
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;

    if (body.overrides !== undefined) {
      if (!(await userHasPermission(admin, "admin.users.assign_roles"))) return error("You can't change permissions.", 403);
      const o = parseOverrides(body.overrides);
      // No escalation: you can only hand out permissions you hold yourself.
      const mine = await getEffectivePermissions(admin);
      const notMine = o.grant.filter((p) => !mine.includes(p));
      if (notMine.length) return error(`You can't grant permissions you don't have: ${notMine.join(", ")}`, 403);
      data.permissionOverrides = o.grant.length || o.revoke.length ? o : Prisma.JsonNull;
    }

    const updated = await prisma.user.update({ where: { id }, data, select: { id: true, role: true, isActive: true } });

    // A role change or deactivation takes effect immediately: sign them out everywhere.
    if ((data.role && data.role !== target.role) || body.isActive === false) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    await prisma.auditLog
      .create({
        data: {
          userId: admin.id,
          action: "user.update",
          entity: "User",
          entityId: id,
          oldData: { role: target.role, isActive: target.isActive, permissionOverrides: target.permissionOverrides ?? null } as Prisma.InputJsonValue,
          newData: body as Prisma.InputJsonValue,
          ip: req.headers.get("x-forwarded-for") ?? null,
        },
      })
      .catch(() => {});

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.delete"))) return forbidden();

    const { id } = await params;
    if (id === admin.id) return error("You can't delete your own account");
    const target = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { orders: true, posSales: true, posShifts: true, reviews: true } } } });
    if (!target) return notFound("User");
    if (!canManageUser(admin, target)) return error("You can't delete an account at or above your own level.", 403);

    // Accounts with sales history are kept for the books — deactivate them instead.
    if (target._count.orders + target._count.posSales + target._count.posShifts + target._count.reviews > 0) {
      return error("This account has orders, reviews or POS history. Deactivate it instead so records stay intact.", 409);
    }

    await prisma.user.delete({ where: { id } });
    await prisma.auditLog
      .create({ data: { userId: admin.id, action: "user.delete", entity: "User", entityId: id, oldData: { email: target.email, role: target.role } } })
      .catch(() => {});
    return ok({ message: "User deleted" });
  } catch (e) {
    return serverError(e);
  }
}
