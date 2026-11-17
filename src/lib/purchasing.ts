import { Prisma, type PurchaseOrderStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { calculatePurchase } from "@/lib/purchaseCalc";
import { getTaxSettings } from "@/lib/tax";
import { r3 } from "@/lib/taxCalc";
import { businessDayStart, toBusinessDateKey } from "@/lib/finance";
import { applyMovement } from "@/lib/inventory";
import { nextDocumentNumber } from "@/lib/sequences";
import { error, serverError } from "@/lib/api/response";

// Purchasing domain rules shared by the supplier / purchase-order / payment
// routes.
//
//  • A purchase order is money owed (a payable) once it's ORDERED (also
//    while/after goods are received). Drafts and cancelled orders aren't.
//  • Supplier balance = opening balance + payable PO totals − returns to the
//    supplier − payments. Positive = we owe them; negative = credit with them.
//  • Payments are allocated to specific POs (FIFO by due date by default);
//    an order's amountPaid is Σ its allocations. Anything unallocated is
//    on-account credit (e.g. against the opening balance).

export const PAYABLE_STATUSES: PurchaseOrderStatus[] = ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"];
export const EDITABLE_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "ORDERED"];

export const num = (v: unknown) => (v == null ? 0 : Number(v));

type PoMoney = {
  status: PurchaseOrderStatus;
  total: unknown;
  returnedTotal: unknown;
  amountPaid: unknown;
  dueDate?: Date | null;
};

/** What's still to pay on one order. */
export function poOutstanding(po: PoMoney): number {
  if (!PAYABLE_STATUSES.includes(po.status)) return 0;
  return r3(Math.max(0, num(po.total) - num(po.returnedTotal) - num(po.amountPaid)));
}

export function poPaymentStatus(po: PoMoney): "NONE" | "UNPAID" | "PARTIAL" | "PAID" {
  if (!PAYABLE_STATUSES.includes(po.status)) return "NONE";
  if (poOutstanding(po) <= 0.0005) return "PAID";
  return num(po.amountPaid) > 0 ? "PARTIAL" : "UNPAID";
}

export function todayStart(): Date {
  return businessDayStart(toBusinessDateKey(new Date()));
}

export function isPoOverdue(po: PoMoney, now = todayStart()): boolean {
  return !!po.dueDate && po.dueDate < now && poOutstanding(po) > 0.0005;
}

/** Whole days an order is past due (0 if not due yet). */
export function daysOverdue(due: Date | null | undefined, now = todayStart()): number {
  if (!due) return 0;
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
}

