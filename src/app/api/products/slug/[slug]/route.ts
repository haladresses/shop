import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { canViewCost, withoutCost } from "@/lib/productCost";
import { ok, notFound, serverError } from "@/lib/api/response";
import { withEffectiveCategoryAttributes } from "@/lib/categorySpecs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const product = await prisma.product.findUnique({
      where: { slug },
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
    // Specification fields include those inherited from parent categories.
    const full = await withEffectiveCategoryAttributes(product);
    return ok((await canViewCost(req)) ? full : withoutCost(full));
  } catch (e) {
    return serverError(e);
  }
}
