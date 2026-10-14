import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { normalizeWhatsApp, WHATSAPP_WIDGET_KEY } from "@/lib/whatsapp";

/** Public: WhatsApp chat popup config (no secrets). Edited via /api/settings. */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: WHATSAPP_WIDGET_KEY } });
    let raw: unknown = null;
    try {
      raw = row ? JSON.parse(row.value) : null;
    } catch {
      raw = null;
    }
    return ok(normalizeWhatsApp(raw));
  } catch (e) {
    return serverError(e);
  }
}
