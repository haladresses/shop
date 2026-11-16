import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";

export type LabelRow = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  variantLabel: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  basePrice: number;
  onHand: number | null;
};

const ids = (v: string | null) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 500) : []);

/**
 * Label data for the barcode-label printer.
 *   ?productIds=a,b   every active option of these products (or the product itself if it has none)
 *   ?variantIds=x,y   exactly these options
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.products.view", "admin.inventory.view", "admin.suppliers.view"]);
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;
    const productIds = ids(sp.get("productIds"));
    const variantIds = ids(sp.get("variantIds"));

    const products = await prisma.product.findMany({
      where: {
        OR: [
          ...(productIds.length ? [{ id: { in: productIds } }] : []),
          ...(variantIds.length ? [{ variants: { some: { id: { in: variantIds } } } }] : []),
        ],
      },
      include: { variants: { include: { inventory: { select: { quantity: true } } }, orderBy: [{ color: "asc" }, { size: "asc" }] } },
    });
    if (!productIds.length && !variantIds.length) return ok([]);

    const rows: LabelRow[] = [];
    for (const p of products) {
      const price = Number(p.salePrice ?? p.basePrice);
      const wanted = productIds.includes(p.id)
        ? p.variants.filter((v) => v.isActive)
        : p.variants.filter((v) => variantIds.includes(v.id));
      if (wanted.length === 0 && productIds.includes(p.id)) {
        rows.push({
          key: p.id,
          productId: p.id,
          variantId: null,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          variantLabel: "",
          sku: p.sku,
          barcode: p.barcode,
          price,
          basePrice: Number(p.basePrice),
          onHand: null,
        });
        continue;
      }
      for (const v of wanted) {
        rows.push({
          key: v.id,
          productId: p.id,
          variantId: v.id,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          variantLabel: [v.color, v.size].filter(Boolean).join(" / "),
          sku: v.sku || p.sku,
          // A single unnamed option shares the product's own barcode.
          barcode: v.barcode || (p.variants.length === 1 ? p.barcode : null),
          price: Math.round((price + Number(v.priceAdjustment)) * 1000) / 1000,
          basePrice: Math.round((Number(p.basePrice) + Number(v.priceAdjustment)) * 1000) / 1000,
          onHand: v.inventory?.quantity ?? 0,
        });
      }
    }
    // Keep the order the caller asked for (e.g. purchase-order line order).
    const order = [...variantIds, ...productIds];
    rows.sort((a, b) => {
      const ia = order.indexOf(a.variantId ?? a.productId);
      const ib = order.indexOf(b.variantId ?? b.productId);
      return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}
