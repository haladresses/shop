import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, hashPassword, userHasPermission } from "@/lib/auth";
import { ok, paginated, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getPaginationParams } from "@/lib/utils";
import { Role } from "@prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.users.view"))) return forbidden();

    const { page, pageSize, skip } = getPaginationParams(req.nextUrl.searchParams);
    const search = req.nextUrl.searchParams.get("search") || "";
    const role = req.nextUrl.searchParams.get("role") as Role | null;

    const where = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { nameEn: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
        ],
      }),
      ...(role && { role }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          phone: true,
          nameEn: true,
          nameAr: true,
          role: true,
          isActive: true,
          avatar: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginated(users, { page, pageSize, total });
  } catch (e) {
    return serverError(e);
  }
}

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nameEn: z.string().min(2),
  nameAr: z.string().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role).default(Role.CUSTOMER),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.manage"))) return forbidden();

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const { email, password, nameEn, nameAr, phone, role } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
    });
    if (existing) return error("Email or phone already in use");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, nameEn, nameAr, phone, role },
      select: { id: true, email: true, nameEn: true, role: true, createdAt: true },
    });

    return ok(user, 201);
  } catch (e) {
    return serverError(e);
  }
}