export function addDaysTo(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

/** Money-shaped fields of a PO as plain numbers + derived payment info. */
export function serializePoMoney<T extends PoMoney & Record<string, unknown>>(po: T) {
  return {
    subtotal: num(po.subtotal),
    discount: num(po.discount),
    shippingCost: num(po.shippingCost),
    otherCharges: num(po.otherCharges),
    taxTotal: num(po.taxTotal),
    total: num(po.total),
    amountPaid: num(po.amountPaid),
    returnedTotal: num(po.returnedTotal),
    outstanding: poOutstanding(po),
    paymentStatus: poPaymentStatus(po),
    overdue: isPoOverdue(po),
    daysOverdue: isPoOverdue(po) ? daysOverdue(po.dueDate) : 0,
  };
}

/**
 * Re-derives every line's net/VAT/landed cost and the order totals from the
 * stored quantities and prices, then makes sure payments don't exceed what's
 * now owed.
 */
export async function recalcPurchaseOrder(tx: Prisma.TransactionClient, id: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  const settings = await getTaxSettings();
  const calc = calculatePurchase({
    lines: po.items.map((i) => ({
      quantity: i.quantity,
      unitCost: num(i.unitCost),
      discountPct: num(i.discountPct),
      taxRate: num(i.taxRate),
    })),
    pricesIncludeTax: po.pricesIncludeTax,
    discount: num(po.discount),
    shippingCost: num(po.shippingCost),
    otherCharges: num(po.otherCharges),
    reclaimTax: settings.enabled,
  });
  for (let i = 0; i < po.items.length; i++) {
    const l = calc.lines[i];
    await tx.purchaseOrderItem.update({
      where: { id: po.items[i].id },
      data: { netAmount: l.net, taxAmount: l.tax, landedUnitCost: l.landedUnitCost },
    });
  }
  await tx.purchaseOrder.update({
    where: { id },
    data: { subtotal: calc.subtotal, discount: calc.discount, taxTotal: calc.taxTotal, total: calc.total },
  });
  await rebalanceAllocations(tx, id);
  return calc;
}

/**
 * Keeps an order's payment allocations within what is owed on it (total less
 * goods returned; nothing for drafts/cancelled orders). Any excess comes off
 * the newest allocations and becomes on-account credit with the supplier.
 * Also refreshes the denormalised amountPaid.
 */
export async function rebalanceAllocations(tx: Prisma.TransactionClient, purchaseOrderId: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    select: {
      status: true,
      total: true,
      returnedTotal: true,
      allocations: { select: { id: true, amount: true }, orderBy: { payment: { paidAt: "desc" } } },
    },
  });
  const cap = PAYABLE_STATUSES.includes(po.status) ? Math.max(0, num(po.total) - num(po.returnedTotal)) : 0;
  let sum = po.allocations.reduce((s, a) => s + num(a.amount), 0);
  let excess = r3(sum - cap);
  for (const a of po.allocations) {
    if (excess <= 0.0005) break;
    const amt = num(a.amount);
    const cut = Math.min(amt, excess);
    if (cut >= amt - 0.0005) await tx.supplierPaymentAllocation.delete({ where: { id: a.id } });
    else await tx.supplierPaymentAllocation.update({ where: { id: a.id }, data: { amount: r3(amt - cut) } });
    excess = r3(excess - cut);
    sum -= cut;
  }
  await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { amountPaid: r3(Math.max(0, sum)) } });
}

/** Open (payable, not fully paid) orders for a supplier, oldest due first. */
export async function openPurchaseOrders(tx: Prisma.TransactionClient, supplierId: string) {
  const pos = await tx.purchaseOrder.findMany({
    where: { supplierId, status: { in: PAYABLE_STATUSES } },
    select: { id: true, number: true, status: true, total: true, returnedTotal: true, amountPaid: true, dueDate: true, orderDate: true },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { orderDate: "asc" }],
  });
  return pos.filter((p) => poOutstanding(p) > 0.0005);
}

/** FIFO split of a payment over the supplier's open orders. */
export async function autoAllocate(tx: Prisma.TransactionClient, supplierId: string, amount: number) {
  const open = await openPurchaseOrders(tx, supplierId);
  const out: { purchaseOrderId: string; amount: number }[] = [];
  let left = r3(amount);
  for (const po of open) {
    if (left <= 0.0005) break;
    const take = r3(Math.min(left, poOutstanding(po)));
    if (take > 0) out.push({ purchaseOrderId: po.id, amount: take });
    left = r3(left - take);
  }
  return out;
}

export type SupplierBalance = {
  opening: number;
  purchased: number;
  returned: number;
  paid: number;
  balance: number;
};

/** Running account per supplier (what we owe right now). */
export async function supplierBalances(ids?: string[]): Promise<Map<string, SupplierBalance>> {
  const bySupplier = ids ? { supplierId: { in: ids } } : {};
  const [suppliers, poAgg, retAgg, payAgg] = await Promise.all([
    prisma.supplier.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, openingBalance: true } }),
    prisma.purchaseOrder.groupBy({ by: ["supplierId"], where: { ...bySupplier, status: { in: PAYABLE_STATUSES } }, _sum: { total: true } }),
    prisma.purchaseReturn.groupBy({ by: ["supplierId"], where: bySupplier, _sum: { total: true } }),
    prisma.supplierPayment.groupBy({ by: ["supplierId"], where: bySupplier, _sum: { amount: true } }),
  ]);
  const po = new Map(poAgg.map((r) => [r.supplierId, num(r._sum.total)]));
  const ret = new Map(retAgg.map((r) => [r.supplierId, num(r._sum.total)]));
  const pay = new Map(payAgg.map((r) => [r.supplierId, num(r._sum.amount)]));
  const out = new Map<string, SupplierBalance>();
  for (const s of suppliers) {
    const opening = num(s.openingBalance);
    const purchased = po.get(s.id) ?? 0;
    const returned = ret.get(s.id) ?? 0;
    const paid = pay.get(s.id) ?? 0;
    out.set(s.id, {
      opening: r3(opening),
      purchased: r3(purchased),
      returned: r3(returned),
      paid: r3(paid),
      balance: r3(opening + purchased - returned - paid),
    });
  }
  return out;
}

