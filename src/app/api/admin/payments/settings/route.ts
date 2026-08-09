import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  getThawaniSettings,
  saveThawaniSettings,
  saveThawaniSettingsTestMeta,
  normalizeThawaniSettings,
  testThawaniSettingsConnection,
} from "@/lib/paymentGateway";

const thawaniSettingsSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["uat", "production"]),
  secretKey: z.string().trim(),
  publishableKey: z.string().trim(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.payments.manage"))) return forbidden();

    return ok(await getThawaniSettings());
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.payments.manage"))) return forbidden();

    const body = await req.json();
    const parsed = thawaniSettingsSchema.safeParse(normalizeThawaniSettings(body));
    if (!parsed.success) return error(parsed.error.issues[0].message);

    if (parsed.data.enabled && (!parsed.data.secretKey || !parsed.data.publishableKey)) {
      return error("Secret key and publishable key are required when Thawani is enabled.");
    }

    return ok(await saveThawaniSettings(parsed.data));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.payments.manage"))) return forbidden();

    const body = await req.json();
    const parsed = thawaniSettingsSchema.safeParse(normalizeThawaniSettings(body));
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const result = await testThawaniSettingsConnection(parsed.data);
    await saveThawaniSettingsTestMeta(result);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}