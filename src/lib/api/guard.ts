import type { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/api/response";

type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthFromRequest>>>;

/**
 * Signed-in user holding at least one of `permissions`, or the 401/403
 * response to return. Usage:
 *   const g = await guard(req, "admin.suppliers.view");
 *   if ("res" in g) return g.res;
 */
export async function guard(
  req: NextRequest,
  permissions: string | string[],
): Promise<{ user: AuthUser } | { res: NextResponse }> {
  const user = await getAuthFromRequest(req);
  if (!user) return { res: unauthorized() };
  const list = Array.isArray(permissions) ? permissions : [permissions];
  if (!(await userHasAnyPermission(user, list))) return { res: forbidden() };
  return { user };
}
