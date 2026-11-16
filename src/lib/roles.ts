import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import {
  ALL_PERMISSIONS,
  BUILTIN_ROLE_KEY,
  MAX_CUSTOM_RANK,
  ROLE_COLORS,
  SUPER_ADMIN_ROLE_KEY,
  getEffectivePermissions,
  getUserRank,
  resolveUserRole,
  sanitizePermissions,
  type PermissionSubject,
} from "@/lib/permissions";

// ─────────────────────────────────────────────
// Who is acting, and what they may do
// ─────────────────────────────────────────────

export type Actor = {
  id: string;
  isSuper: boolean;
  rank: number;
  roleId: string | null;
  permissions: Set<string>;
};

export async function getActor(user: PermissionSubject & { id: string }): Promise<Actor> {
  const [permissions, rank, role] = await Promise.all([getEffectivePermissions(user), getUserRank(user), resolveUserRole(user)]);
  return { id: user.id, isSuper: user.role === Role.SUPER_ADMIN, rank, roleId: role?.id ?? null, permissions: new Set(permissions) };
}

/** Permissions in `list` the actor doesn't hold (super admins hold all). */
export function permissionsBeyond(actor: Actor, list: string[]): string[] {
  if (actor.isSuper) return [];
  return list.filter((p) => !actor.permissions.has(p));
}

type RoleShape = { id?: string; key: string; type: Role; rank: number; permissions: string[] };

/** Why the actor can't give this role to someone, or null when they can. */
export function assignBlockReason(actor: Actor, role: RoleShape): string | null {
  if (role.type === Role.SUPER_ADMIN) return actor.isSuper ? null : "Only a super admin can give the Super Admin role.";
  if (actor.isSuper) return null;
  if (role.rank >= actor.rank) return "This role is at or above your own level.";
  if (permissionsBeyond(actor, role.permissions).length) return "This role has permissions you don't have.";
  return null;
}

/** Why the actor can't edit or delete this role, or null when they can (admin.roles.manage is checked separately). */
export function manageBlockReason(actor: Actor, role: RoleShape): string | null {
  if (role.key === SUPER_ADMIN_ROLE_KEY) return "The Super Admin role always has every permission.";
  if (actor.isSuper) return null;
  if (role.id && actor.roleId === role.id) return "You can't edit your own role.";
  if (role.rank >= actor.rank) return "This role is at or above your own level.";
  if (permissionsBeyond(actor, role.permissions).length) return "This role has permissions you don't have.";
  return null;
}

/** Why the actor can't manage this account (edit, sign out, reset, delete), or null when they can. */
export async function userBlockReason(actor: Actor, target: { id: string; role: Role; roleId: string | null }): Promise<string | null> {
  if (actor.id === target.id) return "You can't change your own access.";
  if (actor.isSuper) return null;
  if (target.role === Role.SUPER_ADMIN) return "Only a super admin can manage a super admin.";
  if ((await getUserRank(target)) >= actor.rank) return "This account is at or above your own level.";
  return null;
}

export async function canManageUser(actor: Actor, target: { id: string; role: Role; roleId: string | null }): Promise<boolean> {
  return (await userBlockReason(actor, target)) === null;
}

// ─────────────────────────────────────────────
// Rule errors raised inside transactions
// ─────────────────────────────────────────────

export class RoleRuleError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

/**
 * Refuse a change that would leave no active super admin. Locks the super
 * admin rows, so two concurrent demotions can't both pass. Use inside a
 * transaction, before the change is written.
 */
export async function assertSuperAdminsRemain(tx: Prisma.TransactionClient, leavingIds: string[]) {
  if (!leavingIds.length) return;
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND "isActive" = true FOR UPDATE`;
  const leaving = new Set(leavingIds);
  if (rows.length > 0 && rows.every((r) => leaving.has(r.id))) {
    throw new RoleRuleError("This is the last active super admin. Make someone else a super admin first.");
  }
}

/** Give users a role: account type follows the role, and they're signed out so it applies everywhere. */
export async function applyRole(tx: Prisma.TransactionClient, userIds: string[], role: { id: string; type: Role }) {
  if (!userIds.length) return 0;
  const { count } = await tx.user.updateMany({ where: { id: { in: userIds } }, data: { roleId: role.id, role: role.type } });
  await tx.session.deleteMany({ where: { userId: { in: userIds } } });
  return count;
}

// ─────────────────────────────────────────────
// Validation & presentation
// ─────────────────────────────────────────────

export const CUSTOM_ROLE_TYPES = [Role.ADMIN, Role.STAFF, Role.SELLER, Role.CUSTOMER] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const roleFieldsSchema = z.object({
  nameEn: z.string().trim().min(2, "Enter a name of at least 2 characters").max(60, "Name is too long"),
  nameAr: optionalText(60),
  description: optionalText(300),
  color: z.string().refine((c) => (ROLE_COLORS as readonly string[]).includes(c), "Pick one of the colours"),
  type: z.enum(CUSTOM_ROLE_TYPES, { message: "Pick an account type" }),
  rank: z.number().int().min(0, "Level can't be below 0").max(MAX_CUSTOM_RANK, `Level can't be above ${MAX_CUSTOM_RANK}`),
  permissions: z.array(z.string()).max(1000),
});

