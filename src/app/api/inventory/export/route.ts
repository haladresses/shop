import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { unauthorized, forbidden, serverError } from "@/lib/api/response";
import { buildInventoryWhere, StockFilter } from "@/lib/inventory";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Full stock list as CSV (honours the same filters as the list view). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.inventory.view"))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const where = buildInventoryWhere({
      search: (sp.get("search") || "").trim(),
      status: (sp.get("status") || "all") as StockFilter["status"],
      categoryId: sp.get("categoryId") || "",
    });

    const head = ["Product", "Product (AR)", "Category", "Variant", "SKU", "Barcode", "Location", "On hand", "Reserved", "Available", "Low-stock alert", "Unit cost", "Unit price", "Stock value (cost)", "Stock value (retail)"];
    const lines: string[] = [head.map(csvCell).join(",")];

    // Batch through the table so very large catalogues don't load at once.
    const BATCH = 1000;
    for (let cursor: string | undefined; ; ) {
      const rows = await prisma.inventory.findMany({
        where,
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        include: {
          variant: {
            include: {
              product: { select: { nameEn: true, nameAr: true, basePrice: true, salePrice: true, costPrice: true, category: { select: { nameEn: true } } } },
            },
          },
        },
      });
      for (const i of rows) {
        const p = i.variant.product;
        const cost = p.costPrice == null ? null : Number(p.costPrice);
        const price = Number(p.salePrice ?? p.basePrice) + Number(i.variant.priceAdjustment);
        const onHand = Math.max(0, i.quantity);
        lines.push(
          [
            p.nameEn, p.nameAr, p.category.nameEn, [i.variant.color, i.variant.size].filter(Boolean).join(" / "),
            i.variant.sku, i.variant.barcode, i.location, i.quantity, i.reservedQuantity, i.quantity - i.reservedQuantity,
            i.lowStockAlert, cost?.toFixed(3) ?? "", price.toFixed(3), cost == null ? "" : (onHand * cost).toFixed(3), (onHand * price).toFixed(3),
          ].map(csvCell).join(","),
        );
      }
      if (rows.length < BATCH) break;
      cursor = rows[rows.length - 1].id;
    }

    return new NextResponse("﻿" + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
