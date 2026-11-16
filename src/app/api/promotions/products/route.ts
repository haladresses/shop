import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { categoryAncestry } from "@/lib/promotions";
import { pickerProduct } from "@/lib/promotionAdmin";

/**
 * Product picker for the promotion editor.
 *   ?search=…        name / SKU / barcode
 *   ?onSale=true     only products that already have a sale price
 *   ?categoryId=…    that category and its sub-categories
 *   ?ids=a,b,c       exactly these products
 *   ?idsOnly=true    just the ids of every match (for "select all")
 *   ?page=&pageSize=
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.promotions.view", "admin.promotions.manage"]);
    if ("res" in g) return g.res;

    const sp = req.nextUrl.searchParams;
    const search = (sp.get("search") || "").trim();
    const onSale = sp.get("onSale") === "true";
    const categoryId = sp.get("categoryId") || "";
    const ids = (sp.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const idsOnly = sp.get("idsOnly") === "true";
    const activeOnly = sp.get("active") === "true";
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "30")));

    let categoryIds: string[] | null = null;
    if (categoryId) {
      const ancestry = await categoryAncestry();
      categoryIds = Array.from(ancestry.entries())
        .filter(([, chain]) => chain.includes(categoryId))
        .map(([id]) => id);
    }

    const where: Prisma.ProductWhereInput = {
      ...(ids.length && { id: { in: ids.slice(0, 500) } }),
      ...(categoryIds && { categoryId: { in: categoryIds } }),
      ...(activeOnly && { isActive: true }),
      ...(onSale && { salePrice: { not: null, lt: prisma.product.fields.basePrice } }),
      ...(search && {
        OR: [
          { nameEn: { contains: search, mode: "insensitive" } },
          { nameAr: { contains: search } },
          { sku: { contains: search, mode: "insensitive" } },
          { barcode: { contains: search, mode: "insensitive" } },
          { variants: { some: { OR: [{ sku: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }] } } },
        ],
      }),
    };

    if (idsOnly) {
      const rows = await prisma.product.findMany({ where, select: { id: true }, take: 5000 });
      return ok({ ids: rows.map((r) => r.id) });
    }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { nameEn: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          basePrice: true,
          salePrice: true,
          isActive: true,
          categoryId: true,
          category: { select: { nameEn: true } },
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return ok({
      items: rows.map(pickerProduct),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (e) {
    return serverError(e);
  }
}
