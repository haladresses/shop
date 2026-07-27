import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { PRIVACY_POLICY_KEY, DEFAULT_PRIVACY_POLICY, normalizeLegalPage } from "@/lib/legalPages";

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: PRIVACY_POLICY_KEY } });
    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }
    return ok(normalizeLegalPage(parsed, DEFAULT_PRIVACY_POLICY));
  } catch (e) {
    return serverError(e);
  }
}
