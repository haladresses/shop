import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { NEWSLETTER_CONFIG_KEY, normalizeNewsletter } from "@/lib/newsletter";

/**
 * Public endpoint that returns the newsletter section copy (shown on the
 * homepage and product detail pages). Values are stored as a JSON setting
 * and edited from the admin panel.
 */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: NEWSLETTER_CONFIG_KEY } });

    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }

    return ok(normalizeNewsletter(parsed));
  } catch (e) {
    return serverError(e);
  }
}
