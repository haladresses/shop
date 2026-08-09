import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, paginated, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { z } from "zod";

const couponSchema = z.object({
  code: z.string().min(3).toUpperCase(),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().positive(),
  minOrder: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.coupons.view"))) return forbidden();

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.coupon.count(),
    ]);

    return paginated(coupons, { page, pageSize, total });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.coupons.manage"))) return forbidden();

    const body = await req.json();
    const parsed = couponSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const existing = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
    if (existing) return error("Coupon code already exists");

    const coupon = await prisma.coupon.create({
      data: {
        ...parsed.data,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });

    return ok(coupon, 201);
  } catch (e) {
    return serverError(e);
  }
}
