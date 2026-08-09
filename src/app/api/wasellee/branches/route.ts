import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { z } from "zod";

const branchSchema = z.object({
  cityEn: z.string().min(1),
  cityAr: z.string().min(1),
  regionEn: z.string().min(1),
  regionAr: z.string().min(1),
  phone: z.string().min(4),
  homeDeliveryCost: z.number().min(0),
  officePickupCost: z.number().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  try {
    const branches = await prisma.waselleeBranch.findMany({
      orderBy: [{ regionEn: "asc" }, { sortOrder: "asc" }, { cityEn: "asc" }],
    });
    return ok(branches);
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
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const branch = await prisma.waselleeBranch.create({ data: parsed.data });
    return ok(branch, 201);
  } catch (e) {
    return serverError(e);
  }
}
