import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { NAV_MENU_KEY, normalizeNavItems } from "@/lib/navigation";

/**
 * Public endpoint that returns the header navigation menu. Values are stored
 * as a JSON setting and edited from the admin panel.
 */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: NAV_MENU_KEY } });

    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }

    return ok({ items: normalizeNavItems(parsed) });
  } catch (e) {
    return serverError(e);
  }
}
