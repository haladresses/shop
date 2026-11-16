"use client";
import { useMemo, useState } from "react";
import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import { DataTable, StatusLine, int, useReport } from "./shared";

type Figs = {
  products: number;
  qty: number;
  returnedQty: number;
  netQty: number;
  gross: number;
  offers: number;
  discounts: number;
  vat: number;
  netSales: number;
  refunds: number;
  refundVat: number;
  netExVat: number;
  cost: number;
  profit: number;
  margin: number;
};
type Node = { id: string; nameEn: string; nameAr: string; parentId: string | null; depth: number; hasChildren: boolean; own: Figs; total: Figs; share: number };
type Data = { rows: Node[]; totals: Figs };

const active = (f: Figs) => f.qty > 0 || f.returnedQty > 0 || f.refunds !== 0;

/**
 * Category tree. Figures include sub-categories ("Net excl. VAT" = whole
 * branch); "Own net" is only products filed directly in that category.
 * Clicking a name opens its products.
 */
export default function CategoriesTab({ query, onOpenCategory }: { query: string; onOpenCategory: (id: string) => void }) {
  const { data, loading, error } = useReport<Data>("/api/reports/sales/by-category", query);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hideEmpty, setHideEmpty] = useState(true);

  const rows = useMemo(() => {
    if (!data) return [];
    const hidden = new Set<string>();
    const out: Node[] = [];
    for (const n of data.rows) {
      if (n.parentId && (hidden.has(n.parentId) || collapsed.has(n.parentId))) {
        hidden.add(n.id);
        continue;
      }
      if (hideEmpty && !active(n.total)) {
        hidden.add(n.id);
        continue;
      }
      out.push(n);
    }
    return out;
  }, [data, collapsed, hideEmpty]);

  if (!data) return <StatusLine loading={loading} error={error} />;
  const t = data.totals;
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const parents = data.rows.filter((r) => r.hasChildren).map((r) => r.id);

  return (
    <div className="space-y-3">
      <StatusLine loading={loading} error={error} />
      <DataTable
        id="by-category"
        title="Sales by category"
        titleAr="المبيعات حسب الفئة"
        subtitle="Each row includes its sub-categories; “Own net” is products filed directly in that category. Click a category to see its products."
        rows={rows}
        rowKey={(r) => r.id}
        serverSorted
        toolbar={
          <>
            <button type="button" onClick={() => setCollapsed(new Set())} className="admin-btn admin-btn-secondary !px-2.5 !py-1.5 text-xs">Expand all</button>
            <button type="button" onClick={() => setCollapsed(new Set(parents))} className="admin-btn admin-btn-secondary !px-2.5 !py-1.5 text-xs">Collapse all</button>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="rounded" /> Hide categories without sales
            </label>
          </>
        }
        columns={[
          {
            key: "name",
            label: "Category",
            labelAr: "الفئة",
            value: (r) => r.nameEn,
            printValue: (r) => `${"— ".repeat(r.depth)}${r.nameEn}`,
            render: (r) => (
              <div className="flex items-center gap-1 min-w-[180px]" style={{ paddingLeft: r.depth * 18 }}>
                {r.hasChildren ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(r.id);
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-700"
                    aria-label={collapsed.has(r.id) ? "Expand" : "Collapse"}
                  >
                    {collapsed.has(r.id) ? <LuChevronRight size={14} /> : <LuChevronDown size={14} />}
                  </button>
                ) : (
                  <span className="w-[18px]" />
                )}
                {r.id === "__none" ? (
                  <span className="text-slate-500">{r.nameEn}</span>
                ) : (
                  <button type="button" onClick={() => onOpenCategory(r.id)} className={`text-left text-indigo-700 hover:underline ${r.depth === 0 ? "font-semibold" : ""}`}>
                    {r.nameEn}
                  </button>
                )}
                {r.nameAr && <span className="ml-1 text-xs text-slate-400" dir="rtl">{r.nameAr}</span>}
              </div>
            ),
          },
          { key: "products", label: "Products", kind: "int", value: (r) => r.total.products, total: t.products },
          { key: "qty", label: "Sold", labelAr: "المباع", kind: "int", value: (r) => r.total.qty, total: t.qty },
          { key: "returnedQty", label: "Returned", kind: "int", value: (r) => r.total.returnedQty, total: t.returnedQty },
          { key: "netQty", label: "Net qty", kind: "int", value: (r) => r.total.netQty, total: t.netQty, className: "font-medium" },
          { key: "gross", label: "Shelf value", kind: "money", value: (r) => r.total.gross, total: t.gross, muted: true },
          { key: "offers", label: "Offers", kind: "money", value: (r) => r.total.offers, total: t.offers },
          { key: "discounts", label: "Discounts", kind: "money", value: (r) => r.total.discounts, total: t.discounts },
          { key: "vat", label: "VAT", kind: "money", value: (r) => r.total.vat, total: t.vat },
          { key: "refunds", label: "Refunds", kind: "money", value: (r) => r.total.refunds, total: t.refunds },
          { key: "netExVat", label: "Net excl. VAT", labelAr: "الصافي", kind: "money", value: (r) => r.total.netExVat, total: t.netExVat, className: "font-semibold" },
          { key: "own", label: "Own net", kind: "money", value: (r) => (r.hasChildren ? r.own.netExVat : null), muted: true },
          { key: "cost", label: "Cost", kind: "money", value: (r) => r.total.cost, total: t.cost },
          { key: "profit", label: "Gross profit", kind: "money", value: (r) => r.total.profit, total: t.profit, className: "font-medium" },
          { key: "margin", label: "Margin", kind: "pct", value: (r) => r.total.margin, total: t.margin },
          { key: "share", label: "Share", kind: "pct", value: (r) => (r.depth === 0 ? r.share : null), total: t.netExVat > 0 ? 100 : 0 },
        ]}
        emptyText={`No category sales in this period${hideEmpty ? "" : ""}.`}
        note={<>Share is shown for top-level categories (they add up to 100%). {int(t.products)} products sold or returned.</>}
      />
    </div>
  );
}
