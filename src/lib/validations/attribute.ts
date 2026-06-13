import { z } from "zod";

export const ATTRIBUTE_TYPES = [
  "TEXT",
  "NUMBER",
  "SELECT",
  "MULTISELECT",
  "COLOR",
  "BOOLEAN",
] as const;

export const attributeOptionSchema = z.object({
  value: z.string().min(1),
  labelEn: z.string().min(1),
  labelAr: z.string().min(1),
  hex: z.string().optional(),
});

export const categoryAttributeSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers, or underscores"),
  labelEn: z.string().min(1, "English label is required"),
  labelAr: z.string().min(1, "Arabic label is required"),
  type: z.enum(ATTRIBUTE_TYPES).default("TEXT"),
  options: z.array(attributeOptionSchema).default([]),
  unit: z.string().optional().nullable(),
  placeholder: z.string().optional().nullable(),
  isRequired: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const categoryAttributesPayloadSchema = z.object({
  attributes: z.array(categoryAttributeSchema),
});

export type AttributeOptionInput = z.infer<typeof attributeOptionSchema>;
export type CategoryAttributeInput = z.infer<typeof categoryAttributeSchema>;
