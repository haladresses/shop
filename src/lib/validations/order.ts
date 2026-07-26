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

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
    shippingAddress: shippingAddressSchema,
    couponCode: z.string().optional(),
    notes: z.string().optional(),
    paymentMethod: z.enum(["CASH_ON_DELIVERY", "BANK_TRANSFER", "CARD", "THAWANI", "STRIPE"]),
    shippingMethod: z.enum(["STANDARD", "WASELLEE"]).default("STANDARD"),
    waselleeDeliveryType: z.enum(["HOME_DELIVERY", "OFFICE_PICKUP"]).optional(),
    waselleeBranchId: z.string().optional(),
  })
  .refine(
    (d) =>
      d.shippingMethod !== "WASELLEE" || (!!d.waselleeDeliveryType && !!d.waselleeBranchId),
    {
      message: "Wasellee delivery type and branch are required for Wasellee shipping",
      path: ["waselleeBranchId"],
    }
  );

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
});

export const updateOrderSchema = z
  .object({
    status: z
      .enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"])
      .optional(),
    paymentStatus: z
      .enum(["UNPAID", "PAID", "PARTIAL", "REFUNDED", "FAILED"])
      .optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (d) => d.status !== undefined || d.paymentStatus !== undefined || d.notes !== undefined,
    { message: "No changes provided" }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
