import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { canViewCost, withoutCost } from "@/lib/productCost";
import { getAuthFromRequest, userHasAnyPermission, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { cleanCustomSpecs, productUpdateSchema, type ProductUpdateInput } from "@/lib/validations/product";
import { withEffectiveCategoryAttributes } from "@/lib/categorySpecs";
import { applyMovement } from "@/lib/inventory";
import { resolveProductTaxRates } from "@/lib/tax";
import { Prisma } from "@prisma/client";
import { assignProductBarcodes } from "@/lib/barcodes";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
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
        taxRate: { select: { id: true, code: true, nameEn: true, nameAr: true, rate: true, type: true } },
      },
    });

    if (!product) return notFound("Product");
    // Specification fields include those inherited from parent categories.
    const full = await withEffectiveCategoryAttributes(product);
    if (!(await canViewCost(req))) return ok(withoutCost(full));
    // Staff also see which VAT rate actually applies (own → category → default).
    const effectiveTaxRate = (await resolveProductTaxRates([id])).get(id) ?? null;
    return ok({ ...full, effectiveTaxRate });
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

    const { images, variants, attributes, customSpecs, taxRateId, ...scalar } = parsed.data;

    // Unchecked input: scalar FKs (categoryId, taxRateId) are set directly.
    const data: Prisma.ProductUncheckedUpdateInput = { ...scalar };

    // An empty string must become NULL, not "" — the column is unique, and
    // Postgres treats "" as a real (colliding) value while NULLs never collide.
    if (scalar.barcode !== undefined) data.barcode = scalar.barcode || null;

    if (scalar.supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: scalar.supplierId }, select: { id: true } });
      if (!supplier) return error("The selected supplier doesn't exist.");
    }

    // Only admins choose a product's VAT rate (null = follow the category).
    if (taxRateId !== undefined) {
      const canSetTax = await userHasAnyPermission(user, ["admin.products.manage", "admin.tax.manage"]);
      if (canSetTax) {
        if (taxRateId) {
          const rate = await prisma.taxRate.findUnique({ where: { id: taxRateId }, select: { isActive: true } });
          if (!rate?.isActive) return error("The selected VAT rate doesn't exist or is inactive.");
        }
        data.taxRateId = taxRateId || null;
      }
    }

    if (attributes !== undefined) {
      data.attributes =
        attributes && Object.keys(attributes).length
          ? (attributes as Prisma.InputJsonValue)
          : Prisma.JsonNull;
    }

    if (customSpecs !== undefined) {
      const extraSpecs = cleanCustomSpecs(customSpecs);
      data.customSpecs = extraSpecs.length ? (extraSpecs as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    // Replace images when an explicit images array is provided.
    if (images !== undefined) {
      data.images = {
        deleteMany: {},
        create: images.map((img, i) => ({
          url: img.url,
          isPrimary: img.isPrimary || i === 0,
          sortOrder: img.sortOrder ?? i,
          color: img.color || null,
        })),
      };
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        if (variants !== undefined) await reconcileVariants(tx, id, variants, user.id);
        const saved = await tx.product.update({
          where: { id },
          data,
          include: {
            category: true,
            images: { orderBy: { sortOrder: "asc" } },
            variants: { include: { inventory: true } },
            taxRate: { select: { id: true, code: true, nameEn: true, nameAr: true, rate: true, type: true } },
          },
        });
        // Every product has its own barcode: clearing it (or never setting one) gets a new code.
        if (!saved.barcode) {
          const [assigned] = await assignProductBarcodes(tx, [id]);
          if (assigned) saved.barcode = assigned.barcode;
        }
        return saved;
      },
      { timeout: 30000 },
    );
    return ok(updated);
  } catch (e) {
    if (e instanceof Error && /Not enough stock/.test(e.message)) {
      return error(`${e.message} Someone may have sold units while this page was open. Reload and try again.`, 409);
    }
    return serverError(e);
  }
}

type VariantInput = NonNullable<ProductUpdateInput["variants"]>[number];

/**
 * Brings the product's variants in line with the submitted list WITHOUT
 * recreating them: existing variants (matched by id) are updated in place,
 * new rows are created, and only variants missing from the list are deleted.
 * Ids stay stable, so the stock ledger, order lines and purchase-order lines
 * stay attached. Stock edits are booked as ADJUSTMENT movements (never a
 * silent overwrite) so the inventory history stays complete.
 */
async function reconcileVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: VariantInput[],
  userId: string,
) {
  const existing = await tx.productVariant.findMany({ where: { productId }, include: { inventory: true } });
  const byId = new Map(existing.map((v) => [v.id, v]));
  const kept = new Set(variants.map((v) => v.id).filter((vid): vid is string => !!vid && byId.has(vid)));

  // Remove dropped variants first so their SKU/barcode can be reused below.
  const removed = existing.filter((v) => !kept.has(v.id)).map((v) => v.id);
  if (removed.length) await tx.productVariant.deleteMany({ where: { id: { in: removed } } });

  const fieldsOf = (v: VariantInput) => ({
    color: v.color || null,
    colorHex: v.colorHex || null,
    colorParts: v.colorParts && v.colorParts.length ? (v.colorParts as Prisma.InputJsonValue) : Prisma.JsonNull,
    size: v.size || null,
    sku: v.sku || null,
    barcode: v.barcode || null,
    priceAdjustment: v.priceAdjustment,
    isActive: v.isActive,
  });

  // Codes swapped between two variants would collide mid-update: clear the
  // changing ones first, then write the final values.
  const changingCodes = variants.filter((v) => {
    const cur = v.id ? byId.get(v.id) : undefined;
    return cur && ((v.sku || null) !== cur.sku || (v.barcode || null) !== cur.barcode);
  });
  for (const v of changingCodes) {
    await tx.productVariant.update({ where: { id: v.id! }, data: { sku: null, barcode: null } });
  }

  for (const v of variants) {
    const cur = v.id ? byId.get(v.id) : undefined;
    if (cur) {
      await tx.productVariant.update({ where: { id: cur.id }, data: fieldsOf(v) });
      if (!cur.inventory) {
        await tx.inventory.create({ data: { variantId: cur.id, quantity: 0, lowStockAlert: 5 } });
      }
      const onHand = cur.inventory?.quantity ?? 0;
      // With stockBase: only what the admin changed. Without: match the figure sent.
      const diff = v.stockBase != null ? v.stock - v.stockBase : v.stock - onHand;
      if (diff !== 0) {
        await applyMovement(tx, { variantId: cur.id, type: "ADJUSTMENT", quantity: diff, note: "Stock edited on product form", userId });
      }
    } else {
      const created = await tx.productVariant.create({
        data: { productId, ...fieldsOf(v), inventory: { create: { quantity: 0, lowStockAlert: 5 } } },
      });
      if (v.stock > 0) {
        await applyMovement(tx, { variantId: created.id, type: "ADJUSTMENT", quantity: v.stock, note: "Opening stock (product form)", userId });
      }
    }
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
