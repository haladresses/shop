import type { Prisma } from "@prisma/client";

// Auto-generated item barcodes: 13-digit EAN codes in the GS1 "in-store"
// range (prefix 20 — reserved for a shop's own internal numbering, never
// clashes with manufacturers' codes). Every retail scanner reads them, and
// they're compact enough for small labels.
//
//   20 · 10-digit running number · check digit   e.g. 2000000000015

const PREFIX = "20";
const SEQUENCE_KEY = "BARCODE";

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];
}

const toCode = (n: number) => {
  const first12 = PREFIX + String(n).padStart(10, "0");
  return first12 + ean13CheckDigit(first12);
};

/**
 * Reserves `count` new barcodes that aren't used by any product or variant.
 * Runs inside the caller's transaction; the running number only ever goes
 * up, so two people generating at once never get the same code.
 */
export async function allocateBarcodes(tx: Prisma.TransactionClient, count: number): Promise<string[]> {
  const out: string[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 20) {
    const need = count - out.length;
    const row = await tx.documentSequence.upsert({
      where: { key: SEQUENCE_KEY },
      create: { key: SEQUENCE_KEY, value: need },
      update: { value: { increment: need } },
    });
    const candidates = Array.from({ length: need }, (_, i) => toCode(row.value - need + 1 + i));
    // Skip any code someone already typed in by hand.
    const [variants, products] = await Promise.all([
      tx.productVariant.findMany({ where: { barcode: { in: candidates } }, select: { barcode: true } }),
      tx.product.findMany({ where: { barcode: { in: candidates } }, select: { barcode: true } }),
    ]);
    const taken = new Set([...variants, ...products].map((r) => r.barcode));
    out.push(...candidates.filter((c) => !taken.has(c)));
  }
  if (out.length < count) throw new Error("Could not allocate barcodes");
  return out;
}

/**
 * Gives every listed product (or every product, with "all") that has no
 * barcode its own code, saved on the product. The product's barcode is THE
 * code for that item — printed on labels and scannable everywhere; a
 * size/colour can optionally carry its own more specific code.
 */
export async function assignProductBarcodes(
  tx: Prisma.TransactionClient,
  productIds: string[] | "all",
): Promise<{ productId: string; barcode: string }[]> {
  const missing = await tx.product.findMany({
    where: { barcode: null, ...(productIds === "all" ? {} : { id: { in: productIds } }) },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (missing.length === 0) return [];
  const codes = await allocateBarcodes(tx, missing.length);
  const out: { productId: string; barcode: string }[] = [];
  for (let i = 0; i < missing.length; i++) {
    await tx.product.update({ where: { id: missing[i].id }, data: { barcode: codes[i] } });
    out.push({ productId: missing[i].id, barcode: codes[i] });
  }
  return out;
}

/** The code to print/scan for an item: its own size/colour code, else the product's. */
export function effectiveBarcode(variant: { barcode?: string | null } | null | undefined, product: { barcode?: string | null }): string | null {
  return variant?.barcode || product.barcode || null;
}

// ── Search by code, the same way on every screen ──
// A typed or scanned value matches a product by its name-independent codes:
// the product's barcode / SKU or any of its sizes'/colours' barcode / SKU.

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Product-level conditions (use inside an OR together with name matches). */
export function productCodeConditions(q: string): Prisma.ProductWhereInput[] {
  return [
    { barcode: ci(q) },
    { sku: ci(q) },
    { variants: { some: { OR: [{ barcode: ci(q) }, { sku: ci(q) }] } } },
  ];
}

/** Orders containing an item with this code (also matches the code saved on the order line). */
export function orderItemCodeCondition(q: string): Prisma.OrderWhereInput {
  return {
    items: {
      some: {
        OR: [
          { product: { OR: [{ barcode: ci(q) }, { sku: ci(q) }] } },
          { variant: { OR: [{ barcode: ci(q) }, { sku: ci(q) }] } },
          { productSnapshot: { path: ["barcode"], equals: q } },
          { productSnapshot: { path: ["sku"], equals: q } },
        ],
      },
    },
  };
}
