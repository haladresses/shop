import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { getRolePermissionsMatrix, ROLE_ORDER } from "@/lib/permissions";

/**
 * Public-safe staff picker for the /pos login screen: names/avatars only,
 * limited to active users whose role currently has "pos.access" and who
 * have a PIN set. No PIN status, email, or other detail is exposed here.
 */
export async function GET() {
  try {
    const matrix = await getRolePermissionsMatrix();
    const eligibleRoles = ROLE_ORDER.filter((role) => matrix[role]?.includes("pos.access"));
    if (eligibleRoles.length === 0) return ok([]);

    const staff = await prisma.user.findMany({
      where: {
        role: { in: eligibleRoles },
        isActive: true,
        posPinHash: { not: null },
      },
      select: { id: true, nameEn: true, nameAr: true, avatar: true },
      orderBy: { nameEn: "asc" },
    });

    return ok(staff);
  } catch (e) {
    return serverError(e);
  }
}
