"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LuArrowDown, LuArrowUp, LuDownload, LuPrinter } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import { methodLabels, type StoreInfo } from "@/lib/invoice";
import { DEFAULT_TAX_SETTINGS, type TaxSettings } from "@/lib/taxCalc";

// Building blocks for the Sales Report: number formatting, the report
// context (store / filters shown on printouts), data fetching and one
// accountant-style table used by every section — sticky header, sortable
// columns, bold totals row, CSV export and A4 print. Tables only: no charts,
// no animation.

export const SHOP_TZ = "Asia/Muscat";

// ───────────────────────── formatting ─────────────────────────

export const f3 = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const int = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");
export const pct = (n: number | null | undefined) => `${(n ?? 0).toFixed(1)}%`;

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { timeZone: SHOP_TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: SHOP_TZ, hour: "2-digit", minute: "2-digit" }) : "-";
/** "2026-11-16" → "Mon 16 Nov 2026" */
export const fmtDay = (key: string) => {
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", year: "numeric" });
};
export const methodName = (m: string) => methodLabels(m).en;
export const methodNameAr = (m: string) => methodLabels(m).ar;
export const channelName = (c: string) => (c === "POS" ? "In store (POS)" : c === "ONLINE" ? "Online" : c);

// ───────────────────────── context ─────────────────────────

export type ReportCtx = {
  store: StoreInfo;
  tax: TaxSettings;
  /** e.g. "16 Nov 2026" or "1 Nov 2026 – 16 Nov 2026" */
  rangeLabel: string;
  /** Active filters in words, for printouts and CSV names. */
  filterLabel: string;
  fileStem: string;
};

const Ctx = createContext<ReportCtx>({ store: {}, tax: DEFAULT_TAX_SETTINGS, rangeLabel: "", filterLabel: "", fileStem: "sales" });
export const ReportContext = Ctx.Provider;
export const useReportCtx = () => useContext(Ctx);

// ───────────────────────── data ─────────────────────────

