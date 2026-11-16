import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { error, notFound, ok, serverError } from "@/lib/api/response";
import { SUPER_ADMIN_ROLE_KEY, invalidateRoleCache, sanitizePermissions } from "@/lib/permissions";
import {
  RoleRuleError,
  assignBlockReason,
  audit,
  getActor,
  manageBlockReason,
  nameClash,
  roleFieldsSchema,
  roleInclude,
  roleUserCounts,
  toRoleDTO,
} from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, ["admin.roles.view", "admin.users.view"]);
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);
    const { id } = await params;

    const row = await prisma.appRole.findUnique({ where: { id }, include: roleInclude });
    if (!row) return notFound("Role");
    const counts = await roleUserCounts();
    return ok(toRoleDTO(row, actor, actor.permissions.has("admin.roles.manage"), counts.get(row.id)));
  } catch (e) {
    return serverError(e);
  }
}

const patchSchema = roleFieldsSchema.partial();

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, "admin.roles.manage");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);
    const { id } = await params;

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const body = parsed.data;

    const row = await prisma.appRole.findUnique({ where: { id } });
    if (!row) return notFound("Role");

    const labels = {
      ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
      ...(body.nameAr !== undefined && { nameAr: body.nameAr }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.color !== undefined && { color: body.color }),
    };
    if (labels.nameEn && labels.nameEn.toLowerCase() !== row.nameEn.toLowerCase() && (await nameClash(labels.nameEn, id))) {
      return error("A role with this name already exists.", 409);
    }

    // Super Admin: always everything. A super admin may only relabel it.
    if (row.key === SUPER_ADMIN_ROLE_KEY) {
      if (!actor.isSuper) return error("Only a super admin can change the Super Admin role.", 403);
      if (body.permissions !== undefined || body.type !== undefined || body.rank !== undefined) {
        return error("The Super Admin role always has every permission. Its type and level can't change.", 400);
      }
      const updated = await prisma.appRole.update({ where: { id }, data: labels, include: roleInclude });
      invalidateRoleCache();
      await audit(actor.id, "role.update", "AppRole", id, { nameEn: row.nameEn, color: row.color }, labels, req.headers.get("x-forwarded-for"));
      return ok(toRoleDTO(updated, actor, true, (await roleUserCounts()).get(id)));
    }

    const before = manageBlockReason(actor, row);
    if (before) return error(before, 403);

    if (row.isSystem && ((body.type !== undefined && body.type !== row.type) || (body.rank !== undefined && body.rank !== row.rank))) {
      return error("The type and level of a built-in role can't change.", 400);
    }

    const next = {
      type: body.type ?? row.type,
      rank: body.rank ?? row.rank,
      permissions: body.permissions !== undefined ? sanitizePermissions(body.permissions) : row.permissions,
    };
    // The result must still be something this person could have created.
    if (!actor.isSuper && next.rank >= actor.rank) return error(`Pick a level below your own (${actor.rank}).`, 403);
    const after = manageBlockReason(actor, { ...row, ...next });
    if (after) {
      const beyond = next.permissions.filter((p) => !actor.permissions.has(p));
      return error(beyond.length ? `You can't give permissions you don't have: ${beyond.join(", ")}` : after, 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.appRole.update({ where: { id }, data: { ...labels, ...next }, include: roleInclude });
      // Members' account type follows the role.
      if (next.type !== row.type) await tx.user.updateMany({ where: { roleId: id }, data: { role: next.type } });
      return u;
    });
    invalidateRoleCache();

    const added = next.permissions.filter((p) => !row.permissions.includes(p));
    const removed = row.permissions.filter((p) => !next.permissions.includes(p));
    await audit(
      actor.id,
      "role.update",
      "AppRole",
      id,
      { nameEn: row.nameEn, type: row.type, rank: row.rank },
      { ...labels, type: next.type, rank: next.rank, added, removed },
      req.headers.get("x-forwarded-for"),
    );

    return ok(toRoleDTO(updated, actor, true, (await roleUserCounts()).get(id)));
  } catch (e) {
    return serverError(e);
  }
}

/** Delete a custom role. Members must be moved to `reassignToRoleId` (JSON body or query string). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, "admin.roles.manage");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);
    const { id } = await params;

    const body = (await req.json().catch(() => null)) as { reassignToRoleId?: unknown } | null;
    const reassignToRoleId =
      (typeof body?.reassignToRoleId === "string" ? body.reassignToRoleId : null) || req.nextUrl.searchParams.get("reassignToRoleId");

    const row = await prisma.appRole.findUnique({ where: { id } });
    if (!row) return notFound("Role");
    if (row.isSystem) return error("Built-in roles can't be deleted.", 400);
    const reason = manageBlockReason(actor, row);
    if (reason) return error(reason, 403);

    const memberCount = await prisma.user.count({ where: { roleId: id } });
    let target: { id: string; nameEn: string; type: Role } | null = null;
    if (memberCount > 0) {
      if (!reassignToRoleId) return error(`${memberCount} ${memberCount === 1 ? "person has" : "people have"} this role. Choose a role to move them to.`, 409);
      if (reassignToRoleId === id) return error("Choose a different role to move people to.", 400);
      const t = await prisma.appRole.findUnique({ where: { id: reassignToRoleId } });
      if (!t) return error("The role to move people to no longer exists.", 404);
      const block = assignBlockReason(actor, t);
      if (block) return error(`You can't move people to ${t.nameEn}: ${block}`, 403);
      target = t;
    }

    const moved = await prisma.$transaction(async (tx) => {
      let n = 0;
      if (target) {
        const members = await tx.user.findMany({ where: { roleId: id }, select: { id: true } });
        const ids = members.map((m) => m.id);
        if (ids.includes(actor.id)) throw new RoleRuleError("You hold this role yourself. Ask someone more senior to delete it.", 403);
        n = (await tx.user.updateMany({ where: { id: { in: ids } }, data: { roleId: target.id, role: target.type } })).count;
        await tx.session.deleteMany({ where: { userId: { in: ids } } });
      }
      await tx.appRole.delete({ where: { id } });
      return n;
    });
    invalidateRoleCache();
    await audit(
      actor.id,
      "role.delete",
      "AppRole",
      id,
      { key: row.key, nameEn: row.nameEn, type: row.type, rank: row.rank, permissions: row.permissions },
      target ? { movedTo: target.id, movedToName: target.nameEn, moved } : undefined,
      req.headers.get("x-forwarded-for"),
    );

    return ok({ deleted: true, moved, movedTo: target ? { id: target.id, nameEn: target.nameEn } : null });
  } catch (e) {
    if (e instanceof RoleRuleError) return error(e.message, e.status);
    return serverError(e);
  }
}
