import { NextRequest } from "next/server";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getWaselleeSettings } from "@/lib/wasellee";
import prisma from "@/lib/db";
import { z } from "zod";

// Admin-only in both directions: this record holds the WAHA API key, which
// must never be exposed through a public endpoint (unlike /api/settings).
const settingsSchema = z.object({
  isNotifyEnabled: z.boolean().optional(),
  companyNameEn: z.string().min(1).optional(),
  companyNameAr: z.string().min(1).optional(),
  brandNameEn: z.string().min(1).optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  bousherOfficePhone: z.string().min(4).optional(),
  bousherContactPhone: z.string().optional(),
  bousherDriverPhone: z.string().optional(),
  notifyChatId: z.string().optional(),
  wahaBaseUrl: z.string().optional(),
  wahaApiKey: z.string().optional(),
  wahaSession: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const settings = await getWaselleeSettings();
    return ok(settings);
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const current = await getWaselleeSettings();
    const settings = await prisma.waselleeSettings.update({
      where: { id: current.id },
      data: parsed.data,
    });
    return ok(settings);
  } catch (e) {
    return serverError(e);
  }
}