/** GET a report endpoint; refetches whenever `query` changes. */
export function useReport<T>(path: string, query: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${path}?${query}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
        else {
          setData(null);
          setError(d.error || "Could not load this report.");
        }
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError("Could not load this report.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [path, query, enabled, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

export function StatusLine({ loading, error }: { loading: boolean; error: string }) {
  if (error) return <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>;
  if (loading) return <p className="text-sm text-slate-500 px-1">Loading…</p>;
  return null;
}

// ───────────────────────── CSV ─────────────────────────

export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  // BOM so Excel opens Arabic text correctly.
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ───────────────────────── printing ─────────────────────────

/** Header block for every printed report: store, title (EN + AR), period, filters. */
export function PrintHeader({ title, titleAr, extra }: { title: string; titleAr?: string; extra?: string }) {
  const { store, tax, rangeLabel, filterLabel } = useReportCtx();
  return (
    <div style={{ borderBottom: "2px solid #000", paddingBottom: 6, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{tax.legalNameEn || store.store_name_en || "Hala Dresses"}</div>
          {store.store_address && <div style={{ fontSize: 9 }}>{store.store_address}</div>}
          {tax.enabled && tax.vatNumber && <div style={{ fontSize: 9 }}>VATIN: {tax.vatNumber}</div>}
        </div>
        <div dir="rtl" style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{tax.legalNameAr || store.store_name_ar || ""}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {titleAr && (
          <div dir="rtl" style={{ fontSize: 14, fontWeight: 700 }}>
            {titleAr}
          </div>
        )}
      </div>
      <div style={{ fontSize: 9.5, marginTop: 2 }}>
        Period / الفترة: {rangeLabel}
        {filterLabel ? ` · ${filterLabel}` : ""}
        {extra ? ` · ${extra}` : ""} · Printed {fmtDateTime(new Date().toISOString())}
      </div>
    </div>
  );
}

/** Plain black-on-white table styles for printouts. */
export const printTable: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 9, fontVariantNumeric: "tabular-nums" };
export const printTh = (align: "left" | "right" | "center" = "left"): React.CSSProperties => ({
  border: "1px solid #000",
  padding: "2px 4px",
  textAlign: align,
  background: "#e5e5e5",
  fontWeight: 700,
  verticalAlign: "bottom",
});
export const printTd = (align: "left" | "right" | "center" = "left", bold = false): React.CSSProperties => ({
  border: "1px solid #000",
  padding: "2px 4px",
  textAlign: align,
  fontWeight: bold ? 700 : 400,
  verticalAlign: "top",
});

// ───────────────────────── table ─────────────────────────

export type ColumnKind = "money" | "int" | "pct" | "text";

export type Column<T> = {
  key: string;
  label: string;
  labelAr?: string;
  kind?: ColumnKind;
  /** Raw value — used for sorting, CSV and the default cell. */
  value: (row: T) => number | string | null | undefined;
  /** Custom on-screen cell (CSV/print still use `value`, or `printValue`). */
  render?: (row: T) => React.ReactNode;
  printValue?: (row: T) => string;
  /** Totals-row value (raw number/text). Omit to leave the cell empty. */
  total?: number | string | null;
  sortable?: boolean;
  /** Keep on screen but leave out of print (e.g. action columns). */
  noPrint?: boolean;
  noCsv?: boolean;
  className?: string;
  /** Muted helper column (lighter text). */
  muted?: boolean;
};

const alignOf = (c: Column<unknown>) => (c.kind && c.kind !== "text" ? "right" : "left");

export function formatValue(kind: ColumnKind | undefined, v: number | string | null | undefined): string {
  if (v == null || v === "") return "-";
  if (typeof v === "string") return v;
  if (kind === "money") return f3(v);
  if (kind === "int") return int(v);
  if (kind === "pct") return pct(v);
  return String(v);
}

function Cell<T>({ col, row }: { col: Column<T>; row: T }) {
  if (col.render) return <>{col.render(row)}</>;
  const v = col.value(row);
  if (col.kind === "money" && typeof v === "number") {
    return <span className={v === 0 ? "text-slate-300" : v < 0 ? "text-rose-600" : ""}>{f3(v)}</span>;
  }
  if (col.kind === "int" && v === 0) return <span className="text-slate-300">0</span>;
  return <>{formatValue(col.kind, v)}</>;
}

export function DataTable<T>({
  id,
  title,
  titleAr,
  subtitle,
  columns,
  rows,
  rowKey,
  totalsLabel = "Total",
  showTotals,
  onRowClick,
  rowClassName,
  defaultSort,
  toolbar,
  footer,
  note,
  emptyText = "No sales in this period.",
  maxHeight = "70vh",
  serverSorted = false,
  onExportCsv,
  printLandscape,
  printExtra,
  compact = false,
}: {
  id: string;
  title: string;
  titleAr?: string;
  subtitle?: React.ReactNode;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  totalsLabel?: string;
  /** Defaults to "any column has a total". */
  showTotals?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  note?: React.ReactNode;
  emptyText?: string;
  maxHeight?: string;
  /** Rows come pre-sorted/paged from the server — no client sorting. */
  serverSorted?: boolean;
  /** Replace the default CSV (e.g. to export every page, not just this one). */
  onExportCsv?: () => void;
  printLandscape?: boolean;
  printExtra?: string;
  compact?: boolean;
}) {
  const { fileStem } = useReportCtx();
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);
  const sorted = useMemo(() => {
    if (serverSorted || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "en", { numeric: true }) * dir;
    });
  }, [rows, sort, columns, serverSorted]);

  const hasTotals = showTotals ?? columns.some((c) => c.total !== undefined);
  const visible = columns;
  const printCols = columns.filter((c) => !c.noPrint);
  const landscape = printLandscape ?? printCols.length > 9;
  const printId = `report-${id}`;

  const toggleSort = (c: Column<T>) => {
    if (serverSorted || c.sortable === false) return;
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "desc" ? "asc" : "desc" } : { key: c.key, dir: c.kind && c.kind !== "text" ? "desc" : "asc" }));
  };

  const exportCsv = () => {
    if (onExportCsv) return onExportCsv();
    const cols = columns.filter((c) => !c.noCsv);
    const body = sorted.map((r) =>
      cols.map((c) => {
        const v = c.value(r);
        return typeof v === "number" ? (c.kind === "money" ? v.toFixed(3) : String(v)) : v ?? "";
      }),
    );
    if (hasTotals) {
      body.push(cols.map((c, i) => (i === 0 && c.total === undefined ? totalsLabel : typeof c.total === "number" ? (c.kind === "money" ? c.total.toFixed(3) : String(c.total)) : c.total ?? "")));
    }
    downloadCsv(`${fileStem}-${id}`, cols.map((c) => c.label), body);
  };

  const pad = compact ? "!px-2.5 !py-1.5" : "!px-3 !py-2";

  return (
    <div className="admin-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 text-sm">
            {title}
            {titleAr && <span className="ml-2 font-normal text-slate-400" dir="rtl">{titleAr}</span>}
          </h3>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <button type="button" onClick={exportCsv} disabled={rows.length === 0} className="admin-btn admin-btn-secondary !px-2.5 !py-1.5 text-xs disabled:opacity-40" title="Download as CSV (opens in Excel)">
            <LuDownload size={13} /> CSV
          </button>
          <button
            type="button"
            onClick={() => printArea(printId, { page: landscape ? "a4-landscape" : "a4", title: `${title} ${fileStem}` })}
            disabled={rows.length === 0}
            className="admin-btn admin-btn-secondary !px-2.5 !py-1.5 text-xs disabled:opacity-40"
            title="Print on A4"
          >
            <LuPrinter size={13} /> Print
          </button>
        </div>
      </div>
      {note && <div className="px-4 py-2 text-xs text-slate-600 bg-slate-50 border-b border-slate-200">{note}</div>}
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="admin-table tabular-nums">
            <thead className="sticky top-0 z-10">
              <tr>
                {visible.map((c) => {
                  const active = sort?.key === c.key;
                  const canSort = !serverSorted && c.sortable !== false;
                  return (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c)}
                      className={`${pad} whitespace-nowrap ${alignOf(c as Column<unknown>) === "right" ? "text-right" : "text-left"} ${canSort ? "cursor-pointer select-none hover:text-slate-800" : ""}`}
                      title={c.labelAr}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {active && (sort!.dir === "desc" ? <LuArrowDown size={11} /> : <LuArrowUp size={11} />)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={rowKey(r, i)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(r) ?? ""}`}
                >
                  {visible.map((c) => (
                    <td
                      key={c.key}
                      className={`${pad} ${alignOf(c as Column<unknown>) === "right" ? "text-right whitespace-nowrap" : ""} ${c.muted ? "text-slate-500" : ""} ${c.className ?? ""}`}
                    >
                      <Cell col={c} row={r} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasTotals && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-slate-100">
                  {visible.map((c, i) => (
                    <td
                      key={c.key}
                      className={`${pad} font-bold text-slate-900 border-t-2 border-slate-300 bg-slate-100 ${alignOf(c as Column<unknown>) === "right" ? "text-right whitespace-nowrap" : ""}`}
                    >
                      {i === 0 && c.total === undefined ? totalsLabel : c.total === undefined ? "" : formatValue(c.kind, c.total)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {footer}

      <PrintArea id={printId}>
        <div style={{ fontFamily: 'Vazirmatn, SBC, Tahoma, "Segoe UI", Arial, sans-serif', color: "#000" }}>
          <PrintHeader title={title} titleAr={titleAr} extra={printExtra} />
          <table style={printTable}>
            <thead>
              <tr>
                {printCols.map((c) => (
                  <th key={c.key} style={printTh(alignOf(c as Column<unknown>))}>
                    {c.label}
                    {c.labelAr && <div dir="rtl" style={{ fontWeight: 400 }}>{c.labelAr}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={rowKey(r, i)} className="print-avoid-break">
                  {printCols.map((c) => (
                    <td key={c.key} style={printTd(alignOf(c as Column<unknown>))}>
                      {c.printValue ? c.printValue(r) : formatValue(c.kind, c.value(r))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasTotals && (
              <tfoot>
                <tr>
                  {printCols.map((c, i) => (
                    <td key={c.key} style={printTd(alignOf(c as Column<unknown>), true)}>
                      {i === 0 && c.total === undefined ? `${totalsLabel} / الإجمالي` : c.total === undefined ? "" : formatValue(c.kind, c.total)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </PrintArea>
    </div>
  );
}

/** Two-column "label · value" table for headline figures (no cards, no charts). */
export function FigureTable({ rows, title, titleAr }: { title?: string; titleAr?: string; rows: { label: string; labelAr?: string; value: string; strong?: boolean; muted?: boolean }[] }) {
  return (
    <div className="admin-card">
      {title && (
        <div className="px-4 py-2.5 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm">
            {title}
            {titleAr && <span className="ml-2 font-normal text-slate-400" dir="rtl">{titleAr}</span>}
          </h3>
        </div>
      )}
      <table className="w-full text-sm tabular-nums">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-100 last:border-0 ${r.strong ? "bg-slate-50" : ""}`}>
              <td className={`px-4 py-1.5 ${r.strong ? "font-bold text-slate-900" : r.muted ? "text-slate-500" : "text-slate-700"}`}>
                {r.label}
                {r.labelAr && <span className="ml-2 text-xs text-slate-400" dir="rtl">{r.labelAr}</span>}
              </td>
              <td className={`px-4 py-1.5 text-right whitespace-nowrap ${r.strong ? "font-bold text-slate-900" : r.muted ? "text-slate-500" : "text-slate-800"}`}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small pager for server-paged tables. */
export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-200 text-sm">
      <span className="text-slate-500 mr-auto">{int(total)} receipts</span>
      <button disabled={page <= 1} onClick={() => onPage(1)} className="admin-btn admin-btn-secondary !px-2.5 !py-1 text-xs disabled:opacity-40">First</button>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="admin-btn admin-btn-secondary !px-2.5 !py-1 text-xs disabled:opacity-40">Prev</button>
      <span className="text-slate-600">
        Page {page} of {totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="admin-btn admin-btn-secondary !px-2.5 !py-1 text-xs disabled:opacity-40">Next</button>
      <button disabled={page >= totalPages} onClick={() => onPage(totalPages)} className="admin-btn admin-btn-secondary !px-2.5 !py-1 text-xs disabled:opacity-40">Last</button>
    </div>
  );
}

/** Shared "figures" shape returned by the summary / by-day / by-salesperson endpoints. */
export type Figures = {
  orders: number;
  items: number;
  subtotal: number;
  offers: number;
  discounts: number;
  shipping: number;
  vat: number;
  gross: number;
  refundCount: number;
  refunds: number;
  refundVat: number;
  net: number;
  netExVat: number;
  avgTicket: number;
};
