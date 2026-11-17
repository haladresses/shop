import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { userHasPermission } from "@/lib/auth";
import { allocateBarcodes, assignProductBarcodes } from "@/lib/barcodes";

const schema = z
  .object({
    /** Just hand out fresh codes (the product form fills them in before saving). */
    reserve: z.number().int().min(1).max(200).optional(),
    /** Give these products their barcode (saved on the product) if they have none. */
    productIds: z.array(z.string().min(1)).max(1000).optional(),
    /** Every product in the catalogue that has no barcode yet. */
    allMissing: z.boolean().optional(),
    /** Optional, more specific codes for individual sizes/colours that have none. */
    variantIds: z.array(z.string().min(1)).max(1000).optional(),
  })
  .refine((d) => d.reserve || d.allMissing || d.variantIds?.length || d.productIds?.length, "Nothing to generate barcodes for");

export type AssignedBarcode = { productId: string; variantId: string | null; barcode: string };

/**
 * Generates barcodes for products that don't have one yet and saves them on
 * the product — the product's barcode is its code everywhere (labels, POS,
 * inventory, purchasing, search). Existing barcodes are never changed, so
 * labels already printed stay valid.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.products.manage", "seller.products.manage"]);
    if ("res" in g) return g.res;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { reserve, productIds = [], allMissing, variantIds = [] } = parsed.data;

    if (reserve) {
      const codes = await prisma.$transaction((tx) => allocateBarcodes(tx, reserve));
      return ok({ codes });
    }
    // Writing codes onto existing products is a catalogue-wide action.
    if (!(await userHasPermission(g.user, "admin.products.manage"))) {
      return error("Only staff who manage products can assign barcodes.", 403);
    }

    const assigned = await prisma.$transaction(
      async (tx) => {
        const result: AssignedBarcode[] = [];
        if (allMissing || productIds.length) {
          const products = await assignProductBarcodes(tx, allMissing ? "all" : productIds);
          result.push(...products.map((p) => ({ productId: p.productId, variantId: null, barcode: p.barcode })));
        }
        if (variantIds.length) {
          const variants = await tx.productVariant.findMany({
            where: { id: { in: variantIds }, barcode: null },
            select: { id: true, productId: true },
          });
          const codes = await allocateBarcodes(tx, variants.length);
          for (let i = 0; i < variants.length; i++) {
            await tx.productVariant.update({ where: { id: variants[i].id }, data: { barcode: codes[i] } });
            result.push({ productId: variants[i].productId, variantId: variants[i].id, barcode: codes[i] });
          }
        }
        return result;
      },
      { timeout: 60000 },
    );
    return ok({ assigned });
  } catch (e) {
    return serverError(e);
  }
}

/** How many products still have no barcode (for the "generate all" prompt). */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.products.view", "admin.products.manage"]);
    if ("res" in g) return g.res;
    const missing = await prisma.product.count({ where: { barcode: null } });
    return ok({ missing });
  } catch (e) {
    return serverError(e);
  }
}
