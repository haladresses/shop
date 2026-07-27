import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { PROMO_BANNER_KEY, normalizePromoTiles } from "@/lib/promoBanner";

/**
 * Public endpoint that returns the homepage promo banner tiles. Values are
 * stored as a JSON setting and edited from the admin panel.
 */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: PROMO_BANNER_KEY } });

    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }

    return ok({ tiles: normalizePromoTiles(parsed) });
  } catch (e) {
    return serverError(e);
  }
}
