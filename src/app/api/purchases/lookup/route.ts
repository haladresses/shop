import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { resolveProductTaxRates } from "@/lib/tax";
import { NO_TAX, type RateInfo } from "@/lib/taxCalc";
import { PAYABLE_STATUSES, dayKey, num } from "@/lib/purchasing";
import { productImageUrl } from "@/lib/productImage";

type Row = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  /** The product's own barcode (shared by all its sizes/colours). */
  productBarcode: string | null;
  imageUrl: string | null;
  isActive: boolean;
  onHand: number | null;
  lowStockAlert: number | null;
  costPrice: number | null;
  sellPrice: number;
  lastCost: number | null;
  lastCostDate: string | null;
  lastSupplier: { id: string; nameEn: string } | null;
  suggestedQty: number;
  tax: RateInfo;
};

const PRODUCT_SELECT = {
  id: true,
  nameEn: true,
  nameAr: true,
  sku: true,
  barcode: true,
  isActive: true,
  costPrice: true,
  basePrice: true,
  salePrice: true,
  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
} satisfies Prisma.ProductSelect;

const label = (v: { color: string | null; size: string | null }) => [v.color, v.size].filter(Boolean).join(" / ") || null;

/**
 * Items to put on a purchase order.
 *   ?q=        search name / SKU / barcode
 *   ?barcode=  exact scan
 *   ?lowStock=true  reorder suggestions (at or below the low-stock alert)
 *   ?supplierId=    last price paid to this supplier
 * One row per size/colour, or one product-level row (variantId null) for a
 * product without options — its stock starts being tracked on first delivery.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.purchases.manage", "admin.purchases.receive", "admin.suppliers.view"]);
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim();
    const barcode = (sp.get("barcode") || "").trim();
    const lowStock = sp.get("lowStock") === "true";
    const supplierId = sp.get("supplierId") || "";
    const limit = Math.min(lowStock ? 300 : 50, Math.max(1, parseInt(sp.get("limit") || (lowStock ? "200" : "20"))));

    let rows: Omit<Row, "lastCost" | "lastCostDate" | "lastSupplier" | "tax">[] = [];

    if (lowStock) {
      const inv = await prisma.inventory.findMany({
        where: {
          quantity: { lte: prisma.inventory.fields.lowStockAlert },
          variant: { isActive: true, product: { isActive: true } },
        },
        orderBy: [{ quantity: "asc" }],
        take: limit,
        include: { variant: { include: { product: { select: PRODUCT_SELECT } } } },
      });
      rows = inv.map((i) => {
        const p = i.variant.product;
        return {
          key: i.variantId,
          productId: p.id,
          variantId: i.variantId,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          variantLabel: label(i.variant),
          sku: i.variant.sku || p.sku,
          barcode: i.variant.barcode || p.barcode, productBarcode: p.barcode,
          imageUrl: productImageUrl(p.images),
          isActive: p.isActive,
          onHand: i.quantity,
          lowStockAlert: i.lowStockAlert,
          costPrice: p.costPrice == null ? null : num(p.costPrice),
          sellPrice: num(p.salePrice ?? p.basePrice) + num(i.variant.priceAdjustment),
          // Enough to get back to twice the alert level.
          suggestedQty: Math.max(1, i.lowStockAlert * 2 - Math.max(0, i.quantity)),
        };
      });
    } else if (q || barcode) {
      const term = barcode || q;
      const products = await prisma.product.findMany({
        where: barcode
          ? { OR: [{ barcode }, { sku: barcode }, { variants: { some: { OR: [{ barcode }, { sku: barcode }] } } }] }
          : {
              OR: [
                { nameEn: { contains: term, mode: "insensitive" } },
                { nameAr: { contains: term } },
                { sku: { contains: term, mode: "insensitive" } },
                { barcode: { contains: term, mode: "insensitive" } },
                { variants: { some: { barcode: { contains: term, mode: "insensitive" } } } },
                { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
              ],
            },
        take: limit,
        orderBy: [{ isActive: "desc" }, { nameEn: "asc" }],
        select: { ...PRODUCT_SELECT, variants: { include: { inventory: true } } },
      });
      for (const p of products) {
        const base = {
          productId: p.id,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          imageUrl: productImageUrl(p.images),
          isActive: p.isActive,
          costPrice: p.costPrice == null ? null : num(p.costPrice),
        };
        const variants = p.variants.filter((v) => v.isActive);
        if (variants.length === 0) {
          // No options (or only inactive ones): buy the product itself.
          const single = p.variants.length === 1 ? p.variants[0] : null;
          rows.push({
            ...base,
            key: single?.id ?? p.id,
            variantId: single?.id ?? null,
            variantLabel: single ? label(single) : null,
            sku: single?.sku || p.sku,
            barcode: single?.barcode || p.barcode, productBarcode: p.barcode,
            onHand: single?.inventory ? single.inventory.quantity : null,
            lowStockAlert: single?.inventory?.lowStockAlert ?? null,
            sellPrice: num(p.salePrice ?? p.basePrice),
            suggestedQty: 1,
          });
          continue;
        }
        for (const v of variants) {
          rows.push({
            ...base,
            key: v.id,
            variantId: v.id,
            variantLabel: label(v),
            sku: v.sku || p.sku,
            barcode: v.barcode || p.barcode, productBarcode: p.barcode,
            onHand: v.inventory?.quantity ?? 0,
            lowStockAlert: v.inventory?.lowStockAlert ?? null,
            sellPrice: num(p.salePrice ?? p.basePrice) + num(v.priceAdjustment),
            suggestedQty: 1,
          });
        }
      }
      if (barcode) {
        // A product's own barcode covers all its sizes/colours; a size/colour code just that one.
        const productHit = rows.filter((r) => r.productBarcode === barcode);
        const exact = productHit.length ? productHit : rows.filter((r) => r.barcode === barcode || r.sku === barcode);
        if (exact.length) rows = exact;
      }
    }

    if (rows.length === 0) return ok([]);

    const productIds = [...new Set(rows.map((r) => r.productId))];
    const variantIds = rows.map((r) => r.variantId).filter((x): x is string => !!x);
    const [rates, history] = await Promise.all([
      resolveProductTaxRates(productIds),
      prisma.purchaseOrderItem.findMany({
        where: {
          OR: [{ variantId: { in: variantIds } }, { productId: { in: productIds } }],
          purchaseOrder: { status: { in: PAYABLE_STATUSES }, ...(supplierId && { supplierId }) },
        },
        orderBy: { purchaseOrder: { orderDate: "desc" } },
        take: 1000,
        select: {
          productId: true,
          variantId: true,
          unitCost: true,
          purchaseOrder: { select: { orderDate: true, supplier: { select: { id: true, nameEn: true } } } },
        },
      }),
    ]);
    const lastByVariant = new Map<string, (typeof history)[number]>();
    const lastByProduct = new Map<string, (typeof history)[number]>();
    for (const h of history) {
      if (h.variantId && !lastByVariant.has(h.variantId)) lastByVariant.set(h.variantId, h);
      if (h.productId && !lastByProduct.has(h.productId)) lastByProduct.set(h.productId, h);
    }

    let out: Row[] = rows.map((r) => {
      const last = (r.variantId && lastByVariant.get(r.variantId)) || lastByProduct.get(r.productId) || null;
      return {
        ...r,
        lastCost: last ? num(last.unitCost) : null,
        lastCostDate: last ? dayKey(last.purchaseOrder.orderDate) : null,
        lastSupplier: last?.purchaseOrder.supplier ?? null,
        tax: rates.get(r.productId) ?? NO_TAX,
      };
    });
    // Reorder suggestions for a supplier: items last bought from them first.
    if (lowStock && supplierId) {
      out = out.sort((a, b) => Number(b.lastSupplier?.id === supplierId) - Number(a.lastSupplier?.id === supplierId));
    }
    return ok(out);
  } catch (e) {
    return serverError(e);
  }
}
