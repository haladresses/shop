import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";
import { resolveProductTaxRates } from "@/lib/tax";
import { categoryAncestry } from "@/lib/promotions";
import { NO_TAX, type RateInfo } from "@/lib/taxCalc";

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
  // For the POS cart's live pricing (same engine as the server):
  tax: RateInfo;
  categoryIds: string[];
  onSale: boolean;
};

type Pricing = { rates: Map<string, RateInfo>; ancestry: Map<string, string[]> };

async function pricingFor(products: { id: string }[]): Promise<Pricing> {
  const [rates, ancestry] = await Promise.all([resolveProductTaxRates(products.map((p) => p.id)), categoryAncestry()]);
  return { rates, ancestry };
}

const PRODUCT_INCLUDE = {
  images: { where: { isPrimary: true }, take: 1 },
  variants: { include: { inventory: true } },
} satisfies Prisma.ProductInclude;

type ProductWithLines = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

function toLines(product: ProductWithLines, pricing: Pricing): PosLine[] {
  const unitBase = Number(product.salePrice ?? product.basePrice);
  const imageUrl = product.images[0]?.url ?? null;
  const activeVariants = product.variants.filter((v) => v.isActive);
  const shared = {
    tax: pricing.rates.get(product.id) ?? NO_TAX,
    categoryIds: pricing.ancestry.get(product.categoryId) ?? [product.categoryId],
    onSale: product.salePrice != null && Number(product.salePrice) < Number(product.basePrice),
  };

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
        ...shared,
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
    unitPrice: Math.round((unitBase + Number(v.priceAdjustment)) * 1000) / 1000,
    stock: v.inventory?.quantity ?? 0,
    imageUrl,
    ...shared,
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
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const inStockOnly = sp.get("inStock") === "true";
    const PAGE_SIZE = 36;

    if (barcode) {
      const product = await prisma.product.findFirst({
        where: {
          isActive: true,
          OR: [{ barcode }, { variants: { some: { barcode } } }],
        },
        include: PRODUCT_INCLUDE,
      });
      if (!product) return ok([]);

      const lines = toLines(product, await pricingFor([product]));
      // A variant-level barcode identifies exactly one line; narrow to it.
      const matched = lines.filter((l) => l.barcode === barcode) ;
      return ok(matched.length > 0 ? matched : lines);
    }

    // Browse/search mode — combines free-text search with category/color
    // filters, or (with none set) just lists the catalogue for browsing.
    // Paged so the grid can scroll through a very large catalogue.
    const products = await prisma.product.findMany({
      where: {
        // In stock = has an option with stock, or is a simple product (no
        // options, not stock-tracked) — those must stay sellable.
        ...(inStockOnly && {
          AND: [
            {
              OR: [
                { variants: { some: { isActive: true, inventory: { quantity: { gt: 0 } } } } },
                { variants: { none: { isActive: true } } },
              ],
            },
          ],
        }),
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
      orderBy: [{ nameEn: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    });

    const hasMore = products.length > PAGE_SIZE;
    const pageProducts = products.slice(0, PAGE_SIZE);
    const pricing = await pricingFor(pageProducts);
    let lines = pageProducts.flatMap((p) => toLines(p, pricing));
    if (color) lines = lines.filter((l) => l.color === color);
    if (inStockOnly) lines = lines.filter((l) => l.stock === null || l.stock > 0);
    return NextResponse.json({ success: true, data: lines, meta: { page, hasMore } });
  } catch (e) {
    return serverError(e);
  }
}
