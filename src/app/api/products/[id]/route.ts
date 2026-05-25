import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole, isSellerOrAdmin } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { z } from "zod";

const updateSchema = z.object({
  nameEn: z.string().min(2).optional(),
  nameAr: z.string().min(2).optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().optional(),
  basePrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: {
          include: { inventory: true },
          orderBy: { color: "asc" },
        },
        reviews: {
          where: { isApproved: true },
          include: { user: { select: { nameEn: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        seller: { select: { nameEn: true, email: true } },
      },
    });

    if (!product) return notFound("Product");
    return ok(product);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!isSellerOrAdmin(user.role)) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.errors[0].message);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return notFound("Product");

    if (!isAdminRole(user.role) && product.sellerId !== user.id) return forbidden();

    const updated = await prisma.product.update({ where: { id }, data: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!isSellerOrAdmin(user.role)) return forbidden();

    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return notFound("Product");

    if (!isAdminRole(user.role) && product.sellerId !== user.id) return forbidden();

    await prisma.product.delete({ where: { id } });
    return ok({ message: "Product deleted" });
  } catch (e) {
    return serverError(e);
  }
}
