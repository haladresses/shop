import { z } from "zod";

export const addressSchema = z.object({
  nameEn: z.string().trim().min(2, "Enter the recipient's name").max(80),
  nameAr: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().min(6, "Enter a contact number").max(20),
  city: z.string().trim().min(2, "Enter the city / wilayat").max(60),
  area: z.string().trim().max(80).optional().nullable(),
  street: z.string().trim().max(120).optional().nullable(),
  buildingNo: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(2).default("OM"),
  isDefault: z.boolean().optional(),
});
