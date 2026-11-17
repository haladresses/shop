import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { addDays, businessDayEnd, businessDayStart, daysBetween, isDateKey, round3, toBusinessDateKey } from "@/lib/finance";
import { getTaxSettings } from "@/lib/tax";
import type { TaxBreakdownRow, TaxKind } from "@/lib/taxCalc";

// VAT return for a period (Oman-style):
//  • Output VAT — from each sale's own VAT breakdown, snapshotted when it was
//    rung up, so later rate changes never rewrite history. Sales count like
//    the finance report: paid, or (partly) refunded later.
//  • Credit notes — VAT given back on customer refunds in the period.
//  • Input VAT — VAT on supplier invoices (purchase orders that were placed),
//    dated by the supplier's invoice date, else the order date.
//  • Debit notes — VAT on goods returned to suppliers in the period.
//  Net VAT = (output − credit notes) − (input − debit notes).

const PAYABLE = ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"] as const;
const DOC_LIMIT = 200;
const n = (v: unknown) => (v == null ? 0 : Number(v));

type OutRow = { code: string; nameEn: string; nameAr: string; rate: number; type: TaxKind; taxable: number; tax: number; orders: number };

export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.tax.view", "admin.tax.manage"]);
    if ("res" in g) return g.res;

    const sp = req.nextUrl.searchParams;
    const todayKey = toBusinessDateKey(new Date());
    const toKey = isDateKey(sp.get("to")) ? sp.get("to")! : todayKey;
    const fromKey = isDateKey(sp.get("from")) ? sp.get("from")! : `${toKey.slice(0, 7)}-01`;
    if (fromKey > toKey) return error("'from' must be before 'to'");
    if (daysBetween(fromKey, toKey) > 366 * 3) return error("Range too large: pick at most 3 years");
    const from = businessDayStart(fromKey);
    const to = businessDayEnd(toKey);

    const [settings, orders, refunds, purchases, returns] = await Promise.all([
      getTaxSettings(),
      prisma.order.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          OR: [{ paymentStatus: "PAID" }, { refundedAmount: { gt: 0 } }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          invoiceNumber: true,
          createdAt: true,
          source: true,
          total: true,
          taxTotal: true,
          taxBreakdown: true,
          guestName: true,
          customerVatNumber: true,
          user: { select: { nameEn: true } },
        },
      }),
      prisma.refund.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          creditNoteNumber: true,
          createdAt: true,
          amount: true,
          taxAmount: true,
          order: { select: { id: true, orderNumber: true, invoiceNumber: true } },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: {
          status: { in: [...PAYABLE] },
          OR: [
            { invoiceDate: { gte: from, lte: to } },
            { invoiceDate: null, orderDate: { gte: from, lte: to } },
          ],
        },
        orderBy: { orderDate: "desc" },
        select: {
          id: true,
          number: true,
          supplierReference: true,
          invoiceDate: true,
          orderDate: true,
          taxTotal: true,
          total: true,
          shippingCost: true,
          otherCharges: true,
          supplier: { select: { id: true, nameEn: true, vatNumber: true } },
          items: { select: { taxRate: true, netAmount: true, taxAmount: true } },
        },
      }),
      prisma.purchaseReturn.findMany({
        where: { returnedAt: { gte: from, lte: to } },
        orderBy: { returnedAt: "desc" },
        select: {
          id: true,
          number: true,
          returnedAt: true,
          subtotal: true,
          taxTotal: true,
          total: true,
          supplier: { select: { nameEn: true, vatNumber: true } },
          purchaseOrder: { select: { id: true, number: true } },
        },
      }),
    ]);

    // ── Output VAT (sales) ──
    const outRows = new Map<string, OutRow>();
    let salesWithoutVat = 0;
    let ordersWithoutVat = 0;
    let ordersMissingInvoice = 0;
    for (const o of orders) {
      const rows = Array.isArray(o.taxBreakdown) ? (o.taxBreakdown as unknown as TaxBreakdownRow[]) : null;
      if (!rows || rows.length === 0) {
        salesWithoutVat += n(o.total);
        ordersWithoutVat++;
        continue;
      }
      if (!o.invoiceNumber) ordersMissingInvoice++;
      for (const r of rows) {
        const key = `${r.code}|${r.rate}|${r.type}`;
        const row = outRows.get(key) ?? { code: r.code, nameEn: r.nameEn, nameAr: r.nameAr, rate: n(r.rate), type: r.type, taxable: 0, tax: 0, orders: 0 };
        row.taxable += n(r.taxable);
        row.tax += n(r.tax);
        row.orders++;
        outRows.set(key, row);
      }
    }
    const output = Array.from(outRows.values())
      .map((r) => ({ ...r, taxable: round3(r.taxable), tax: round3(r.tax) }))
      .sort((a, b) => b.rate - a.rate);
    const sumBy = (type: TaxKind, f: "taxable" | "tax") => round3(output.filter((r) => r.type === type).reduce((s, r) => s + r[f], 0));
    const outputTax = round3(output.reduce((s, r) => s + r.tax, 0));
    const outputTaxable = round3(output.reduce((s, r) => s + r.taxable, 0));

    // ── Credit notes (customer refunds) ──
    const cnAmount = round3(refunds.reduce((s, r) => s + n(r.amount), 0));
    const cnTax = round3(refunds.reduce((s, r) => s + n(r.taxAmount), 0));

    // ── Input VAT (purchases) ──
    const inRows = new Map<number, { rate: number; net: number; tax: number; lines: number }>();
    let charges = 0;
    const atRisk = new Map<string, { supplierId: string; name: string; invoices: number; tax: number }>();
    for (const p of purchases) {
      charges += n(p.shippingCost) + n(p.otherCharges);
      for (const it of p.items) {
        const rate = n(it.taxRate);
        const row = inRows.get(rate) ?? { rate, net: 0, tax: 0, lines: 0 };
        row.net += n(it.netAmount);
        row.tax += n(it.taxAmount);
        row.lines++;
        inRows.set(rate, row);
      }
      if (n(p.taxTotal) > 0 && !p.supplier.vatNumber) {
        const r = atRisk.get(p.supplier.id) ?? { supplierId: p.supplier.id, name: p.supplier.nameEn, invoices: 0, tax: 0 };
        r.invoices++;
        r.tax = round3(r.tax + n(p.taxTotal));
        atRisk.set(p.supplier.id, r);
      }
    }
    const input = Array.from(inRows.values())
      .map((r) => ({ ...r, net: round3(r.net), tax: round3(r.tax) }))
      .sort((a, b) => b.rate - a.rate);
    const inputTax = round3(input.reduce((s, r) => s + r.tax, 0));
    const inputNet = round3(input.reduce((s, r) => s + r.net, 0));

    // ── Debit notes (returns to suppliers) ──
    const dnTotal = round3(returns.reduce((s, r) => s + n(r.total), 0));
    const dnTax = round3(returns.reduce((s, r) => s + n(r.taxTotal), 0));

    const netOutputVat = round3(outputTax - cnTax);
    const netInputVat = round3(inputTax - dnTax);
    const netVat = round3(netOutputVat - netInputVat);

    return ok({
      range: { from: fromKey, to: toKey },
      previousRange: { from: addDays(fromKey, -(daysBetween(fromKey, toKey) + 1)), to: addDays(fromKey, -1) },
      settings: {
        enabled: settings.enabled,
        pricesIncludeTax: settings.pricesIncludeTax,
        vatNumber: settings.vatNumber,
        legalNameEn: settings.legalNameEn,
        legalNameAr: settings.legalNameAr,
        crNumber: settings.crNumber,
      },
      output: {
        rows: output,
        taxable: outputTaxable,
        tax: outputTax,
        standardTaxable: sumBy("STANDARD", "taxable"),
        standardTax: sumBy("STANDARD", "tax"),
        zeroRatedTaxable: sumBy("ZERO_RATED", "taxable"),
        exemptTaxable: sumBy("EXEMPT", "taxable"),
        outOfScopeTaxable: sumBy("OUT_OF_SCOPE", "taxable"),
        ordersWithVat: orders.length - ordersWithoutVat,
        ordersWithoutVat,
        salesWithoutVat: round3(salesWithoutVat),
      },
      creditNotes: { count: refunds.length, amount: cnAmount, tax: cnTax, net: round3(cnAmount - cnTax) },
      input: { rows: input, net: inputNet, tax: inputTax, charges: round3(charges), invoices: purchases.length },
      debitNotes: { count: returns.length, total: dnTotal, tax: dnTax, net: round3(dnTotal - dnTax) },
      netOutputVat,
      netInputVat,
      netVat,
      warnings: {
        suppliersWithoutVat: Array.from(atRisk.values()).sort((a, b) => b.tax - a.tax),
        ordersMissingInvoice,
        vatDisabled: !settings.enabled,
        missingVatNumber: settings.enabled && !settings.vatNumber,
      },
      documents: {
        sales: orders
          .filter((o) => Array.isArray(o.taxBreakdown) && (o.taxBreakdown as unknown[]).length > 0)
          .slice(0, DOC_LIMIT)
          .map((o) => {
            const rows = o.taxBreakdown as unknown as TaxBreakdownRow[];
            return {
              id: o.id,
              orderNumber: o.orderNumber,
              invoiceNumber: o.invoiceNumber,
              date: o.createdAt.toISOString(),
              source: o.source,
              customer: o.user?.nameEn || o.guestName || "",
              customerVatNumber: o.customerVatNumber,
              taxable: round3(rows.reduce((s, r) => s + n(r.taxable), 0)),
              tax: round3(n(o.taxTotal)),
              total: round3(n(o.total)),
            };
          }),
        creditNotes: refunds.slice(0, DOC_LIMIT).map((r) => ({
          id: r.id,
          creditNoteNumber: r.creditNoteNumber,
          orderId: r.order.id,
          orderNumber: r.order.orderNumber,
          invoiceNumber: r.order.invoiceNumber,
          date: r.createdAt.toISOString(),
          amount: round3(n(r.amount)),
          tax: round3(n(r.taxAmount)),
        })),
        purchases: purchases.slice(0, DOC_LIMIT).map((p) => {
          const tax = n(p.taxTotal);
          const extra = n(p.shippingCost) + n(p.otherCharges);
          return {
            id: p.id,
            number: p.number,
            supplierReference: p.supplierReference,
            supplierName: p.supplier.nameEn,
            supplierVatNumber: p.supplier.vatNumber,
            date: (p.invoiceDate ?? p.orderDate).toISOString(),
            net: round3(n(p.total) - tax - extra),
            charges: round3(extra),
            tax: round3(tax),
            total: round3(n(p.total)),
          };
        }),
        debitNotes: returns.slice(0, DOC_LIMIT).map((r) => ({
          id: r.id,
          number: r.number,
          purchaseOrderId: r.purchaseOrder?.id ?? null,
          purchaseOrderNumber: r.purchaseOrder?.number ?? null,
          supplierName: r.supplier.nameEn,
          date: r.returnedAt.toISOString(),
          net: round3(n(r.subtotal)),
          tax: round3(n(r.taxTotal)),
          total: round3(n(r.total)),
        })),
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