/**
 * The stock record (variant) a purchase line should be received into. A
 * product without sizes/colours gets a standard variant created on its first
 * delivery, so from then on its stock is tracked like everything else.
 */
export async function ensureStockVariant(tx: Prisma.TransactionClient, productId: string): Promise<string> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, nameEn: true, barcode: true, variants: { select: { id: true } } },
  });
  if (!product) throw new PurchasingError("A product on this order no longer exists.");
  if (product.variants.length === 1) {
    await ensureInventory(tx, product.variants[0].id);
    return product.variants[0].id;
  }
  if (product.variants.length > 1) {
    throw new PurchasingError(`${product.nameEn} now has sizes/colours: choose the exact option on the order before receiving it.`);
  }
  const barcodeTaken = product.barcode
    ? await tx.productVariant.findUnique({ where: { barcode: product.barcode }, select: { id: true } })
    : null;
  const variant = await tx.productVariant.create({
    data: {
      productId,
      barcode: product.barcode && !barcodeTaken ? product.barcode : null,
      isActive: true,
      inventory: { create: { quantity: 0, lowStockAlert: 5 } },
    },
  });
  return variant.id;
}

export async function ensureInventory(tx: Prisma.TransactionClient, variantId: string) {
  await tx.inventory.upsert({ where: { variantId }, create: { variantId, quantity: 0, lowStockAlert: 5 }, update: {} });
}

