import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { FAQ_KEY, normalizeFaq } from "@/lib/legalPages";

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: FAQ_KEY } });
    let parsed: unknown = null;
    if (row) {
      try {
        parsed = JSON.parse(row.value);
      } catch {
        parsed = null;
      }
    }
    return ok(normalizeFaq(parsed));
  } catch (e) {
    return serverError(e);
  }
}
