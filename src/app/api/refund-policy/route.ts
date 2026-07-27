import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { REFUND_POLICY_KEY, DEFAULT_REFUND_POLICY, normalizeLegalPage } from "@/lib/legalPages";

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: REFUND_POLICY_KEY } });
    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }
    return ok(normalizeLegalPage(parsed, DEFAULT_REFUND_POLICY));
  } catch (e) {
    return serverError(e);
  }
}
