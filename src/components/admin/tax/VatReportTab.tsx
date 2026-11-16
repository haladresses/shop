"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LuCircleAlert, LuDownload, LuPrinter, LuRefreshCw, LuScale, LuTrendingDown, LuTrendingUp, LuWallet } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import { addDays, toBusinessDateKey } from "@/lib/finance";
import { rateLabel, type TaxKind } from "@/lib/taxCalc";
import { fetchJson, money, useStoreInfo } from "./shared";

type Report = {
  range: { from: string; to: string };
  settings: { enabled: boolean; pricesIncludeTax: boolean; vatNumber: string; legalNameEn: string; legalNameAr: string; crNumber: string };
  output: {
    rows: { code: string; nameEn: string; nameAr: string; rate: number; type: TaxKind; taxable: number; tax: number; orders: number }[];
    taxable: number;
    tax: number;
    standardTaxable: number;
    standardTax: number;
    zeroRatedTaxable: number;
    exemptTaxable: number;
    outOfScopeTaxable: number;
    ordersWithVat: number;
    ordersWithoutVat: number;
    salesWithoutVat: number;
  };
  creditNotes: { count: number; amount: number; tax: number; net: number };
  input: { rows: { rate: number; net: number; tax: number; lines: number }[]; net: number; tax: number; charges: number; invoices: number };
  debitNotes: { count: number; total: number; tax: number; net: number };
  netOutputVat: number;
  netInputVat: number;
  netVat: number;
  warnings: {
    suppliersWithoutVat: { supplierId: string; name: string; invoices: number; tax: number }[];
    ordersMissingInvoice: number;
    vatDisabled: boolean;
    missingVatNumber: boolean;
  };
  documents: {
    sales: { id: string; orderNumber: string; invoiceNumber: string | null; date: string; source: string; customer: string; customerVatNumber: string | null; taxable: number; tax: number; total: number }[];
    creditNotes: { id: string; creditNoteNumber: string | null; orderId: string; orderNumber: string; invoiceNumber: string | null; date: string; amount: number; tax: number }[];
    purchases: { id: string; number: string; supplierReference: string | null; supplierName: string; supplierVatNumber: string | null; date: string; net: number; charges: number; tax: number; total: number }[];
    debitNotes: { id: string; number: string; purchaseOrderId: string | null; purchaseOrderNumber: string | null; supplierName: string; date: string; net: number; tax: number; total: number }[];
  };
};

