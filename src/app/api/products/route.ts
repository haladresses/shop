import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole, isSellerOrAdmin } from "@/lib/auth";
import { ok, paginated, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { slugify } from "@/lib/utils";
import { productSchema } from "@/lib/validations/product";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(50, parseInt(sp.get("pageSize") || "20"));
    const skip = (page - 1) * pageSize;
    const search = sp.get("search") || "";
    const categoryId = sp.get("categoryId") || "";
    const isActive = sp.get("isActive");
    const sellerId = sp.get("sellerId") || "";

    const where = {
      ...(search && {
        OR: [
          { nameEn: { contains: search, mode: "insensitive" as const } },
          { nameAr: { contains: search } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(isActive !== null && isActive !== "" && { isActive: isActive === "true" }),
      ...(sellerId && { sellerId }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { nameEn: true, nameAr: true } },
          images: { where: { isPrimary: true }, take: 1 },
          _count: { select: { variants: true, reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return paginated(products, { page, pageSize, total });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!isSellerOrAdmin(user.role)) return forbidden();

    const body = await req.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.errors[0].message);

    const { variants, ...productData } = parsed.data;

    let slug = slugify(productData.nameEn);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const product = await prisma.product.create({
      data: {
        ...productData,
        slug,
        sellerId: isAdminRole(user.role) ? (body.sellerId || null) : user.id,
        variants: {
          create: variants.map((v) => ({
            color: v.color,
            colorHex: v.colorHex,
            size: v.size,
            sku: v.sku,
            priceAdjustment: v.priceAdjustment,
            isActive: v.isActive,
            inventory: {
              create: { quantity: v.stock, lowStockAlert: 5 },
            },
          })),
        },
      },
      include: {
        variants: { include: { inventory: true } },
        images: true,
      },
    });

    return ok(product, 201);
  } catch (e) {
    return serverError(e);
  }
}
