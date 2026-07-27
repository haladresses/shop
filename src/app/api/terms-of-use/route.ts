import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { TERMS_OF_USE_KEY, DEFAULT_TERMS_OF_USE, normalizeLegalPage } from "@/lib/legalPages";

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: TERMS_OF_USE_KEY } });
    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }
    return ok(normalizeLegalPage(parsed, DEFAULT_TERMS_OF_USE));
  } catch (e) {
    return serverError(e);
  }
}
