import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { TESTIMONIALS_KEY, normalizeTestimonials } from "@/lib/testimonials";

/**
 * Public endpoint that returns the homepage testimonials list. Values are
 * stored as a JSON setting and edited from the admin panel.
 */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: TESTIMONIALS_KEY } });

    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }

    return ok({ items: normalizeTestimonials(parsed) });
  } catch (e) {
    return serverError(e);
  }
}
