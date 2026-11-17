import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { error, ok, serverError } from "@/lib/api/response";
import { getCachedRole } from "@/lib/permissions";
import { RoleRuleError, applyRole, assertSuperAdminsRemain, assignBlockReason, audit, getActor, userBlockReason } from "@/lib/roles";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one person").max(500, "Select at most 500 people at a time"),
  action: z.enum(["assign_role", "activate", "deactivate"]),
  roleId: z.string().optional(),
});

/**
 * Apply one change to many accounts. Accounts the caller may not manage
 * (their own, or at or above their level) are skipped and listed with the reason.
 * Response: { updated, skipped: [{ id, name, reason }] }.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.users.manage");
    if ("res" in g) return g.res;
    const actor = await getActor(g.user);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { ids, action, roleId } = parsed.data;

    let role = null;
    if (action === "assign_role") {
      if (!actor.permissions.has("admin.users.assign_roles")) return error("You can't change roles.", 403);
      if (!roleId) return error("Choose a role");
      role = await getCachedRole(roleId);
      if (!role) return error("That role no longer exists.", 404);
      const block = assignBlockReason(actor, role);
      if (block) return error(block, 403);
    }

    const targets = await prisma.user.findMany({
      where: { id: { in: Array.from(new Set(ids)) } },
      select: { id: true, nameEn: true, role: true, roleId: true, isActive: true },
    });

    const skipped: { id: string; name: string | null; reason: string }[] = [];
    const allowed: typeof targets = [];
    for (const t of targets) {
      const reason = await userBlockReason(actor, t);
      if (reason) skipped.push({ id: t.id, name: t.nameEn, reason });
      else allowed.push(t);
    }
    const okIds = allowed.map((t) => t.id);

    // Active super admins who'd stop being one.
    const leavingSuper = allowed
      .filter((t) => t.role === Role.SUPER_ADMIN && t.isActive)
      .filter(() => action === "deactivate" || (action === "assign_role" && role!.type !== Role.SUPER_ADMIN))
      .map((t) => t.id);

    const updated = await prisma.$transaction(async (tx) => {
      if (leavingSuper.length) await assertSuperAdminsRemain(tx, leavingSuper);
      if (!okIds.length) return 0;
      if (action === "assign_role") return applyRole(tx, okIds, role!);
      const { count } = await tx.user.updateMany({ where: { id: { in: okIds } }, data: { isActive: action === "activate" } });
      if (action === "deactivate") await tx.session.deleteMany({ where: { userId: { in: okIds } } });
      return count;
    });

    await audit(
      actor.id,
      `user.bulk_${action}`,
      "User",
      null,
      undefined,
      { ids: okIds, ...(role && { roleId: role.id, roleName: role.nameEn }), skipped: skipped.length },
      req.headers.get("x-forwarded-for"),
    );
    // Per-user entries so each account's history shows the change.
    await Promise.all(
      okIds.map((id) =>
        audit(actor.id, "user.update", "User", id, undefined, action === "assign_role" ? { roleId: role!.id, roleName: role!.nameEn } : { isActive: action === "activate" }),
      ),
    );

    for (const id of ids) if (!targets.some((t) => t.id === id)) skipped.push({ id, name: null, reason: "Account not found." });
    return ok({ updated, skipped });
  } catch (e) {
    if (e instanceof RoleRuleError) return error(e.message, e.status);
    return serverError(e);
  }
}
