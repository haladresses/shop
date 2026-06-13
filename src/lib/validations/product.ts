import { z } from "zod";

export const productVariantSchema = z.object({
  color: z.string().optional(),
  colorHex: z.string().optional(),
  size: z.string().optional(),
  sku: z.string().optional(),
  priceAdjustment: z.number().default(0),
  isActive: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
});

export const productImageSchema = z.object({
  url: z.string().min(1),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
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
