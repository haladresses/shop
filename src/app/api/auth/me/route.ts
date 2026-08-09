import { getCurrentUserWithPermissions } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await getCurrentUserWithPermissions();
    if (!user) return unauthorized();
    return ok(user);
  } catch (e) {
    return serverError(e);
  }
}
