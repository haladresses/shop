// Shapes returned by the purchasing APIs (see src/app/api/purchases/** and
// src/app/api/suppliers/**), shared by the purchasing screens.

import type { Task } from "./Tasks";

export type PoRow = {
  id: string;
  number: string;
  status: string;
  supplierReference: string | null;
  orderDate: string | null;
  expectedDate: string | null;
  dueDate: string | null;
  receivedAt: string | null;
  createdAt: string;
  supplier: { id: string; code: string; nameEn: string; nameAr: string | null } | null;
  lines: number;
  unitsOrdered: number;
  unitsReceived: number;
  lateDelivery: boolean;
  subtotal: number;
  discount: number;
  shippingCost: number;
  otherCharges: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  returnedTotal: number;
  outstanding: number;
  paymentStatus: string;
  overdue: boolean;
  daysOverdue: number;
};

export type PoItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  nameEn: string;
  nameAr: string | null;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
  productActive: boolean | null;
  onHand: number | null;
  quantity: number;
  receivedQty: number;
  returnedQty: number;
  unitCost: number;
  discountPct: number;
  taxRate: number;
  taxCode: string | null;
  netAmount: number;
  taxAmount: number;
  landedUnitCost: number | null;
};

export type PoReceipt = {
  id: string;
  number: string;
  receivedAt: string;
  units: number;
  value: number;
  note: string | null;
  items: unknown;
  createdBy: string;
};

export type PoReturn = {
  id: string;
  number: string;
  returnedAt: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  reason: string | null;
  items: unknown;
  createdBy: string;
};

export type PoDetailData = {
  id: string;
  number: string;
  status: string;
  supplierReference: string | null;
  invoiceDate: string | null;
  orderDate: string | null;
  expectedDate: string | null;
  dueDate: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  pricesIncludeTax: boolean;
  notes: string | null;
  attachments: { url: string; name: string }[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  otherCharges: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  returnedTotal: number;
  outstanding: number;
  paymentStatus: string;
  overdue: boolean;
  daysOverdue: number;
  canEditAll: boolean;
  hasReceipts: boolean;
  supplier: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string | null;
    contactPerson: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string;
    vatNumber: string | null;
    crNumber: string | null;
    paymentTermsDays: number;
    isActive: boolean;
    balance: number;
  };
  items: PoItem[];
  receipts: PoReceipt[];
  returns: PoReturn[];
  payments: {
    allocationId: string;
    amount: number;
    payment: { id: string; number: string; paidAt: string; method: string; reference: string | null; amount: number };
  }[];
  tasks: Task[];
};

export type ReturnItemJson = {
  itemId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  nameEn?: string;
  nameAr?: string | null;
  variantLabel?: string | null;
  sku?: string | null;
  quantity?: number;
  unitCost?: number;
  taxRate?: number;
  net?: number;
  tax?: number;
};

/** Normalises the JSON `items` of a debit note for printing. */
export function returnItems(raw: unknown) {
  const list = Array.isArray(raw) ? (raw as ReturnItemJson[]) : [];
  return list.map((it) => ({
    nameEn: String(it.nameEn ?? ""),
    nameAr: it.nameAr ?? null,
    variantLabel: it.variantLabel ?? null,
    sku: it.sku ?? null,
    quantity: Number(it.quantity ?? 0),
    unitCost: Number(it.unitCost ?? 0),
    taxRate: Number(it.taxRate ?? 0),
    net: Number(it.net ?? 0),
    tax: Number(it.tax ?? 0),
  }));
}

/** "/admin/products/labels?items=<variantId>:<qty>,…" for a delivery's items (stock items only). */
export function labelsLinkFor(items: unknown): string | null {
  const list = Array.isArray(items) ? (items as { variantId?: string | null; quantity?: number }[]) : [];
  const qty = new Map<string, number>();
  for (const it of list) {
    if (it.variantId && Number(it.quantity) > 0) qty.set(it.variantId, (qty.get(it.variantId) ?? 0) + Number(it.quantity));
  }
  if (qty.size === 0) return null;
  return `/admin/products/labels?items=${Array.from(qty.entries())
    .map(([id, n]) => `${id}:${n}`)
    .join(",")}`;
}
