import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { created, error, notFound, serverError } from "@/lib/api/response";
import { MAX_CUSTOM_RANK, invalidateRoleCache, sanitizePermissions } from "@/lib/permissions";
import { audit, getActor, nameClash, permissionsBeyond, roleInclude, toRoleDTO, uniqueRoleKey } from "@/lib/roles";

/** Copy a role (permissions, type, colour, description) into a new custom role. Optional body: { nameEn }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.roles.manage");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);
    const { id } = await params;

    const src = await prisma.appRole.findUnique({ where: { id } });
    if (!src) return notFound("Role");

    const permissions = sanitizePermissions(src.permissions);
    const beyond = permissionsBeyond(actor, permissions);
    if (beyond.length) return error("This role has permissions you don't have, so you can't copy it.", 403);

    const maxRank = actor.isSuper ? MAX_CUSTOM_RANK : actor.rank - 1;
    if (maxRank < 0) return error("Your level is too low to create roles.", 403);

    const body = (await req.json().catch(() => null)) as { nameEn?: unknown } | null;
    const requested = typeof body?.nameEn === "string" ? body.nameEn.trim() : "";
    let nameEn = requested.length >= 2 ? requested.slice(0, 60) : `${src.nameEn} (copy)`;
    if (await nameClash(nameEn)) {
      if (requested.length >= 2) return error("A role with this name already exists.", 409);
      for (let i = 2; await nameClash(nameEn); i++) nameEn = `${src.nameEn} (copy ${i})`;
    }

    const last = await prisma.appRole.aggregate({ _max: { sortOrder: true } });
    const row = await prisma.appRole.create({
      data: {
        key: await uniqueRoleKey(nameEn),
        nameEn,
        nameAr: src.nameAr,
        description: src.description,
        color: src.color,
        // Only the built-in Super Admin role has the super admin type.
        type: src.type === Role.SUPER_ADMIN ? Role.ADMIN : src.type,
        rank: Math.max(0, Math.min(src.rank, maxRank)),
        permissions,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        createdById: actor.id,
      },
      include: roleInclude,
    });
    invalidateRoleCache();
    await audit(actor.id, "role.duplicate", "AppRole", row.id, { from: src.id, fromName: src.nameEn }, { key: row.key, nameEn: row.nameEn }, req.headers.get("x-forwarded-for"));

    return created(toRoleDTO(row, actor, true, { total: 0, active: 0 }));
  } catch (e) {
    return serverError(e);
  }
}
