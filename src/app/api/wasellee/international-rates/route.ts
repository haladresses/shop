import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { z } from "zod";

const rateSchema = z.object({
  countryEn: z.string().min(1),
  countryAr: z.string().min(1),
  countryCode: z.string().min(2).max(3).toUpperCase(),
  baseWeightKg: z.number().positive(),
  baseCost: z.number().min(0),
  additionalKgCost: z.number().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  try {
    const rates = await prisma.waselleeInternationalRate.findMany({
      orderBy: [{ sortOrder: "asc" }, { countryEn: "asc" }],
    });
    return ok(rates);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.shipping.manage"))) return forbidden();

    const body = await req.json();
    const parsed = rateSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const existing = await prisma.waselleeInternationalRate.findUnique({
      where: { countryCode: parsed.data.countryCode },
    });
    if (existing) return error("Country already has a rate configured");

    const rate = await prisma.waselleeInternationalRate.create({ data: parsed.data });
    return ok(rate, 201);
  } catch (e) {
    return serverError(e);
  }
}
