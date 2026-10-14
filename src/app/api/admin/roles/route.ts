import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  PERMISSION_CATALOG,
  ROLE_LABELS,
  ROLE_ORDER,
  canAssignRole,
  getEffectivePermissions,
  getRolePermissionsMatrix,
  normalizeRolePermissions,
  saveRolePermissionsMatrix,
} from "@/lib/permissions";

async function buildPayload(matrix: Awaited<ReturnType<typeof getRolePermissionsMatrix>>, actor: { role: Role }) {
  const counts = await prisma.user.groupBy({ by: ["role"], _count: true });
  return {
    roles: ROLE_ORDER.map((role) => ({
      key: role,
      labelEn: ROLE_LABELS[role].en,
      labelAr: ROLE_LABELS[role].ar,
      // Super admin always has everything; others only below the editor's own rank.
      editable: role !== Role.SUPER_ADMIN && canAssignRole(actor, role),
      users: counts.find((c) => c.role === role)?._count ?? 0,
    })),
    permissions: PERMISSION_CATALOG,
    matrix,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.roles.view"))) return forbidden();

    return ok(await buildPayload(await getRolePermissionsMatrix(), user));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.roles.manage"))) return forbidden();

    const body = await req.json();
    if (!body || typeof body !== "object" || !("matrix" in body)) return error("Invalid body");

    const current = await getRolePermissionsMatrix();
    const requested = normalizeRolePermissions((body as { matrix: unknown }).matrix);
    const mine = await getEffectivePermissions(user);

    const next = { ...current };
    for (const role of ROLE_ORDER) {
      if (role === Role.SUPER_ADMIN || !canAssignRole(user, role)) continue; // locked for this editor
      const added = requested[role].filter((p) => !current[role].includes(p));
      const notMine = added.filter((p) => !mine.includes(p));
      if (notMine.length) return error(`You can't grant permissions you don't have: ${notMine.join(", ")}`, 403);
      next[role] = requested[role];
    }
    next.SUPER_ADMIN = PERMISSION_CATALOG.map((item) => item.key).sort();

    const saved = await saveRolePermissionsMatrix(next);
    await prisma.auditLog.create({ data: { userId: user.id, action: "roles.update", entity: "Role", newData: saved } }).catch(() => {});
    return ok(await buildPayload(saved, user));
  } catch (e) {
    return serverError(e);
  }
}
