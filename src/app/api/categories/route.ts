import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, paginated, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { slugify } from "@/lib/utils";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get("all") === "true";
    const parentOnly = req.nextUrl.searchParams.get("parentOnly") === "true";

    if (all) {
      const categories = await prisma.category.findMany({
        where: { isActive: true, ...(parentOnly && { parentId: null }) },
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
          _count: { select: { products: true } },
        },
      });
      return ok(categories);
    }

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
    const pageSize = 20;
    const skip = (page - 1) * pageSize;
    const search = (req.nextUrl.searchParams.get("search") || "").trim();

    const where = search
      ? {
          OR: [
            { nameEn: { contains: search, mode: "insensitive" as const } },
            { nameAr: { contains: search } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
        include: {
          parent: { select: { nameEn: true, nameAr: true } },
          _count: { select: { products: true, children: true } },
        },
      }),
      prisma.category.count({ where }),
    ]);

    return paginated(categories, { page, pageSize, total });
  } catch (e) {
    return serverError(e);
  }
}

const categorySchema = z.object({
  nameEn: z.string().min(2),
  nameAr: z.string().min(2),
  parentId: z.string().optional().nullable(),
  image: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.categories.manage"))) return forbidden();

    const body = await req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    let slug = slugify(parsed.data.nameEn);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const category = await prisma.category.create({
      data: { ...parsed.data, slug },
    });

    return ok(category, 201);
  } catch (e) {
    return serverError(e);
  }
}
