import { NextRequest } from "next/server";
import { guard } from "@/lib/api/guard";
import { ok, serverError } from "@/lib/api/response";
import { PERMISSION_CATALOG, permissionKind, permissionRequires } from "@/lib/permissions";

/**
 * The permission catalog, grouped for display: area -> group -> permissions.
 * Each permission says whether it is a "view", "manage" or "access" permission
 * and which other permissions it needs to be useful.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.roles.view", "admin.users.view"]);
    if ("res" in g) return g.res;

    const groups: { group: string; area: string; permissions: ReturnType<typeof describe>[] }[] = [];
    for (const p of PERMISSION_CATALOG) {
      let entry = groups.find((x) => x.group === p.group);
      if (!entry) {
        entry = { group: p.group, area: p.area, permissions: [] };
        groups.push(entry);
      }
      entry.permissions.push(describe(p));
    }
    return ok({ groups, total: PERMISSION_CATALOG.length });
  } catch (e) {
    return serverError(e);
  }
}

function describe(p: (typeof PERMISSION_CATALOG)[number]) {
  return { ...p, kind: permissionKind(p.key), requires: permissionRequires(p.key) };
}
