import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { getEffectivePermissions } from "@/lib/permissions";

/**
 * Public-safe staff picker for the /pos login screen: names/avatars only,
 * limited to active users who have a PIN set and whose effective permissions
 * (role + personal overrides) include "pos.access". No PIN status, email, or
 * other detail is exposed here.
 */
export async function GET() {
  try {
    const candidates = await prisma.user.findMany({
      where: { isActive: true, posPinHash: { not: null } },
      select: { id: true, nameEn: true, nameAr: true, avatar: true, role: true, roleId: true, permissionOverrides: true },
      orderBy: { nameEn: "asc" },
    });

    const allowed = await Promise.all(candidates.map(async (u) => (await getEffectivePermissions(u)).includes("pos.access")));
    const staff = candidates
      .filter((_, i) => allowed[i])
      .map(({ id, nameEn, nameAr, avatar }) => ({ id, nameEn, nameAr, avatar }));

    return ok(staff);
  } catch (e) {
    return serverError(e);
  }
}