type Preset = "this-month" | "last-month" | "this-quarter" | "last-quarter" | "this-year" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "this-quarter", label: "This quarter" },
  { id: "last-quarter", label: "Last quarter" },
  { id: "this-year", label: "This year" },
  { id: "custom", label: "Custom" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const monthEnd = (y: number, m: number) => addDays(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`, -1);

function presetRange(p: Preset): { from: string; to: string } {
  const today = toBusinessDateKey(new Date());
  const [y, m] = today.split("-").map(Number);
  const q = Math.floor((m - 1) / 3); // 0..3
  switch (p) {
    case "last-month": {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return { from: `${ly}-${pad(lm)}-01`, to: monthEnd(ly, lm) };
    }
    case "this-quarter":
      return { from: `${y}-${pad(q * 3 + 1)}-01`, to: today };
    case "last-quarter": {
      const lq = q === 0 ? 3 : q - 1;
      const ly = q === 0 ? y - 1 : y;
      return { from: `${ly}-${pad(lq * 3 + 1)}-01`, to: monthEnd(ly, lq * 3 + 3) };
    }
    case "this-year":
      return { from: `${y}-01-01`, to: today };
    default:
      return { from: `${y}-${pad(m)}-01`, to: today };
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Muscat" });

type Box = { no: string; en: string; ar: string; base: number | null; vat: number | null; strong?: boolean; tone?: "neg" };

function buildBoxes(r: Report): Box[] {
  const inputTaxed = r.input.rows.filter((x) => x.rate > 0).reduce((s, x) => s + x.net, 0);
  const inputUntaxed = r.input.rows.filter((x) => x.rate <= 0).reduce((s, x) => s + x.net, 0);
  return [
    { no: "1a", en: "Standard-rated supplies", ar: "التوريدات الخاضعة للنسبة الأساسية", base: r.output.standardTaxable, vat: r.output.standardTax },
    { no: "1b", en: "Zero-rated supplies", ar: "التوريدات الخاضعة لنسبة الصفر", base: r.output.zeroRatedTaxable, vat: null },
    { no: "1c", en: "Exempt supplies", ar: "التوريدات المعفاة", base: r.output.exemptTaxable, vat: null },
    { no: "1d", en: "Out-of-scope supplies", ar: "توريدات خارج النطاق", base: r.output.outOfScopeTaxable, vat: null },
    { no: "1e", en: "Credit notes (customer refunds)", ar: "الإشعارات الدائنة (مرتجعات المبيعات)", base: -r.creditNotes.net, vat: -r.creditNotes.tax, tone: "neg" },
    { no: "2", en: "Total output VAT", ar: "إجمالي ضريبة المخرجات", base: null, vat: r.netOutputVat, strong: true },
    { no: "3a", en: "Purchases subject to VAT", ar: "المشتريات الخاضعة للضريبة", base: inputTaxed, vat: r.input.tax },
    { no: "3b", en: "Purchases without VAT", ar: "المشتريات غير الخاضعة للضريبة", base: inputUntaxed, vat: null },
    { no: "3c", en: "Freight & other charges", ar: "الشحن والرسوم الأخرى", base: r.input.charges, vat: null },
    { no: "3d", en: "Debit notes (returns to suppliers)", ar: "الإشعارات المدينة (مرتجعات المشتريات)", base: -r.debitNotes.net, vat: -r.debitNotes.tax, tone: "neg" },
    { no: "4", en: "Total recoverable input VAT", ar: "إجمالي ضريبة المدخلات القابلة للاسترداد", base: null, vat: r.netInputVat, strong: true },
    {
      no: "5",
      en: r.netVat >= 0 ? "Net VAT payable" : "Net VAT refundable",
      ar: r.netVat >= 0 ? "صافي الضريبة المستحقة الدفع" : "صافي الضريبة القابلة للاسترداد",
      base: null,
      vat: Math.abs(r.netVat),
      strong: true,
    },
  ];
}

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(name: string, rows: unknown[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type DocTab = "sales" | "creditNotes" | "purchases" | "debitNotes";

export default function VatReportTab() {
  const [preset, setPreset] = useState<Preset>("this-month");
  const [range, setRange] = useState(() => presetRange("this-month"));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [docTab, setDocTab] = useState<DocTab>("sales");
  const store = useStoreInfo();

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const d = await fetchJson<Report>(`/api/tax/report?from=${range.from}&to=${range.to}`);
    setLoading(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not load the report");
    setData(d.data);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const boxes = useMemo(() => (data ? buildBoxes(data) : []), [data]);

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const exportCsv = () => {
    if (!data) return;
    const rows: unknown[][] = [
      ["VAT report", `${data.range.from} to ${data.range.to}`],
      ["VAT number", data.settings.vatNumber],
      [],
      ["Box", "Description", "Amount (excl. VAT)", "VAT"],
      ...boxes.map((b) => [b.no, b.en, b.base == null ? "" : b.base.toFixed(3), b.vat == null ? "" : b.vat.toFixed(3)]),
      [],
    ];
    if (docTab === "sales") {
      rows.push(["Invoice", "Order", "Date", "Channel", "Customer", "Customer VAT no.", "Taxable", "VAT", "Total"]);
      data.documents.sales.forEach((s) => rows.push([s.invoiceNumber, s.orderNumber, fmtDate(s.date), s.source, s.customer, s.customerVatNumber, s.taxable, s.tax, s.total]));
    } else if (docTab === "creditNotes") {
      rows.push(["Credit note", "Order", "Invoice", "Date", "Amount", "VAT"]);
      data.documents.creditNotes.forEach((c) => rows.push([c.creditNoteNumber, c.orderNumber, c.invoiceNumber, fmtDate(c.date), c.amount, c.tax]));
    } else if (docTab === "purchases") {
      rows.push(["PO", "Supplier invoice", "Supplier", "Supplier VAT no.", "Date", "Net", "Charges", "VAT", "Total"]);
      data.documents.purchases.forEach((p) => rows.push([p.number, p.supplierReference, p.supplierName, p.supplierVatNumber, fmtDate(p.date), p.net, p.charges, p.tax, p.total]));
    } else {
      rows.push(["Debit note", "PO", "Supplier", "Date", "Net", "VAT", "Total"]);
      data.documents.debitNotes.forEach((d) => rows.push([d.number, d.purchaseOrderNumber, d.supplierName, fmtDate(d.date), d.net, d.tax, d.total]));
    }
    downloadCsv(`vat-report-${data.range.from}-${data.range.to}-${docTab}.csv`, rows);
  };

  const legalEn = data?.settings.legalNameEn || store.store_name_en || "Hala Dresses";
  const legalAr = data?.settings.legalNameAr || store.store_name_ar || "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => choose(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p.id ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" className="admin-input !w-auto !py-1.5" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From" />
            <span className="text-slate-400">→</span>
            <input type="date" className="admin-input !w-auto !py-1.5" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To" />
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={load} className="admin-btn admin-btn-secondary" title="Refresh">
            <LuRefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={exportCsv} disabled={!data} className="admin-btn admin-btn-secondary">
            <LuDownload size={15} /> CSV
          </button>
          <button
            onClick={() => printArea("vat-report", { page: "a4", title: `VAT report ${data?.range.from} – ${data?.range.to}` })}
            disabled={!data}
            className="admin-btn admin-btn-primary"
          >
            <LuPrinter size={15} /> Print
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{err}</p>}

      {data && (
        <>
          <Warnings data={data} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={LuTrendingUp} label="Output VAT (sales)" value={money(data.netOutputVat)} sub={`${data.output.ordersWithVat} invoices · ${data.creditNotes.count} credit notes`} />
            <Kpi icon={LuTrendingDown} label="Input VAT (purchases)" value={money(data.netInputVat)} sub={`${data.input.invoices} supplier invoices`} />
            <Kpi
              icon={LuScale}
              label={data.netVat >= 0 ? "Net VAT payable" : "Net VAT refundable"}
              value={money(Math.abs(data.netVat))}
              tone={data.netVat >= 0 ? "pay" : "refund"}
              sub={`${data.range.from} → ${data.range.to}`}
            />
            <Kpi icon={LuWallet} label="Sales without VAT" value={money(data.output.salesWithoutVat)} sub={`${data.output.ordersWithoutVat} orders (VAT was off)`} />
          </div>

          <div className="admin-card overflow-x-auto">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">VAT return summary</h3>
              <p className="text-xs text-slate-500">Amounts in OMR. Use these figures for your return to the Oman Tax Authority.</p>
            </div>
            <table className="admin-table min-w-[560px]">
              <thead>
                <tr>
                  <th className="w-14">Box</th>
                  <th>Description</th>
                  <th className="text-right">Amount (excl. VAT)</th>
                  <th className="text-right">VAT</th>
                </tr>
              </thead>
              <tbody>
                {boxes.map((b) => (
                  <tr key={b.no} className={b.strong ? "bg-slate-50" : ""}>
                    <td className="font-mono text-slate-500">{b.no}</td>
                    <td className={b.strong ? "font-semibold" : ""}>
                      {b.en}
                      <span className="block text-xs text-slate-400" dir="rtl">
                        {b.ar}
                      </span>
                    </td>
                    <td className={`text-right tabular-nums ${b.tone === "neg" ? "text-rose-600" : ""}`}>{b.base == null ? "" : money(b.base)}</td>
                    <td className={`text-right tabular-nums ${b.strong ? "font-bold" : ""} ${b.tone === "neg" ? "text-rose-600" : ""}`}>{b.vat == null ? "" : money(b.vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="admin-card overflow-x-auto">
              <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800">Sales by rate</div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rate</th>
                    <th className="text-right">Invoices</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.output.rows.map((r) => (
                    <tr key={`${r.code}-${r.rate}-${r.type}`}>
                      <td>
                        {r.nameEn} <span className="text-xs text-slate-400">({rateLabel(r)})</span>
                      </td>
                      <td className="text-right tabular-nums">{r.orders}</td>
                      <td className="text-right tabular-nums">{money(r.taxable)}</td>
                      <td className="text-right tabular-nums font-medium">{money(r.tax)}</td>
                    </tr>
                  ))}
                  {data.output.rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-400 py-6">
                        No VAT sales in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-card overflow-x-auto">
              <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800">Purchases by rate</div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rate</th>
                    <th className="text-right">Lines</th>
                    <th className="text-right">Net</th>
                    <th className="text-right">VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.input.rows.map((r) => (
                    <tr key={r.rate}>
                      <td>{r.rate}%</td>
                      <td className="text-right tabular-nums">{r.lines}</td>
                      <td className="text-right tabular-nums">{money(r.net)}</td>
                      <td className="text-right tabular-nums font-medium">{money(r.tax)}</td>
                    </tr>
                  ))}
                  {data.input.rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-400 py-6">
                        No supplier invoices in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Documents data={data} tab={docTab} setTab={setDocTab} />

          <PrintArea id="vat-report">
            <VatPrint data={data} boxes={boxes} legalEn={legalEn} legalAr={legalAr} store={store} />
          </PrintArea>
        </>
      )}
      {loading && !data && (
        <div className="flex justify-center py-16">
          <span className="spinner" />
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: "pay" | "refund" }) {
  const color = tone === "pay" ? "bg-rose-50 text-rose-600" : tone === "refund" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600";
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3 min-w-0">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 tabular-nums truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function Warnings({ data }: { data: Report }) {
  const w = data.warnings;
  const items: React.ReactNode[] = [];
  if (w.vatDisabled) items.push(<>VAT is currently switched off — new sales don&apos;t record VAT.</>);
  if (w.missingVatNumber) items.push(<>No VAT number is set — tax invoices are printed without it (Settings tab).</>);
  if (w.ordersMissingInvoice > 0) items.push(<>{w.ordersMissingInvoice} VAT sale(s) have no tax-invoice number.</>);
  if (w.suppliersWithoutVat.length > 0)
    items.push(
      <>
        Input VAT may not be reclaimable — these suppliers charged VAT but have no VAT number on file:{" "}
        {w.suppliersWithoutVat.map((s, i) => (
          <span key={s.supplierId}>
            {i > 0 && ", "}
            <Link href={`/admin/suppliers/${s.supplierId}`} className="underline font-medium">
              {s.name}
            </Link>{" "}
            ({money(s.tax)} on {s.invoices} invoice{s.invoices === 1 ? "" : "s"})
          </span>
        ))}
        .
      </>,
    );
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
      {items.map((it, i) => (
        <p key={i} className="flex items-start gap-2 text-sm text-amber-900">
          <LuCircleAlert size={15} className="mt-0.5 shrink-0" />
          <span>{it}</span>
        </p>
      ))}
    </div>
  );
}

function Documents({ data, tab, setTab }: { data: Report; tab: DocTab; setTab: (t: DocTab) => void }) {
  const tabs: { id: DocTab; label: string; count: number }[] = [
    { id: "sales", label: "Sales invoices", count: data.documents.sales.length },
    { id: "creditNotes", label: "Credit notes", count: data.documents.creditNotes.length },
    { id: "purchases", label: "Supplier invoices", count: data.documents.purchases.length },
    { id: "debitNotes", label: "Debit notes", count: data.documents.debitNotes.length },
  ];
  return (
    <div className="admin-card">
      <div className="flex flex-wrap gap-1 px-3 pt-3 border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px ${
              tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label} <span className="text-xs text-slate-400">({t.count})</span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {tab === "sales" && (
          <table className="admin-table min-w-[760px]">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Channel</th>
                <th>Customer</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-mono text-xs font-semibold">{s.invoiceNumber || "—"}</p>
                    <p className="text-xs text-slate-400">{s.orderNumber}</p>
                  </td>
                  <td className="whitespace-nowrap">{fmtDate(s.date)}</td>
                  <td className="text-xs">{s.source}</td>
                  <td>
                    {s.customer}
                    {s.customerVatNumber && <span className="block text-[11px] text-slate-400 font-mono">VAT {s.customerVatNumber}</span>}
                  </td>
                  <td className="text-right tabular-nums">{money(s.taxable)}</td>
                  <td className="text-right tabular-nums">{money(s.tax)}</td>
                  <td className="text-right tabular-nums font-medium">{money(s.total)}</td>
                </tr>
              ))}
              {data.documents.sales.length === 0 && <EmptyRow cols={7} />}
            </tbody>
          </table>
        )}
        {tab === "creditNotes" && (
          <table className="admin-table min-w-[620px]">
            <thead>
              <tr>
                <th>Credit note</th>
                <th>Against</th>
                <th>Date</th>
                <th className="text-right">Refunded</th>
                <th className="text-right">VAT reversed</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.creditNotes.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs font-semibold">{c.creditNoteNumber || "—"}</td>
                  <td className="text-xs">
                    {c.invoiceNumber || c.orderNumber}
                    {c.invoiceNumber && <span className="block text-slate-400">{c.orderNumber}</span>}
                  </td>
                  <td className="whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td className="text-right tabular-nums">{money(c.amount)}</td>
                  <td className="text-right tabular-nums">{money(c.tax)}</td>
                </tr>
              ))}
              {data.documents.creditNotes.length === 0 && <EmptyRow cols={5} />}
            </tbody>
          </table>
        )}
        {tab === "purchases" && (
          <table className="admin-table min-w-[820px]">
            <thead>
              <tr>
                <th>Purchase order</th>
                <th>Supplier</th>
                <th>Date</th>
                <th className="text-right">Net</th>
                <th className="text-right">Charges</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.purchases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/purchases/${p.id}`} className="font-mono text-xs font-semibold text-indigo-600 hover:underline">
                      {p.number}
                    </Link>
                    {p.supplierReference && <span className="block text-xs text-slate-400">Inv. {p.supplierReference}</span>}
                  </td>
                  <td>
                    {p.supplierName}
                    {p.supplierVatNumber ? (
                      <span className="block text-[11px] text-slate-400 font-mono">VAT {p.supplierVatNumber}</span>
                    ) : p.tax > 0 ? (
                      <span className="block text-[11px] text-amber-600">No VAT number</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="text-right tabular-nums">{money(p.net)}</td>
                  <td className="text-right tabular-nums text-slate-500">{money(p.charges)}</td>
                  <td className="text-right tabular-nums">{money(p.tax)}</td>
                  <td className="text-right tabular-nums font-medium">{money(p.total)}</td>
                </tr>
              ))}
              {data.documents.purchases.length === 0 && <EmptyRow cols={7} />}
            </tbody>
          </table>
        )}
        {tab === "debitNotes" && (
          <table className="admin-table min-w-[680px]">
            <thead>
              <tr>
                <th>Debit note</th>
                <th>Supplier</th>
                <th>Date</th>
                <th className="text-right">Net</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.debitNotes.map((d) => (
                <tr key={d.id}>
                  <td>
                    <p className="font-mono text-xs font-semibold">{d.number}</p>
                    {d.purchaseOrderId && (
                      <Link href={`/admin/purchases/${d.purchaseOrderId}`} className="text-xs text-indigo-600 hover:underline">
                        {d.purchaseOrderNumber}
                      </Link>
                    )}
                  </td>
                  <td>{d.supplierName}</td>
                  <td className="whitespace-nowrap">{fmtDate(d.date)}</td>
                  <td className="text-right tabular-nums">{money(d.net)}</td>
                  <td className="text-right tabular-nums">{money(d.tax)}</td>
                  <td className="text-right tabular-nums font-medium">{money(d.total)}</td>
                </tr>
              ))}
              {data.documents.debitNotes.length === 0 && <EmptyRow cols={6} />}
            </tbody>
          </table>
        )}
      </div>
      <p className="px-5 py-2 text-[11px] text-slate-400 border-t border-slate-100">Up to 200 most recent documents per list are shown; totals above cover the whole period.</p>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center text-slate-400 py-8">
        Nothing in this period.
      </td>
    </tr>
  );
}

