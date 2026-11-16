import { z } from "zod";

export const productVariantColorPartSchema = z.object({
  part: z.string().min(1),
  color: z.string().min(1),
  colorHex: z.string().optional(),
});

export const productVariantSchema = z.object({
  color: z.string().optional(),
  colorHex: z.string().optional(),
  // Per-region breakdown for a variant that is itself multi-color, e.g.
  // [{ part: "Sleeves", color: "Yellow" }, { part: "Body", color: "Blue" }].
  colorParts: z.array(productVariantColorPartSchema).optional(),
  size: z.string().optional(),
  sku: z.string().optional(),
  // The item's own code, typed by the admin and rendered as a scannable
  // barcode — not auto-generated.
  barcode: z.string().optional(),
  priceAdjustment: z.number().default(0),
  isActive: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
});

export const productImageSchema = z.object({
  url: z.string().min(1),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  color: z.string().optional(),
});

/** A specification that only this product has (not defined on its category). */
export const productCustomSpecSchema = z.object({
  labelEn: z.string().trim().max(120).default(""),
  labelAr: z.string().trim().max(120).default(""),
  valueEn: z.string().trim().max(500).default(""),
  valueAr: z.string().trim().max(500).default(""),
});

// Field definitions WITHOUT defaults. Zod 4 still applies `.default()` inside
// `.partial()`, so deriving the update schema from the create schema made a
// one-field PATCH (e.g. the list page's Active toggle) also reset the other
// flags and wipe the product's specifications. The update schema is built from
// these plain fields; only the create schema adds defaults.
const productFields = {
  nameEn: z.string().min(2, "Name is required"),
  nameAr: z.string().min(2, "Arabic name is required"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.number().positive("Price must be positive"),
  salePrice: z.number().positive().optional().nullable(),
  // Purchase price per unit — used for profit & loss and stock valuation.
  costPrice: z.number().min(0).optional().nullable(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  isBestSeller: z.boolean(),
  attributes: z.record(z.string(), z.any()),
  customSpecs: z.array(productCustomSpecSchema).max(50, "Too many extra specifications"),
  variants: z.array(productVariantSchema),
  images: z.array(productImageSchema),
};

export const productSchema = z.object({
  ...productFields,
  isActive: productFields.isActive.default(true),
  isFeatured: productFields.isFeatured.default(false),
  isNew: productFields.isNew.default(true),
  isBestSeller: productFields.isBestSeller.default(false),
  attributes: productFields.attributes.optional().default({}),
  customSpecs: productFields.customSpecs.optional().default([]),
  variants: productFields.variants.default([]),
  images: productFields.images.default([]),
});

export const productUpdateSchema = z.object(productFields).partial();

export type ProductCustomSpecInput = z.infer<typeof productCustomSpecSchema>;

/** Drop rows the admin left blank and fill a missing language from the other one. */
export function cleanCustomSpecs(specs: ProductCustomSpecInput[] | undefined) {
  return (specs ?? [])
    .map((s) => ({
      labelEn: s.labelEn || s.labelAr,
      labelAr: s.labelAr || s.labelEn,
      valueEn: s.valueEn || s.valueAr,
      valueAr: s.valueAr || s.valueEn,
    }))
    .filter((s) => s.labelEn && s.valueEn);
}

export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
