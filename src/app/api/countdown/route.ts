import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { COUNTDOWN_CONFIG_KEY, normalizeCountdown } from "@/lib/countdown";

/**
 * Public endpoint that returns the homepage countdown/deal banner configuration.
 * Values are stored as a JSON setting and edited from the admin panel.
 */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: COUNTDOWN_CONFIG_KEY } });

    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }

    return ok(normalizeCountdown(parsed));
  } catch (e) {
    return serverError(e);
  }
}
