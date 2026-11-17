import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { businessDayEnd, businessDayStart, isDateKey } from "@/lib/finance";
import { PAYABLE_STATUSES, SUPPLIER_STATEMENT_ORDER, dayKey, num } from "@/lib/purchasing";
import { r3 } from "@/lib/taxCalc";

type Entry = {
  date: Date;
  type: "OPENING" | "PURCHASE" | "RETURN" | "PAYMENT" | "REFUND";
  number: string | null;
  description: string;
  debit: number;
  credit: number;
  link: string | null;
};

/**
 * Account statement: every purchase (we owe more), return and payment (we owe
 * less) with a running balance. ?from=&to= (YYYY-MM-DD) limit the period; the
 * balance before `from` is brought forward.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.suppliers.view");
    if ("res" in g) return g.res;
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    const from = isDateKey(sp.get("from")) ? sp.get("from")! : null;
    const to = isDateKey(sp.get("to")) ? sp.get("to")! : null;

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return notFound("Supplier");

    const [orders, returns, payments] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { supplierId: id, status: { in: PAYABLE_STATUSES } },
        select: { id: true, number: true, orderDate: true, orderedAt: true, total: true, supplierReference: true, taxTotal: true },
      }),
      prisma.purchaseReturn.findMany({
        where: { supplierId: id },
        select: { id: true, number: true, returnedAt: true, total: true, reason: true, purchaseOrder: { select: { id: true, number: true } } },
      }),
      prisma.supplierPayment.findMany({
        where: { supplierId: id },
        select: { id: true, number: true, paidAt: true, amount: true, method: true, reference: true, note: true },
      }),
    ]);

    const entries: Entry[] = [];
    const opening = num(supplier.openingBalance);
    if (Math.abs(opening) > 0.0005) {
      entries.push({
        date: supplier.createdAt,
        type: "OPENING",
        number: null,
        description: "Opening balance",
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? -opening : 0,
        link: null,
      });
    }
    for (const o of orders) {
      entries.push({
        date: o.orderedAt ?? o.orderDate,
        type: "PURCHASE",
        number: o.number,
        description: `Purchase${o.supplierReference ? ` · invoice ${o.supplierReference}` : ""}${num(o.taxTotal) > 0 ? ` (incl. VAT ${num(o.taxTotal).toFixed(3)})` : ""}`,
        debit: num(o.total),
        credit: 0,
        link: `/admin/purchases/${o.id}`,
      });
    }
    for (const r of returns) {
      entries.push({
        date: r.returnedAt,
        type: "RETURN",
        number: r.number,
        description: `Goods returned${r.purchaseOrder ? ` from ${r.purchaseOrder.number}` : ""}${r.reason ? `: ${r.reason}` : ""}`,
        debit: 0,
        credit: num(r.total),
        link: r.purchaseOrder ? `/admin/purchases/${r.purchaseOrder.id}` : null,
      });
    }
    for (const p of payments) {
      const amt = num(p.amount);
      const how = `${p.method.replace("_", " ").toLowerCase()}${p.reference ? ` · ref ${p.reference}` : ""}`;
      // A negative payment is money the supplier paid back to us.
      entries.push(
        amt < 0
          ? { date: p.paidAt, type: "REFUND", number: p.number, description: `Refund received · ${how}${p.note ? ` · ${p.note}` : ""}`, debit: -amt, credit: 0, link: null }
          : { date: p.paidAt, type: "PAYMENT", number: p.number, description: `Payment · ${how}`, debit: 0, credit: amt, link: null },
      );
    }
    entries.sort((a, b) => a.date.getTime() - b.date.getTime() || SUPPLIER_STATEMENT_ORDER[a.type] - SUPPLIER_STATEMENT_ORDER[b.type]);

    const fromAt = from ? businessDayStart(from) : null;
    const toAt = to ? businessDayEnd(to) : null;
    let running = 0;
    let broughtForward = 0;
    const rows: (Omit<Entry, "date"> & { date: string; balance: number })[] = [];
    for (const e of entries) {
      running = r3(running + e.debit - e.credit);
      if (fromAt && e.date < fromAt) {
        broughtForward = running;
        continue;
      }
      if (toAt && e.date > toAt) continue;
      rows.push({ ...e, date: e.date.toISOString(), balance: running });
    }
    const totals = {
      debit: r3(rows.reduce((s, r) => s + r.debit, 0)),
      credit: r3(rows.reduce((s, r) => s + r.credit, 0)),
    };
    return ok({
      supplier: {
        id: supplier.id,
        code: supplier.code,
        nameEn: supplier.nameEn,
        nameAr: supplier.nameAr,
        vatNumber: supplier.vatNumber,
        crNumber: supplier.crNumber,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        city: supplier.city,
        country: supplier.country,
        paymentTermsDays: supplier.paymentTermsDays,
      },
      from,
      to,
      generatedAt: new Date().toISOString(),
      generatedOn: dayKey(new Date()),
      broughtForward,
      entries: rows,
      totals,
      closingBalance: r3(broughtForward + totals.debit - totals.credit),
    });
  } catch (e) {
    return serverError(e);
  }
}
