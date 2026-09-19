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

export const productSchema = z.object({
  nameEn: z.string().min(2, "Name is required"),
  nameAr: z.string().min(2, "Arabic name is required"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.number().positive("Price must be positive"),
  salePrice: z.number().positive().optional().nullable(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(true),
  isBestSeller: z.boolean().default(false),
  attributes: z.record(z.string(), z.any()).optional().default({}),
  variants: z.array(productVariantSchema).default([]),
  images: z.array(productImageSchema).default([]),
});

export const productUpdateSchema = productSchema.partial().extend({
  variants: z.array(productVariantSchema).optional(),
  images: z.array(productImageSchema).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
