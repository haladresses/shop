import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/api/response";

export async function GET(
  _: NextRequest,
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
    return ok(product);
  } catch (e) {
    return serverError(e);
  }
}
