import { InventoryTxType, Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export const INVENTORY_TX_TYPES = ["PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "DAMAGE", "TRANSFER"] as const;

// Movements that always add / always remove stock. ADJUSTMENT is signed
// (a stock-count correction can go either way).
const INBOUND: InventoryTxType[] = ["PURCHASE", "RETURN"];
const OUTBOUND: InventoryTxType[] = ["SALE", "DAMAGE", "TRANSFER"];

export function signedDelta(type: InventoryTxType, quantity: number): number {
  if (INBOUND.includes(type)) return Math.abs(quantity);
  if (OUTBOUND.includes(type)) return -Math.abs(quantity);
  return quantity;
}

export type StockFilter = {
  search?: string;
  status?: "all" | "in" | "low" | "out";
  categoryId?: string;
  sellerId?: string;
};

export function buildInventoryWhere(f: StockFilter): Prisma.InventoryWhereInput {
  const product: Prisma.ProductWhereInput = {
    ...(f.categoryId && { categoryId: f.categoryId }),
    ...(f.sellerId && { sellerId: f.sellerId }),
  };
  const and: Prisma.InventoryWhereInput[] = [];
  if (f.search) {
    const q = f.search;
    and.push({
      OR: [
        { variant: { sku: { contains: q, mode: "insensitive" } } },
        { variant: { barcode: { contains: q, mode: "insensitive" } } },
        { variant: { color: { contains: q, mode: "insensitive" } } },
        { variant: { product: { nameEn: { contains: q, mode: "insensitive" } } } },
        { variant: { product: { nameAr: { contains: q } } } },
        { variant: { product: { sku: { contains: q, mode: "insensitive" } } } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (f.status === "out") and.push({ quantity: { lte: 0 } });
  else if (f.status === "low") and.push({ quantity: { gt: 0, lte: prisma.inventory.fields.lowStockAlert } });
  else if (f.status === "in") and.push({ quantity: { gt: prisma.inventory.fields.lowStockAlert } });

  return {
    ...(Object.keys(product).length ? { variant: { product } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

type Movement = {
  variantId: string;
  type: InventoryTxType;
  quantity: number;
  note?: string | null;
  reference?: string | null;
  unitCost?: number | null;
  userId?: string | null;
};

/**
 * Applies one stock movement inside a transaction and writes the ledger row
 * (with the resulting balance). Ledger quantities stay positive and the type
 * gives the direction — except ADJUSTMENT, which is stored signed.
 * Receipts with a unit cost also update the product's purchase price as a
 * weighted average of the stock on hand and what just arrived, so profit
 * reports use a realistic cost.
 */
export async function applyMovement(tx: Prisma.TransactionClient, m: Movement) {
  const inv = await tx.inventory.findUnique({
    where: { variantId: m.variantId },
    include: { variant: { select: { productId: true } } },
  });
  if (!inv) throw new Error("Inventory not found for this variant");

  const delta = signedDelta(m.type, m.quantity);
  if (delta === 0) throw new Error("Quantity must not be zero.");
  if (delta < 0 && inv.quantity + delta < 0) {
    throw new Error(`Not enough stock: only ${inv.quantity} on hand.`);
  }

  if (m.type === "PURCHASE" && m.unitCost != null && m.unitCost >= 0) {
    const product = await tx.product.findUnique({ where: { id: inv.variant.productId }, select: { costPrice: true } });
    const onHand = await tx.inventory.aggregate({
      where: { variant: { productId: inv.variant.productId } },
      _sum: { quantity: true },
    });
    const qtyOnHand = Math.max(0, onHand._sum.quantity ?? 0);
    const oldCost = product?.costPrice != null ? Number(product.costPrice) : m.unitCost;
    const avg = (qtyOnHand * oldCost + delta * m.unitCost) / (qtyOnHand + delta);
    await tx.product.update({
      where: { id: inv.variant.productId },
      data: { costPrice: Math.round(avg * 1000) / 1000 },
    });
  }

  const updated = await tx.inventory.update({
    where: { id: inv.id },
    data: { quantity: { increment: delta } },
  });
  await tx.inventoryTransaction.create({
    data: {
      inventoryId: inv.id,
      type: m.type,
      quantity: m.type === "ADJUSTMENT" ? delta : Math.abs(delta),
      note: m.note || null,
      reference: m.reference || null,
      unitCost: m.unitCost ?? null,
      balanceAfter: updated.quantity,
      createdBy: m.userId ?? null,
    },
  });
  return updated;
}
