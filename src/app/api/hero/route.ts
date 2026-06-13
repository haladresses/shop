import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import {
  HERO_SLIDES_KEY,
  HERO_FEATURES_KEY,
  normalizeSlides,
  normalizeFeatures,
} from "@/lib/hero";

/**
 * Public endpoint that returns the homepage hero configuration (slides + feature
 * boxes). Values are stored as JSON settings and edited from the admin panel.
 */
export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: [HERO_SLIDES_KEY, HERO_FEATURES_KEY] } },
    });

    const parse = (key: string): unknown => {
      const row = settings.find((s) => s.key === key);
      if (!row) return null;
      try {
        return JSON.parse(row.value);
      } catch {
        return null;
      }
    };

    return ok({
      slides: normalizeSlides(parse(HERO_SLIDES_KEY)),
      features: normalizeFeatures(parse(HERO_FEATURES_KEY)),
    });
  } catch (e) {
    return serverError(e);
  }
}
