import type { Prisma } from "@prisma/client";
import { toBusinessDateKey } from "@/lib/finance";

// Sequential, gap-free document numbers (tax invoices must be numbered
// sequentially). Always call inside the transaction that creates the
// document so a rolled-back sale doesn't burn a number.

export type DocumentSeries =
  | "INV" // tax invoice (sale)
  | "CN" // credit note (customer refund)
  | "PO" // purchase order
  | "GRN" // goods received note
  | "DN" // debit note (return to supplier)
  | "SP" // supplier payment
  | "SUP"; // supplier code (not per year)

const PAD: Record<DocumentSeries, number> = { INV: 6, CN: 5, PO: 5, GRN: 5, DN: 5, SP: 5, SUP: 4 };

/** Returns e.g. "INV-2026-000123" (or "SUP-0007" for supplier codes). */
export async function nextDocumentNumber(tx: Prisma.TransactionClient, series: DocumentSeries, at: Date = new Date()): Promise<string> {
  const yearly = series !== "SUP";
  const year = toBusinessDateKey(at).slice(0, 4);
  const key = yearly ? `${series}-${year}` : series;
  const row = await tx.documentSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  const n = String(row.value).padStart(PAD[series], "0");
  return yearly ? `${series}-${year}-${n}` : `${series}-${n}`;
}