/** Black-on-white bilingual A4 summary for filing / the accountant. */
function VatPrint({
  data,
  boxes,
  legalEn,
  legalAr,
  store,
}: {
  data: Report;
  boxes: Box[];
  legalEn: string;
  legalAr: string;
  store: { store_address?: string; store_phone?: string };
}) {
  const cell: React.CSSProperties = { border: "1px solid #000", padding: "6px 8px", fontSize: 12 };
  return (
    <div style={{ fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif", color: "#000", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, borderBottom: "2px solid #000", paddingBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{legalEn}</div>
          {store.store_address && <div style={{ fontSize: 11 }}>{store.store_address}</div>}
          {store.store_phone && <div style={{ fontSize: 11 }}>{store.store_phone}</div>}
          <div style={{ fontSize: 11, marginTop: 4 }}>VAT No.: {data.settings.vatNumber || "—"}</div>
          {data.settings.crNumber && <div style={{ fontSize: 11 }}>CR No.: {data.settings.crNumber}</div>}
        </div>
        <div dir="rtl" style={{ textAlign: "right" }}>
          {legalAr && <div style={{ fontSize: 18, fontWeight: 700 }}>{legalAr}</div>}
          <div style={{ fontSize: 11, marginTop: 4 }}>الرقم الضريبي: {data.settings.vatNumber || "—"}</div>
          {data.settings.crNumber && <div style={{ fontSize: 11 }}>السجل التجاري: {data.settings.crNumber}</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 0" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>VAT Return Summary</div>
          <div style={{ fontSize: 12 }}>
            Period: {data.range.from} → {data.range.to}
          </div>
        </div>
        <div dir="rtl" style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>ملخص الإقرار الضريبي</div>
          <div style={{ fontSize: 12 }}>
            الفترة: {data.range.from} ← {data.range.to}
          </div>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th style={{ ...cell, width: 40 }}>Box</th>
            <th style={{ ...cell, textAlign: "left" }}>Description</th>
            <th style={{ ...cell, textAlign: "right" }} dir="rtl">
              البيان
            </th>
            <th style={{ ...cell, textAlign: "right", width: 110 }}>
              Amount
              <br />
              المبلغ
            </th>
            <th style={{ ...cell, textAlign: "right", width: 100 }}>
              VAT
              <br />
              الضريبة
            </th>
          </tr>
        </thead>
        <tbody>
          {boxes.map((b) => (
            <tr key={b.no} style={b.strong ? { background: "#f3f3f3", fontWeight: 700 } : undefined}>
              <td style={{ ...cell, textAlign: "center" }}>{b.no}</td>
              <td style={cell}>{b.en}</td>
              <td style={{ ...cell, textAlign: "right" }} dir="rtl">
                {b.ar}
              </td>
              <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.base == null ? "" : money(b.base)}</td>
              <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.vat == null ? "" : money(b.vat)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th style={{ ...cell, textAlign: "left" }}>Sales by rate / المبيعات حسب النسبة</th>
            <th style={{ ...cell, textAlign: "right" }}>Invoices / الفواتير</th>
            <th style={{ ...cell, textAlign: "right" }}>Taxable / الخاضع</th>
            <th style={{ ...cell, textAlign: "right" }}>VAT / الضريبة</th>
          </tr>
        </thead>
        <tbody>
          {data.output.rows.map((r) => (
            <tr key={`${r.code}-${r.rate}-${r.type}`}>
              <td style={cell}>
                {r.nameEn} — <span dir="rtl">{r.nameAr}</span>
              </td>
              <td style={{ ...cell, textAlign: "right" }}>{r.orders}</td>
              <td style={{ ...cell, textAlign: "right" }}>{money(r.taxable)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{money(r.tax)}</td>
            </tr>
          ))}
          {data.output.rows.length === 0 && (
            <tr>
              <td style={{ ...cell, textAlign: "center" }} colSpan={4}>
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 18, borderTop: "1px solid #000", paddingTop: 6 }}>
        <span>Generated {new Date().toLocaleString("en-GB", { timeZone: "Asia/Muscat" })} · amounts in OMR</span>
        <span dir="rtl">جميع المبالغ بالريال العماني</span>
      </div>
    </div>
  );
}
