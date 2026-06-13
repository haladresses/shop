import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { FOOTER_CONFIG_KEY, normalizeFooter } from "@/lib/footer";

/**
 * Public endpoint that returns the storefront footer configuration. Values are
 * stored as a single JSON setting and edited from the admin settings panel.
 */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: FOOTER_CONFIG_KEY },
    });

    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }

    return ok(normalizeFooter(parsed));
  } catch (e) {
    return serverError(e);
  }
}
