"use client";
import { useMemo, useState } from "react";
import { LuArrowDown, LuArrowUp, LuArrowUpDown, LuDownload, LuPrinter } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import { downloadCsv, int, money, pct } from "./format";
import { PrintFrame, PrintTable } from "./PrintFrame";
import { useReport } from "./ReportContext";

export type Column<T> = {
  key: string;
  label: string;
  /** Arabic heading (shown on print). */
  ar?: string;
  kind?: "money" | "int" | "pct" | "text";
  align?: "left" | "right" | "center";
  /** Raw value — used to sort, export, print and (by default) display. */
  value: (r: T) => string | number | null | undefined;
  /** Custom on-screen cell. */
  render?: (r: T) => React.ReactNode;
  /** Footer (totals row) value. */
  total?: string | number | null;
  sortable?: boolean;
  className?: string;
  /** Leave out of the printed table (still exported). */
  printHide?: boolean;
};

type Kind = Column<unknown>["kind"];

export function fmtValue(kind: Kind, v: string | number | null | undefined): string {
  if (v == null || v === "") return kind === "text" || !kind ? "" : "-";
  if (typeof v === "string") return v;
  if (kind === "money") return money(v);
  if (kind === "int") return int(v);
  if (kind === "pct") return pct(v);
  return String(v);
}
const csvValue = (kind: Kind, v: string | number | null | undefined) =>
  v == null ? "" : typeof v === "number" ? (kind === "money" ? v.toFixed(3) : kind === "pct" ? v.toFixed(2) : String(v)) : v;
const alignOf = <T,>(c: Column<T>) => c.align ?? (c.kind && c.kind !== "text" ? "right" : "left");
const alignClass = (a: "left" | "right" | "center") => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

export default function ReportTable<T>({
  id,
  title,
  titleAr,
  columns,
  rows,
  rowKey,
  loading,
  empty = "No sales in this period.",
  onRowClick,
  rowClassName,
  toolbar,
  totalsLabel = "Total",
  showTotals = true,
  note,
  landscape,
  sortable = true,
  maxHeight = "70vh",
  printSubtitle,
}: {
  id: string;
  title: string;
  titleAr: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  loading?: boolean;
  empty?: string;
  onRowClick?: (r: T) => void;
  rowClassName?: (r: T) => string;
  toolbar?: React.ReactNode;
  totalsLabel?: string;
  showTotals?: boolean;
  note?: React.ReactNode;
  landscape?: boolean;
  sortable?: boolean;
  maxHeight?: string;
  printSubtitle?: string;
}) {
  const { fileSuffix } = useReport();
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
    });
  }, [rows, sort, columns]);

  const hasTotals = showTotals && rows.length > 0 && columns.some((c) => c.total !== undefined);
  const footCell = (c: Column<T>, i: number) => (i === 0 && c.total === undefined ? totalsLabel : c.total === undefined ? "" : fmtValue(c.kind, c.total));

  const exportCsv = () => {
    const header = columns.map((c) => c.label);
    const body = sorted.map((r) => columns.map((c) => csvValue(c.kind, c.value(r))));
    if (hasTotals) body.push(columns.map((c, i) => (i === 0 && c.total === undefined ? totalsLabel : csvValue(c.kind, c.total ?? ""))));
    downloadCsv(`${id}_${fileSuffix}`, header, body);
  };

  const printCols = columns.filter((c) => !c.printHide);
  const print = () => printArea(`report-${id}`, { page: landscape ? "a4-landscape" : "a4", title: `${title} ${fileSuffix}` });

  const toggleSort = (c: Column<T>) => {
    if (!sortable || c.sortable === false) return;
    setSort((s) =>
      !s || s.key !== c.key ? { key: c.key, dir: c.kind && c.kind !== "text" ? "desc" : "asc" } : s.dir === "desc" ? { key: c.key, dir: "asc" } : null,
    );
  };

  return (
    <div className="admin-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400">{loading ? "Loading…" : `${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <button onClick={exportCsv} disabled={loading || rows.length === 0} className="admin-btn admin-btn-secondary !py-1.5 text-xs disabled:opacity-40">
            <LuDownload size={14} /> CSV
          </button>
          <button onClick={print} disabled={loading || rows.length === 0} className="admin-btn admin-btn-secondary !py-1.5 text-xs disabled:opacity-40">
            <LuPrinter size={14} /> Print
          </button>
        </div>
      </div>
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="admin-table tabular-nums text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const canSort = sortable && c.sortable !== false;
                return (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c)}
                    className={`whitespace-nowrap !px-3 ${alignClass(alignOf(c))} ${canSort ? "cursor-pointer select-none hover:text-slate-700" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {canSort &&
                        (active ? (
                          sort!.dir === "asc" ? <LuArrowUp size={11} /> : <LuArrowDown size={11} />
                        ) : (
                          <LuArrowUpDown size={11} className="opacity-30" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center !py-10 text-slate-400">Loading…</td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center !py-10 text-slate-400">{empty}</td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={`${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(r) ?? ""}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={`!px-3 !py-2 whitespace-nowrap ${alignClass(alignOf(c))} ${c.className ?? ""}`}>
                      {c.render ? c.render(r) : fmtValue(c.kind, c.value(r))}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {hasTotals && (
            <tfoot className="sticky bottom-0">
              <tr>
                {columns.map((c, i) => (
                  <td key={c.key} className={`!px-3 !py-2 whitespace-nowrap font-bold bg-slate-100 border-t-2 border-slate-300 ${alignClass(alignOf(c))}`}>
                    {footCell(c, i)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {note && <div className="px-4 py-2.5 text-xs text-slate-500 border-t border-slate-100">{note}</div>}

      <PrintArea id={`report-${id}`}>
        <PrintFrame title={title} titleAr={titleAr} subtitle={printSubtitle}>
          <PrintTable
            head={printCols.map((c) => ({ en: c.label, ar: c.ar }))}
            align={printCols.map((c) => (alignOf(c) === "right" ? "r" : alignOf(c) === "center" ? "c" : "l"))}
            rows={sorted.map((r) => printCols.map((c) => fmtValue(c.kind, c.value(r))))}
            foot={hasTotals ? printCols.map((c, i) => footCell(c, i)) : undefined}
          />
        </PrintFrame>
      </PrintArea>
    </div>
  );
}

/** Small metric box (plain — no graphics). */
export function Figure({ label, ar, value, sub, strong }: { label: string; ar?: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 flex justify-between gap-2">
        <span className="truncate">{label}</span>
        {ar && <span dir="rtl" className="normal-case tracking-normal truncate">{ar}</span>}
      </p>
      <p className={`tabular-nums truncate ${strong ? "text-xl font-bold text-slate-900" : "text-lg font-semibold text-slate-800"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
    </div>
  );
}
