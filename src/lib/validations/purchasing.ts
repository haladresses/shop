import { z } from "zod";

// NOTE: Zod 4 still applies `.default()` inside `.partial()`, so an update
// schema derived from a create schema with defaults would silently reset
// fields on a one-field PATCH. Every "update" schema below is therefore built
// from plain field definitions; only the create schemas add defaults.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Optional free text: trimmed, blank → null. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optDate = z
  .union([z.string().regex(DATE_RE, "Invalid date"), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const money = (max = 10_000_000) => z.number().min(0).max(max);

// ───────── Suppliers ─────────

const supplierFields = {
  nameEn: z.string().trim().min(2, "Supplier name is required").max(120),
  nameAr: optText(120),
  category: optText(80),
  contactPerson: optText(100),
  phone: optText(30),
  whatsapp: optText(30),
  email: z
    .string()
    .trim()
    .max(150)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email address"),
  website: optText(200),
  address: optText(500),
  city: optText(80),
  country: z.string().trim().min(2).max(3),
  vatNumber: optText(30),
  crNumber: optText(30),
  paymentTermsDays: z.number().int().min(0).max(365),
  creditLimit: z.number().min(0).max(100_000_000).optional().nullable(),
  openingBalance: z.number().min(-100_000_000).max(100_000_000),
  bankName: optText(100),
  bankAccountName: optText(120),
  iban: optText(40),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: optText(2000),
  isActive: z.boolean(),
};

export const supplierSchema = z.object({
  ...supplierFields,
  country: supplierFields.country.default("OM"),
  paymentTermsDays: supplierFields.paymentTermsDays.default(0),
  openingBalance: supplierFields.openingBalance.default(0),
  isActive: supplierFields.isActive.default(true),
});
export const supplierUpdateSchema = z.object(supplierFields).partial();

// ───────── Purchase orders ─────────

export const purchaseItemSchema = z.object({
  /** Existing line id when editing an order. */
  id: z.string().optional(),
  /** Null = a non-stock line (packaging, services …) — no inventory effect. */
  productId: z.string().min(1).optional().nullable(),
  variantId: z.string().min(1).optional().nullable(),
  nameEn: z.string().trim().min(1, "Every line needs a description").max(200),
  nameAr: optText(200),
  variantLabel: optText(120),
  sku: optText(80),
  barcode: optText(80),
  quantity: z.number().int().positive("Quantity must be at least 1").max(1_000_000),
  unitCost: money(),
  discountPct: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  taxCode: optText(10),
});

export const attachmentSchema = z.object({ url: z.string().min(1).max(500), name: z.string().max(200).default("") });

const purchaseOrderFields = {
  supplierId: z.string().min(1, "Choose a supplier"),
  supplierReference: optText(80),
  invoiceDate: optDate,
  orderDate: z.string().regex(DATE_RE, "Invalid order date"),
  expectedDate: optDate,
  dueDate: optDate,
  pricesIncludeTax: z.boolean(),
  discount: money(),
  shippingCost: money(),
  otherCharges: money(),
  notes: optText(3000),
  attachments: z.array(attachmentSchema).max(10),
  items: z.array(purchaseItemSchema).min(1, "Add at least one item").max(300),
};

export const purchaseOrderSchema = z.object({
  ...purchaseOrderFields,
  pricesIncludeTax: purchaseOrderFields.pricesIncludeTax.default(false),
  discount: purchaseOrderFields.discount.default(0),
  shippingCost: purchaseOrderFields.shippingCost.default(0),
  otherCharges: purchaseOrderFields.otherCharges.default(0),
  attachments: purchaseOrderFields.attachments.optional(),
});
export const purchaseOrderUpdateSchema = z.object(purchaseOrderFields).partial();

/** How a new order is saved: as a draft, placed with the supplier, or placed and received in one go. */
export const purchaseCreateModeSchema = z.enum(["draft", "order", "receive"]).default("draft");

export const quickPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"]).default("CASH"),
  reference: optText(100),
});

export const purchaseCreateSchema = purchaseOrderSchema.extend({
  mode: purchaseCreateModeSchema,
  payment: quickPaymentSchema.optional().nullable(),
});

export const receiveSchema = z.object({
  lines: z
    .array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1, "Enter how many units arrived"),
  receivedAt: optDate,
  note: optText(500),
  supplierReference: optText(80),
  invoiceDate: optDate,
});

const PAY_METHODS = ["BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"] as const;

/** How a return to a supplier is settled: credit on our account (default) or money refunded. */
const settlementFields = {
  settlement: z.enum(["CREDIT", "REFUND"]).default("CREDIT"),
  refundMethod: z.enum(PAY_METHODS).default("BANK_TRANSFER"),
  refundReference: optText(100),
};

export const purchaseReturnSchema = z.object({
  lines: z
    .array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1, "Choose what is going back"),
  reason: optText(500),
  returnedAt: optDate,
  ...settlementFields,
});

/**
 * Return to supplier from the Supplier Returns screen: either lines of one of
 * their purchase orders, or stock not tied to any order.
 */
export const supplierReturnSchema = z
  .object({
    supplierId: z.string().min(1, "Choose a supplier"),
    purchaseOrderId: z.string().min(1).optional().nullable(),
    lines: z.array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive() })).max(300).optional(),
    stockLines: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.number().int().positive().max(1_000_000),
          unitCost: money(),
          taxRate: z.number().min(0).max(100).default(0),
        }),
      )
      .max(300)
      .optional(),
    reason: optText(500),
    returnedAt: optDate,
    ...settlementFields,
  })
  .refine((d) => (d.purchaseOrderId ? (d.lines?.length ?? 0) > 0 : (d.stockLines?.length ?? 0) > 0), {
    message: "Choose what is going back",
  });

/** Money a supplier paid back to us. */
export const supplierRefundSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero").max(100_000_000),
  method: z.enum(PAY_METHODS),
  reference: optText(100),
  receivedAt: z.string().regex(DATE_RE, "Invalid date"),
  note: optText(500),
});

export const supplierPaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero").max(100_000_000),
  method: z.enum(["BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"]),
  reference: optText(100),
  paidAt: z.string().regex(DATE_RE, "Invalid payment date"),
  note: optText(500),
  /** Spread over the oldest open orders automatically (default) … */
  autoAllocate: z.boolean().default(true),
  /** … or against these orders explicitly (used when autoAllocate is false). */
  allocations: z
    .array(z.object({ purchaseOrderId: z.string().min(1), amount: z.number().positive() }))
    .max(100)
    .optional(),
});

export const purchaseActionSchema = z.object({
  action: z.enum(["order", "cancel", "close", "draft"]),
  reason: optText(300),
});

// ───────── Tasks ─────────

const taskFields = {
  supplierId: z.string().min(1).optional().nullable(),
  purchaseOrderId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optText(2000),
  type: z.enum(["TASK", "CALL", "FOLLOW_UP", "PAYMENT", "DELIVERY", "MEETING"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]),
  dueDate: optDate,
  assigneeId: z.string().min(1).optional().nullable(),
};

export const taskSchema = z.object({
  ...taskFields,
  type: taskFields.type.default("TASK"),
  priority: taskFields.priority.default("NORMAL"),
  status: taskFields.status.default("OPEN"),
});
export const taskUpdateSchema = z.object(taskFields).partial();
