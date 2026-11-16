import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { created, error, ok, serverError } from "@/lib/api/response";
import { MAX_CUSTOM_RANK, ROLE_COLORS, invalidateRoleCache, sanitizePermissions } from "@/lib/permissions";
import {
  audit,
  getActor,
  nameClash,
  permissionsBeyond,
  roleFieldsSchema,
  roleInclude,
  roleUserCounts,
  toRoleDTO,
  uniqueRoleKey,
} from "@/lib/roles";

/** All roles (most senior first) with member counts and what the viewer may do with each. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.roles.view", "admin.users.view"]);
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);
    const canManageRoles = actor.permissions.has("admin.roles.manage");

    const [rows, counts] = await Promise.all([
      prisma.appRole.findMany({ include: roleInclude, orderBy: [{ rank: "desc" }, { sortOrder: "asc" }, { nameEn: "asc" }] }),
      roleUserCounts(),
    ]);

    return ok({
      roles: rows.map((r) => toRoleDTO(r, actor, canManageRoles, counts.get(r.id))),
      viewer: {
        isSuper: actor.isSuper,
        rank: actor.rank,
        roleId: actor.roleId,
        canManageRoles,
        // The highest level this viewer may give a new role.
        maxRank: actor.isSuper ? MAX_CUSTOM_RANK : Math.min(MAX_CUSTOM_RANK, actor.rank - 1),
        permissions: Array.from(actor.permissions),
      },
      colors: ROLE_COLORS,
    });
  } catch (e) {
    return serverError(e);
  }
}

/** Create a custom role. */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.roles.manage");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);

    const parsed = roleFieldsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const body = parsed.data;
    const permissions = sanitizePermissions(body.permissions);

    if (!actor.isSuper && body.rank >= actor.rank) return error(`Pick a level below your own (${actor.rank}).`, 403);
    const beyond = permissionsBeyond(actor, permissions);
    if (beyond.length) return error(`You can't give permissions you don't have: ${beyond.join(", ")}`, 403);
    if (await nameClash(body.nameEn)) return error("A role with this name already exists.", 409);

    const last = await prisma.appRole.aggregate({ _max: { sortOrder: true } });
    const row = await prisma.appRole.create({
      data: {
        key: await uniqueRoleKey(body.nameEn),
        nameEn: body.nameEn,
        nameAr: body.nameAr,
        description: body.description,
        color: body.color,
        type: body.type,
        rank: body.rank,
        permissions,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        createdById: actor.id,
      },
      include: roleInclude,
    });
    invalidateRoleCache();
    await audit(actor.id, "role.create", "AppRole", row.id, undefined, { key: row.key, nameEn: row.nameEn, type: row.type, rank: row.rank, permissions }, req.headers.get("x-forwarded-for"));

    return created(toRoleDTO(row, actor, true, { total: 0, active: 0 }));
  } catch (e) {
    return serverError(e);
  }
}
