import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { productUpdateSchema } from "@/lib/validations/product";
import { Prisma } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            attributes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          },
        },
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
    if (!(await userHasAnyPermission(user, ["admin.products.manage", "seller.products.manage"]))) {
      return forbidden();
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return notFound("Product");

    if (!(await userHasPermission(user, "admin.products.manage")) && product.sellerId !== user.id) {
      return forbidden();
    }

    const { images, variants, attributes, ...scalar } = parsed.data;

    const data: Prisma.ProductUpdateInput = { ...scalar };

    if (attributes !== undefined) {
      data.attributes =
        attributes && Object.keys(attributes).length
          ? (attributes as Prisma.InputJsonValue)
          : Prisma.JsonNull;
    }

    // Replace images when an explicit images array is provided.
    if (images !== undefined) {
      data.images = {
        deleteMany: {},
        create: images.map((img, i) => ({
          url: img.url,
          isPrimary: img.isPrimary || i === 0,
          sortOrder: img.sortOrder ?? i,
        })),
      };
    }

    // Replace variants (and their inventory) when an explicit array is provided.
    if (variants !== undefined) {
      data.variants = {
        deleteMany: {},
        create: variants.map((v) => ({
          color: v.color,
          colorHex: v.colorHex,
          size: v.size,
          sku: v.sku,
          priceAdjustment: v.priceAdjustment,
          isActive: v.isActive,
          inventory: { create: { quantity: v.stock, lowStockAlert: 5 } },
        })),
      };
    }

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: { include: { inventory: true } },
      },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["admin.products.manage", "seller.products.manage"]))) {
      return forbidden();
    }

    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return notFound("Product");

    if (!(await userHasPermission(user, "admin.products.manage")) && product.sellerId !== user.id) {
      return forbidden();
    }

    await prisma.product.delete({ where: { id } });
    return ok({ message: "Product deleted" });
  } catch (e) {
    return serverError(e);
  }
}
