import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { ROLE_PERMISSIONS_SETTING_KEY } from "@/lib/permissions";
import { THAWANI_SETTINGS_KEY } from "@/lib/paymentGateway";

export async function GET(req: NextRequest) {
  try {
    const group = req.nextUrl.searchParams.get("group") || "";
    const user = await getAuthFromRequest(req);
    const canManageSettings = user ? await userHasPermission(user, "admin.settings.manage") : false;

    if (["payments", "security"].includes(group) && !canManageSettings) {
      return forbidden();
    }

    const settings = await prisma.setting.findMany({
      where: group
        ? { group }
        : canManageSettings
          ? {}
          : { NOT: { key: { in: [ROLE_PERMISSIONS_SETTING_KEY, THAWANI_SETTINGS_KEY] } } },
      orderBy: [{ group: "asc" }, { key: "asc" }],
    });

    const map = settings.reduce(
      (acc, s) => {
        acc[s.key] = s.type === "json" ? JSON.parse(s.value) : s.value;
        return acc;
      },
      {} as Record<string, unknown>
    );

    return ok(map);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.settings.manage"))) return forbidden();

    const body = await req.json();
    if (!body || typeof body !== "object") return error("Invalid body");

    const updates = Object.entries(body as Record<string, unknown>).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: {
          value: typeof value === "object" ? JSON.stringify(value) : String(value),
          type: typeof value === "object" ? "json" : typeof value,
        },
        create: {
          key,
          value: typeof value === "object" ? JSON.stringify(value) : String(value),
          type: typeof value === "object" ? "json" : typeof value,
        },
      })
    );

    await Promise.all(updates);
    return ok({ message: "Settings updated" });
  } catch (e) {
    return serverError(e);
  }
}
