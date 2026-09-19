import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

type PosLine = {
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  color: string | null;
  colorParts: unknown;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  unitPrice: number;
  stock: number | null;
  imageUrl: string | null;
};

const PRODUCT_INCLUDE = {
  images: { where: { isPrimary: true }, take: 1 },
  variants: { include: { inventory: true } },
} satisfies Prisma.ProductInclude;

type ProductWithLines = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

function toLines(product: ProductWithLines): PosLine[] {
  const unitBase = Number(product.salePrice ?? product.basePrice);
  const imageUrl = product.images[0]?.url ?? null;
  const activeVariants = product.variants.filter((v) => v.isActive);

  if (activeVariants.length === 0) {
    return [
      {
        productId: product.id,
        variantId: null,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        color: null,
        colorParts: null,
        size: null,
        sku: product.sku,
        barcode: product.barcode,
        unitPrice: unitBase,
        stock: null,
        imageUrl,
      },
    ];
  }

  return activeVariants.map((v) => ({
    productId: product.id,
    variantId: v.id,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    color: v.color,
    colorParts: v.colorParts,
    size: v.size,
    sku: v.sku,
    barcode: v.barcode,
    unitPrice: unitBase + Number(v.priceAdjustment),
    stock: v.inventory?.quantity ?? 0,
    imageUrl,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "pos.access"))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const barcode = (sp.get("barcode") || "").trim();
    const q = (sp.get("q") || "").trim();
    const categoryId = (sp.get("categoryId") || "").trim();
    const color = (sp.get("color") || "").trim();

    if (barcode) {
      const product = await prisma.product.findFirst({
        where: {
          isActive: true,
          OR: [{ barcode }, { variants: { some: { barcode } } }],
        },
        include: PRODUCT_INCLUDE,
      });
      if (!product) return ok([]);

      const lines = toLines(product);
      // A variant-level barcode identifies exactly one line; narrow to it.
      const matched = lines.filter((l) => l.barcode === barcode) ;
      return ok(matched.length > 0 ? matched : lines);
    }

    // Browse/search mode — combines free-text search with category/color
    // filters, or (with none set) just lists the catalogue for browsing.
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId && { categoryId }),
        ...(color && { variants: { some: { isActive: true, color } } }),
        ...(q && {
          OR: [
            { nameEn: { contains: q, mode: "insensitive" } },
            { nameAr: { contains: q } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
            { variants: { some: { barcode: { contains: q, mode: "insensitive" } } } },
          ],
        }),
      },
      include: PRODUCT_INCLUDE,
      orderBy: { nameEn: "asc" },
      take: 40,
    });

    const lines = products.flatMap(toLines);
    return ok(color ? lines.filter((l) => l.color === color) : lines);
  } catch (e) {
    return serverError(e);
  }
}
