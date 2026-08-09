import { NextRequest } from "next/server";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  PERMISSION_CATALOG,
  ROLE_LABELS,
  ROLE_ORDER,
  getRolePermissionsMatrix,
  normalizeRolePermissions,
  saveRolePermissionsMatrix,
} from "@/lib/permissions";

function buildPayload(matrix: Awaited<ReturnType<typeof getRolePermissionsMatrix>>) {
  return {
    roles: ROLE_ORDER.map((role) => ({
      key: role,
      labelEn: ROLE_LABELS[role].en,
      labelAr: ROLE_LABELS[role].ar,
      editable: role !== "SUPER_ADMIN",
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

    const matrix = await getRolePermissionsMatrix();
    return ok(buildPayload(matrix));
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

    const matrix = normalizeRolePermissions((body as { matrix: unknown }).matrix);
    matrix.SUPER_ADMIN = PERMISSION_CATALOG.map((item) => item.key).sort();

    const saved = await saveRolePermissionsMatrix(matrix);
    return ok(buildPayload(saved));
  } catch (e) {
    return serverError(e);
  }
}