/** A purchasing rule was broken — safe to show to the user (HTTP 400/409). */
export class PurchasingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Parses a YYYY-MM-DD business day (stored at local noon so it never drifts a day). */
export function parseDay(v: string | null | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T12:00:00.000+04:00`);
}

export function dayKey(d: Date | null | undefined): string | null {
  return d ? toBusinessDateKey(d) : null;
}

/** Maps a thrown purchasing / stock error to an API response. */
export function purchasingErrorResponse(e: unknown) {
  if (e instanceof PurchasingError) return error(e.message, e.status);
  if (e instanceof Error && /Not enough stock/.test(e.message)) return error(e.message, 409);
  if (e instanceof Error && /Inventory not found/.test(e.message)) return error(e.message, 409);
  return serverError(e);
}

export const TX_OPTIONS = { timeout: 60000, maxWait: 15000 } as const;

export const TASK_INCLUDE = {
  supplier: { select: { id: true, code: true, nameEn: true, nameAr: true } },
  purchaseOrder: { select: { id: true, number: true } },
  assignee: { select: { id: true, nameEn: true, email: true } },
} satisfies Prisma.SupplierTaskInclude;

export const TASK_PRIORITY_WEIGHT: Record<string, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

export function serializeTask(t: Prisma.SupplierTaskGetPayload<{ include: typeof TASK_INCLUDE }>) {
  const overdue = t.status !== "DONE" && !!t.dueDate && t.dueDate < todayStart();
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    priority: t.priority,
    status: t.status,
    dueDate: dayKey(t.dueDate),
    overdue,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    supplier: t.supplier,
    purchaseOrder: t.purchaseOrder,
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.nameEn || t.assignee.email } : null,
  };
}

/** Same-day ordering of statement lines. */
export const SUPPLIER_STATEMENT_ORDER: Record<"OPENING" | "PURCHASE" | "RETURN" | "PAYMENT" | "REFUND", number> = {
  OPENING: 0,
  PURCHASE: 1,
  RETURN: 2,
  REFUND: 3,
  PAYMENT: 4,
};

const variantLabelOf = (v: { color: string | null; size: string | null } | null | undefined) =>
  v ? [v.color, v.size].filter(Boolean).join(" / ") || null : null;

type ItemInput = {
  id?: string;
  productId?: string | null;
  variantId?: string | null;
  nameEn: string;
  nameAr?: string | null;
  variantLabel?: string | null;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitCost: number;
  discountPct?: number;
  taxRate?: number;
  taxCode?: string | null;
};

/**
 * Validates purchase lines against the catalogue and returns the data to
 * store. Product lines get their name/SKU/barcode snapshot from the database;
 * a product with several sizes/colours must be ordered as one exact option
 * (a product with a single option gets that option).
 */
export async function buildPurchaseItems(tx: Prisma.TransactionClient, items: ItemInput[]) {
  const productIds = [...new Set(items.map((i) => i.productId).filter((x): x is string => !!x))];
  const products = productIds.length
    ? await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          sku: true,
          barcode: true,
          variants: { select: { id: true, color: true, size: true, sku: true, barcode: true, isActive: true } },
        },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  return items.map((it, idx) => {
    const base = {
      quantity: it.quantity,
      unitCost: r3(it.unitCost),
      discountPct: Math.min(100, Math.max(0, it.discountPct ?? 0)),
      taxRate: Math.min(100, Math.max(0, it.taxRate ?? 0)),
      taxCode: it.taxCode || null,
      sortOrder: idx,
    };
    if (!it.productId) {
      return {
        ...base,
        productId: null,
        variantId: null,
        nameEn: it.nameEn.trim(),
        nameAr: it.nameAr || null,
        variantLabel: it.variantLabel || null,
        sku: it.sku || null,
        barcode: it.barcode || null,
      };
    }
    const p = byId.get(it.productId);
    if (!p) throw new PurchasingError(`Line ${idx + 1}: that product no longer exists.`);
    let variant = it.variantId ? p.variants.find((v) => v.id === it.variantId) : undefined;
    if (it.variantId && !variant) throw new PurchasingError(`Line ${idx + 1}: that option of ${p.nameEn} no longer exists.`);
    if (!variant && p.variants.length === 1) variant = p.variants[0];
    if (!variant && p.variants.length > 1) {
      throw new PurchasingError(`Line ${idx + 1}: choose the size / colour of ${p.nameEn}.`);
    }
    return {
      ...base,
      productId: p.id,
      variantId: variant?.id ?? null,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      variantLabel: variantLabelOf(variant),
      sku: variant?.sku || p.sku || null,
      barcode: variant?.barcode || p.barcode || null,
    };
  });
}

/**
 * Books a delivery against a purchase order: stock goes up (weighted-average
 * cost updated from each line's landed cost), a goods received note is
 * written, and the order's status / due date move on.
 */
export async function receivePurchaseLines(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string,
  lines: { itemId: string; quantity: number }[],
  opts: { receivedAt: Date; note?: string | null; supplierReference?: string | null; invoiceDate?: Date | null; userId: string | null },
) {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true, supplier: { select: { nameEn: true, paymentTermsDays: true } } },
  });
  if (!po) throw new PurchasingError("Purchase order not found", 404);
  if (!["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw new PurchasingError(`This order is ${po.status.toLowerCase().replace("_", " ")}. Nothing more can be received.`, 409);
  }

  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.itemId, (merged.get(l.itemId) ?? 0) + l.quantity);

  const grn = await nextDocumentNumber(tx, "GRN", opts.receivedAt);
  const receiptItems: Prisma.InputJsonValue[] = [];
  let units = 0;
  let value = 0;

  for (const [itemId, qty] of merged) {
    if (qty <= 0) continue;
    const item = po.items.find((i) => i.id === itemId);
    if (!item) throw new PurchasingError("A line on this delivery isn't part of the order.");
    const remaining = item.quantity - item.receivedQty;
    if (qty > remaining) {
      throw new PurchasingError(`Only ${remaining} unit(s) of ${item.nameEn} are still to be received.`);
    }
    const unitCost = item.landedUnitCost != null ? num(item.landedUnitCost) : num(item.unitCost);
    let variantId = item.variantId;
    if (item.productId) {
      if (!variantId) {
        variantId = await ensureStockVariant(tx, item.productId);
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { variantId } });
      } else {
        await ensureInventory(tx, variantId);
      }
      await applyMovement(tx, {
        variantId,
        type: "PURCHASE",
        quantity: qty,
        unitCost,
        reference: po.number,
        note: `${grn} · ${po.supplier.nameEn}`,
        userId: opts.userId,
      });
    }
    await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: { increment: qty } } });
    receiptItems.push({
      itemId: item.id,
      productId: item.productId,
      variantId,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      variantLabel: item.variantLabel,
      sku: item.sku,
      barcode: item.barcode,
      quantity: qty,
      unitCost,
    });
    units += qty;
    value += qty * unitCost;
  }
  if (units === 0) throw new PurchasingError("Enter how many units arrived.");

  const after = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId }, select: { quantity: true, receivedQty: true } });
  const complete = after.every((i) => i.receivedQty >= i.quantity);
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED",
      orderedAt: po.orderedAt ?? opts.receivedAt,
      receivedAt: complete ? opts.receivedAt : null,
      dueDate: po.dueDate ?? addDaysTo(opts.receivedAt, po.supplier.paymentTermsDays),
      ...(opts.supplierReference ? { supplierReference: opts.supplierReference } : {}),
      ...(opts.invoiceDate ? { invoiceDate: opts.invoiceDate } : {}),
    },
  });
  const receipt = await tx.purchaseReceipt.create({
    data: {
      number: grn,
      purchaseOrderId,
      receivedAt: opts.receivedAt,
      items: receiptItems,
      units,
      value: r3(value),
      note: opts.note || null,
      createdBy: opts.userId,
    },
  });
  await rebalanceAllocations(tx, purchaseOrderId);
  return receipt;
}

export type SupplierReturnSettlement =
  | { type: "CREDIT" }
  | { type: "REFUND"; method: string; reference?: string | null };

/** Note on the refund payment booked with a debit note — also how the two are linked. */
export const refundNoteFor = (debitNoteNumber: string) => `Refund for ${debitNoteNumber}`;

/**
 * Goods sent back to a supplier (debit note) — one code path for returns
 * against a purchase order and for stock that isn't on any order (e.g. bought
 * before the system was in use). Stock goes down (PURCHASE_RETURN; there must
 * be enough on hand) and so does what we owe the supplier. When the supplier
 * pays the money back instead of crediting the account, a refund (negative
 * supplier payment) is booked with it, so the balance nets out.
 */
export async function createSupplierReturn(
  tx: Prisma.TransactionClient,
  input: {
    supplierId: string;
    /** Return against this order's lines … */
    purchaseOrderId?: string | null;
    lines?: { itemId: string; quantity: number }[];
    /** … or stock not tied to an order. */
    stockLines?: { variantId: string; quantity: number; unitCost: number; taxRate: number }[];
    returnedAt: Date;
    reason?: string | null;
    settlement?: SupplierReturnSettlement;
    userId: string | null;
  },
) {
  const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, nameEn: true } });
  if (!supplier) throw new PurchasingError("Supplier not found", 404);

  const items: Prisma.InputJsonValue[] = [];
  let net = 0;
  let tax = 0;
  let units = 0;
  let po: Prisma.PurchaseOrderGetPayload<{ include: { items: true } }> | null = null;
  const dn = await nextDocumentNumber(tx, "DN", input.returnedAt);
  const note = (extra: string) => `${dn} · returned to ${supplier.nameEn}${extra}${input.reason ? `: ${input.reason}` : ""}`;

  if (input.purchaseOrderId) {
    po = await tx.purchaseOrder.findUnique({ where: { id: input.purchaseOrderId }, include: { items: true } });
    if (!po) throw new PurchasingError("Purchase order not found", 404);
    if (po.supplierId !== input.supplierId) throw new PurchasingError("That purchase order belongs to another supplier.");
    if (po.status === "CANCELLED" || po.status === "DRAFT") {
      throw new PurchasingError("Nothing has been received on this order yet.", 409);
    }
    const merged = new Map<string, number>();
    for (const l of input.lines ?? []) merged.set(l.itemId, (merged.get(l.itemId) ?? 0) + l.quantity);
    for (const [itemId, qty] of merged) {
      if (qty <= 0) continue;
      const item = po.items.find((i) => i.id === itemId);
      if (!item) throw new PurchasingError("A returned line isn't part of the order.");
      const returnable = item.receivedQty - item.returnedQty;
      if (qty > returnable) throw new PurchasingError(`Only ${returnable} unit(s) of ${item.nameEn} can be returned.`);
      if (item.variantId) {
        await applyMovement(tx, {
          variantId: item.variantId,
          type: "PURCHASE_RETURN",
          quantity: qty,
          unitCost: item.landedUnitCost != null ? num(item.landedUnitCost) : null,
          reference: po.number,
          note: note(""),
          userId: input.userId,
        });
      }
      const perNet = item.quantity > 0 ? num(item.netAmount) / item.quantity : 0;
      const perTax = item.quantity > 0 ? num(item.taxAmount) / item.quantity : 0;
      const lineNet = r3(perNet * qty);
      const lineTax = r3(perTax * qty);
      net += lineNet;
      tax += lineTax;
      units += qty;
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { returnedQty: { increment: qty } } });
      items.push({
        itemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        variantLabel: item.variantLabel,
        sku: item.sku,
        barcode: item.barcode,
        quantity: qty,
        unitCost: r3(perNet),
        taxRate: num(item.taxRate),
        net: lineNet,
        tax: lineTax,
      });
    }
  } else {
    const merged = new Map<string, { quantity: number; unitCost: number; taxRate: number }>();
    for (const l of input.stockLines ?? []) {
      const cur = merged.get(l.variantId);
      merged.set(l.variantId, cur ? { ...cur, quantity: cur.quantity + l.quantity } : { ...l });
    }
    const variants = merged.size
      ? await tx.productVariant.findMany({
          where: { id: { in: Array.from(merged.keys()) } },
          select: {
            id: true,
            color: true,
            size: true,
            sku: true,
            barcode: true,
            product: { select: { id: true, nameEn: true, nameAr: true, sku: true, barcode: true } },
          },
        })
      : [];
    for (const [variantId, l] of merged) {
      if (l.quantity <= 0) continue;
      const v = variants.find((x) => x.id === variantId);
      if (!v) throw new PurchasingError("An item on this return no longer exists.");
      const unitCost = r3(Math.max(0, l.unitCost));
      const rate = Math.min(100, Math.max(0, l.taxRate));
      await applyMovement(tx, {
        variantId,
        type: "PURCHASE_RETURN",
        quantity: l.quantity,
        unitCost,
        reference: dn,
        note: note(" (not on a purchase order)"),
        userId: input.userId,
      });
      const lineNet = r3(unitCost * l.quantity);
      const lineTax = r3((lineNet * rate) / 100);
      net += lineNet;
      tax += lineTax;
      units += l.quantity;
      items.push({
        itemId: null,
        productId: v.product.id,
        variantId,
        nameEn: v.product.nameEn,
        nameAr: v.product.nameAr,
        variantLabel: [v.color, v.size].filter(Boolean).join(" / ") || null,
        sku: v.sku || v.product.sku,
        barcode: v.barcode || v.product.barcode,
        quantity: l.quantity,
        unitCost,
        taxRate: rate,
        net: lineNet,
        tax: lineTax,
      });
    }
  }
  if (units === 0) throw new PurchasingError("Choose what is going back.");

  const total = r3(net + tax);
  const ret = await tx.purchaseReturn.create({
    data: {
      number: dn,
      supplierId: input.supplierId,
      purchaseOrderId: po?.id ?? null,
      items,
      subtotal: r3(net),
      taxTotal: r3(tax),
      total,
      reason: input.reason || null,
      returnedAt: input.returnedAt,
      createdBy: input.userId,
    },
  });
  if (po) {
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { returnedTotal: { increment: total } } });
    await rebalanceAllocations(tx, po.id);
  }

  let refund: { id: string; number: string } | null = null;
  if (input.settlement?.type === "REFUND" && total > 0) {
    const r = await recordSupplierRefund(tx, {
      supplierId: input.supplierId,
      amount: total,
      method: input.settlement.method,
      reference: input.settlement.reference,
      receivedAt: input.returnedAt,
      note: refundNoteFor(dn),
      userId: input.userId,
    });
    refund = { id: r.id, number: r.number };
  }
  return { ret, units, refund };
}

/** PO-only wrapper kept for the purchase-order return endpoint. */
export async function returnPurchaseLines(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string,
  lines: { itemId: string; quantity: number }[],
  opts: { returnedAt: Date; reason?: string | null; userId: string | null; settlement?: SupplierReturnSettlement },
) {
  const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { supplierId: true } });
  if (!po) throw new PurchasingError("Purchase order not found", 404);
  const res = await createSupplierReturn(tx, { supplierId: po.supplierId, purchaseOrderId, lines, ...opts });
  return res.ret;
}

/**
 * Money a supplier paid back to us (e.g. for returned goods). Stored as a
 * supplier payment with a NEGATIVE amount and no allocations, so
 * balance = opening + purchased − returned − paid stays right.
 */
export async function recordSupplierRefund(
  tx: Prisma.TransactionClient,
  input: { supplierId: string; amount: number; method: string; reference?: string | null; receivedAt: Date; note?: string | null; userId: string | null },
) {
  const amount = r3(input.amount);
  if (amount <= 0) throw new PurchasingError("Refund amount must be greater than zero.");
  const number = await nextDocumentNumber(tx, "SP", input.receivedAt);
  return tx.supplierPayment.create({
    data: {
      number,
      supplierId: input.supplierId,
      amount: -amount,
      method: input.method,
      reference: input.reference || null,
      paidAt: input.receivedAt,
      note: input.note || "Refund received",
      createdBy: input.userId,
    },
  });
}

/** Debit note / refund rows as plain JSON. */
export function serializePurchaseReturn(r: {
  id: string;
  number: string;
  returnedAt: Date;
  createdAt: Date;
  subtotal: unknown;
  taxTotal: unknown;
  total: unknown;
  reason: string | null;
  items: unknown;
  supplier?: { id: string; code: string; nameEn: string; nameAr: string | null } | null;
  purchaseOrder?: { id: string; number: string } | null;
}) {
  const items = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [];
  return {
    id: r.id,
    number: r.number,
    returnedAt: r.returnedAt.toISOString(),
    returnedOn: dayKey(r.returnedAt),
    createdAt: r.createdAt.toISOString(),
    subtotal: num(r.subtotal),
    taxTotal: num(r.taxTotal),
    total: num(r.total),
    reason: r.reason,
    units: items.reduce((s, it) => s + Number(it.quantity ?? 0), 0),
    items: items.map((it) => ({
      itemId: (it.itemId as string | null) ?? null,
      productId: (it.productId as string | null) ?? null,
      variantId: (it.variantId as string | null) ?? null,
      nameEn: String(it.nameEn ?? ""),
      nameAr: (it.nameAr as string | null) ?? null,
      variantLabel: (it.variantLabel as string | null) ?? null,
      sku: (it.sku as string | null) ?? null,
      quantity: Number(it.quantity ?? 0),
      unitCost: Number(it.unitCost ?? 0),
      taxRate: Number(it.taxRate ?? 0),
      net: Number(it.net ?? 0),
      tax: Number(it.tax ?? 0),
    })),
    supplier: r.supplier ?? null,
    purchaseOrder: r.purchaseOrder ?? null,
  };
}

/**
 * Records a payment to a supplier and spreads it over their orders — FIFO
 * over the oldest open orders, or the explicit allocations given. Whatever
 * isn't allocated stays as credit on their account.
 */
export async function recordSupplierPayment(
  tx: Prisma.TransactionClient,
  input: {
    supplierId: string;
    amount: number;
    method: string;
    reference?: string | null;
    paidAt: Date;
    note?: string | null;
    userId: string | null;
    autoAllocate: boolean;
    allocations?: { purchaseOrderId: string; amount: number }[];
  },
) {
  const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true } });
  if (!supplier) throw new PurchasingError("Supplier not found", 404);
  const amount = r3(input.amount);

  let allocations: { purchaseOrderId: string; amount: number }[];
  if (input.autoAllocate) {
    allocations = await autoAllocate(tx, input.supplierId, amount);
  } else {
    const merged = new Map<string, number>();
    for (const a of input.allocations ?? []) merged.set(a.purchaseOrderId, r3((merged.get(a.purchaseOrderId) ?? 0) + a.amount));
    const sum = r3(Array.from(merged.values()).reduce((s, v) => s + v, 0));
    if (sum > amount + 0.0005) throw new PurchasingError("The amounts applied to orders add up to more than the payment.");
    const pos = merged.size
      ? await tx.purchaseOrder.findMany({
          where: { id: { in: Array.from(merged.keys()) } },
          select: { id: true, number: true, supplierId: true, status: true, total: true, returnedTotal: true, amountPaid: true },
        })
      : [];
    for (const [poId, amt] of merged) {
      const po = pos.find((p) => p.id === poId);
      if (!po || po.supplierId !== input.supplierId) throw new PurchasingError("A selected order doesn't belong to this supplier.");
      if (!PAYABLE_STATUSES.includes(po.status)) throw new PurchasingError(`${po.number} isn't placed yet (or is cancelled): it can't be paid.`);
      if (amt > poOutstanding(po) + 0.0005) {
        throw new PurchasingError(`${po.number} only has ${poOutstanding(po).toFixed(3)} OMR left to pay.`);
      }
    }
    allocations = Array.from(merged.entries())
      .filter(([, a]) => a > 0)
      .map(([purchaseOrderId, a]) => ({ purchaseOrderId, amount: a }));
  }

  const number = await nextDocumentNumber(tx, "SP", input.paidAt);
  const payment = await tx.supplierPayment.create({
    data: {
      number,
      supplierId: input.supplierId,
      amount,
      method: input.method,
      reference: input.reference || null,
      paidAt: input.paidAt,
      note: input.note || null,
      createdBy: input.userId,
      allocations: { create: allocations },
    },
    include: { allocations: { include: { purchaseOrder: { select: { id: true, number: true } } } } },
  });
  for (const a of allocations) await rebalanceAllocations(tx, a.purchaseOrderId);
  const allocated = r3(allocations.reduce((s, a) => s + a.amount, 0));
  return { payment, allocated, unallocated: r3(amount - allocated) };
}

/** Plain JSON for a purchase order row (decimals → numbers, dates → ISO / day keys). */
export function serializePurchaseOrderRow(po: {
  id: string;
  number: string;
  status: PurchaseOrderStatus;
  supplierReference: string | null;
  orderDate: Date;
  expectedDate: Date | null;
  dueDate: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  subtotal: unknown;
  discount: unknown;
  shippingCost: unknown;
  otherCharges: unknown;
  taxTotal: unknown;
  total: unknown;
  amountPaid: unknown;
  returnedTotal: unknown;
  supplier?: { id: string; code: string; nameEn: string; nameAr: string | null } | null;
  items?: { quantity: number; receivedQty: number }[];
}) {
  const ordered = (po.items ?? []).reduce((s, i) => s + i.quantity, 0);
  const received = (po.items ?? []).reduce((s, i) => s + i.receivedQty, 0);
  const late = !!po.expectedDate && po.expectedDate < todayStart() && (po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED");
  return {
    id: po.id,
    number: po.number,
    status: po.status,
    supplierReference: po.supplierReference,
    orderDate: dayKey(po.orderDate),
    expectedDate: dayKey(po.expectedDate),
    dueDate: dayKey(po.dueDate),
    receivedAt: po.receivedAt ? po.receivedAt.toISOString() : null,
    createdAt: po.createdAt.toISOString(),
    supplier: po.supplier ?? null,
    lines: po.items?.length ?? 0,
    unitsOrdered: ordered,
    unitsReceived: received,
    lateDelivery: late,
    ...serializePoMoney(po as PoMoney & Record<string, unknown>),
  };
}
