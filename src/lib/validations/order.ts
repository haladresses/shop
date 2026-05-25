import { z } from "zod";

export const shippingAddressSchema = z.object({
  nameEn: z.string().min(2),
  phone: z.string().min(8),
  city: z.string().min(2),
  area: z.string().optional(),
  street: z.string().optional(),
  buildingNo: z.string().optional(),
  country: z.string().default("OM"),
});

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  shippingAddress: shippingAddressSchema,
  couponCode: z.string().optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "BANK_TRANSFER", "CARD", "THAWANI", "STRIPE"]),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