/** A unique, readable key from the English name. */
export async function uniqueRoleKey(name: string, tx: Prisma.TransactionClient = prisma): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "role";
  const taken = new Set((await tx.appRole.findMany({ where: { key: { startsWith: base } }, select: { key: true } })).map((r) => r.key));
  const reserved = new Set(Object.values(BUILTIN_ROLE_KEY));
  if (!taken.has(base) && !reserved.has(base)) return base;
  for (let i = 2; ; i++) {
    const k = `${base}_${i}`;
    if (!taken.has(k)) return k;
  }
}

/** A name not used by another role (case-insensitive), or null if taken. */
export async function nameClash(nameEn: string, exceptId?: string): Promise<boolean> {
  const hit = await prisma.appRole.findFirst({
    where: { nameEn: { equals: nameEn.trim(), mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  return !!hit;
}

/** Users per role id. Users without a role count toward the built-in role for their account type. */
export async function roleUserCounts(): Promise<Map<string, { total: number; active: number }>> {
  const [byRole, unassigned, builtins] = await Promise.all([
    prisma.user.groupBy({ by: ["roleId", "isActive"], where: { roleId: { not: null } }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role", "isActive"], where: { roleId: null }, _count: { _all: true } }),
    prisma.appRole.findMany({ where: { key: { in: Object.values(BUILTIN_ROLE_KEY) } }, select: { id: true, key: true } }),
  ]);
  const counts = new Map<string, { total: number; active: number }>();
  const add = (id: string, n: number, active: boolean) => {
    const c = counts.get(id) ?? { total: 0, active: 0 };
    c.total += n;
    if (active) c.active += n;
    counts.set(id, c);
  };
  for (const r of byRole) if (r.roleId) add(r.roleId, r._count._all, r.isActive);
  for (const r of unassigned) {
    const b = builtins.find((x) => x.key === BUILTIN_ROLE_KEY[r.role]);
    if (b) add(b.id, r._count._all, r.isActive);
  }
  return counts;
}

/** Where-clause for "users holding this role" (including unassigned users of a built-in role's type). */
export function roleMembersWhere(role: { id: string; key: string; type: Role; isSystem: boolean }): Prisma.UserWhereInput {
  const isBuiltIn = role.isSystem && BUILTIN_ROLE_KEY[role.type] === role.key;
  return isBuiltIn ? { OR: [{ roleId: role.id }, { roleId: null, role: role.type }] } : { roleId: role.id };
}

export type RoleRow = Prisma.AppRoleGetPayload<{ include: { createdBy: { select: { id: true; nameEn: true } } } }>;

export function toRoleDTO(row: RoleRow, actor: Actor, canManageRoles: boolean, counts?: { total: number; active: number }) {
  const isSuperRole = row.key === SUPER_ADMIN_ROLE_KEY;
  const permissions = isSuperRole ? ALL_PERMISSIONS : sanitizePermissions(row.permissions);
  const manageReason = canManageRoles ? manageBlockReason(actor, row) : "You don't have permission to manage roles.";
  return {
    id: row.id,
    key: row.key,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    description: row.description,
    color: row.color,
    type: row.type,
    permissions,
    permissionCount: permissions.length,
    isSystem: row.isSystem,
    rank: row.rank,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy ? { id: row.createdBy.id, nameEn: row.createdBy.nameEn } : null,
    userCount: counts?.total ?? 0,
    activeUserCount: counts?.active ?? 0,
    /** Permissions, type and level can be changed by this viewer. */
    editable: manageReason === null,
    /** Name, colour and description can be changed (super admins may relabel the Super Admin role). */
    labelsEditable: manageReason === null || (isSuperRole && canManageRoles && actor.isSuper),
    deletable: manageReason === null && !row.isSystem,
    lockedReason: manageReason,
    assignable: assignBlockReason(actor, row) === null,
    assignReason: assignBlockReason(actor, row),
  };
}

export const roleInclude = { createdBy: { select: { id: true, nameEn: true } } } as const;

export async function audit(actorId: string, action: string, entity: string, entityId: string | null, oldData?: unknown, newData?: unknown, ip?: string | null) {
  await prisma.auditLog
    .create({
      data: {
        userId: actorId,
        action,
        entity,
        entityId,
        oldData: (oldData ?? undefined) as Prisma.InputJsonValue | undefined,
        newData: (newData ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: ip ?? null,
      },
    })
    .catch(() => {});
}
