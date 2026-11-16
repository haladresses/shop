"use client";
import { useMemo, useState } from "react";
import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import { int, money } from "./format";
import type { LineFigures } from "./ProductTab";
import ReportTable, { Figure, type Column } from "./ReportTable";
import { useReportData } from "./useReportData";

type Fig = LineFigures & { products: number; share: number };
type Row = { id: string; nameEn: string; nameAr: string; parentId: string | null; depth: number; hasChildren: boolean; own: Fig; total: Fig };
type Data = { rows: Row[]; totals: Fig };
type View = Row & { kind: "category" | "own"; fig: Fig };

const active = (f: Fig) => f.qtySold > 0 || f.qtyReturned > 0 || f.refunds > 0;

export default function CategoryTab({ query, onCategory }: { query: string; onCategory: (id: string, name: string) => void }) {
  const { data, loading, error } = useReportData<Data>(`/api/reports/sales/by-category?${query}`);
  const [mode, setMode] = useState<"total" | "own">("total");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const t = data?.totals;

  // Expand the top level by default.
  const open = useMemo(() => expanded ?? new Set((data?.rows ?? []).filter((r) => r.depth === 0).map((r) => r.id)), [expanded, data]);
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const view = useMemo(() => {
    const rows = data?.rows ?? [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const visible = (r: Row) => {
      let p = r.parentId;
      while (p) {
        if (!open.has(p)) return false;
        p = byId.get(p)?.parentId ?? null;
      }
      return true;
    };
    const out: View[] = [];
    for (const r of rows) {
      if (mode === "own") {
        if (hideEmpty && !active(r.own)) continue;
        out.push({ ...r, kind: "category", fig: r.own });
        continue;
      }
      if (hideEmpty && !active(r.total)) continue;
      if (!visible(r)) continue;
      out.push({ ...r, kind: "category", fig: r.total });
      // Expanded parent: also show what's sold directly in it, so own vs. sub-category figures are both visible.
      if (r.hasChildren && open.has(r.id) && active(r.own)) out.push({ ...r, kind: "own", fig: r.own, depth: r.depth + 1 });
    }
    return out;
  }, [data, mode, hideEmpty, open]);

  const name = (r: View) => (r.kind === "own" ? `Products directly in ${r.nameEn}` : r.nameEn);
  const cols: Column<View>[] = [
    {
      key: "name",
      label: "Category",
      ar: "الفئة",
      kind: "text",
      value: (r) => `${"· ".repeat(mode === "total" ? r.depth : 0)}${name(r)}`,
      render: (r) => (
        <span className="inline-flex items-center gap-1" style={{ paddingLeft: mode === "total" ? r.depth * 18 : 0 }}>
          {mode === "total" && r.kind === "category" && r.hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle(r.id);
              }}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-500"
              aria-label={open.has(r.id) ? "Collapse" : "Expand"}
            >
              {open.has(r.id) ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-[18px]" />
          )}
          <span className={r.kind === "own" ? "italic text-slate-500" : r.depth === 0 ? "font-semibold text-slate-800" : "text-slate-700"}>{name(r)}</span>
          {r.kind === "category" && <span dir="rtl" className="text-xs text-slate-400 ml-1">{r.nameAr}</span>}
        </span>
      ),
    },
    { key: "products", label: "Products sold", ar: "المنتجات", kind: "int", value: (r) => r.fig.products, total: t?.products },
    { key: "qtySold", label: "Qty sold", ar: "الكمية", kind: "int", value: (r) => r.fig.qtySold, total: t?.qtySold },
    { key: "qtyReturned", label: "Returned", ar: "المرتجع", kind: "int", value: (r) => r.fig.qtyReturned, total: t?.qtyReturned },
    { key: "netQty", label: "Net qty", ar: "صافي الكمية", kind: "int", value: (r) => r.fig.netQty, total: t?.netQty },
    { key: "gross", label: "Gross sales", ar: "إجمالي المبيعات", kind: "money", value: (r) => r.fig.gross, total: t?.gross },
    { key: "disc", label: "Offers + discounts", ar: "العروض والخصومات", kind: "money", value: (r) => r.fig.offers + r.fig.discounts, total: t ? t.offers + t.discounts : undefined },
    { key: "vat", label: "VAT", ar: "الضريبة", kind: "money", value: (r) => r.fig.vat, total: t?.vat },
    { key: "netExVat", label: "Net excl. VAT", ar: "الصافي قبل الضريبة", kind: "money", value: (r) => r.fig.netExVat, total: t?.netExVat, className: "font-semibold" },
    { key: "refunds", label: "Refunds", ar: "المرتجعات", kind: "money", value: (r) => r.fig.refunds, total: t?.refunds },
    { key: "cost", label: "Cost", ar: "التكلفة", kind: "money", value: (r) => r.fig.cost, total: t?.cost },
    { key: "profit", label: "Gross profit", ar: "إجمالي الربح", kind: "money", value: (r) => r.fig.profit, total: t?.profit, render: (r) => <span className={r.fig.profit < 0 ? "text-rose-600" : ""}>{money(r.fig.profit)}</span> },
    { key: "margin", label: "Margin", ar: "الهامش", kind: "pct", value: (r) => r.fig.margin, total: t?.margin },
    { key: "share", label: "Share", ar: "الحصة", kind: "pct", value: (r) => r.fig.share, total: t ? 100 : undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="admin-card px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setMode("total")} className={`px-3 py-1.5 ${mode === "total" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            Including sub-categories (tree)
          </button>
          <button onClick={() => setMode("own")} className={`px-3 py-1.5 ${mode === "own" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            Each category on its own
          </button>
        </div>
        {mode === "total" && (
          <div className="flex gap-2 text-xs">
            <button onClick={() => setExpanded(new Set((data?.rows ?? []).filter((r) => r.hasChildren).map((r) => r.id)))} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Expand all</button>
            <button onClick={() => setExpanded(new Set())} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Collapse all</button>
          </div>
        )}
        <label className="flex items-center gap-1.5 text-sm text-slate-600 ml-auto">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="rounded" /> Hide categories without sales
        </label>
      </div>
      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Figure label="Categories with sales" value={int((data?.rows ?? []).filter((r) => active(r.own)).length)} />
        <Figure label="Units sold" ar="القطع المباعة" value={t ? int(t.qtySold) : "—"} sub={t ? `${int(t.qtyReturned)} returned` : ""} />
        <Figure label="Net excl. VAT" ar="الصافي قبل الضريبة" value={t ? money(t.netExVat) : "—"} />
        <Figure label="Gross profit" ar="إجمالي الربح" value={t ? money(t.profit) : "—"} sub={t ? `Margin ${t.margin.toFixed(1)}%` : ""} strong />
      </div>
      <ReportTable
        id={mode === "total" ? "sales-by-category" : "sales-by-category-own"}
        title={mode === "total" ? "Sales by category (incl. sub-categories)" : "Sales by category (own products only)"}
        titleAr="المبيعات حسب الفئة"
        columns={cols}
        rows={view}
        rowKey={(r) => `${r.kind}-${r.id}`}
        loading={loading}
        landscape
        sortable={mode === "own"}
        empty="No category sales in this period."
        onRowClick={(r) => onCategory(r.id, r.nameEn)}
        note={
          mode === "total"
            ? "A parent category's figures include all of its sub-categories; the italic row under an open parent shows products placed directly in it. Totals count every sale once. Click a category to see its products."
            : "Each category shows only the products placed directly in it. Click a category to see its products (including sub-categories)."
        }
      />
    </div>
  );
}
