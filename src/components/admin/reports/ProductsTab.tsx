"use client";
import { useEffect, useMemo, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";
import type { Meta } from "./Filters";
import { DataTable, StatusLine, int, useReport } from "./shared";

type Row = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  sku: string | null;
  variantLabel: string;
  categoryId: string | null;
  categoryName: string;
  orders: number;
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
  share: number;
  avgPrice: number;
  stock: number | null;
  hasCost: boolean;
};
type Data = { perVariant: boolean; category: { id: string; name: string | null } | null; rows: Row[] };

/** Indented category options for a <select>. */
export function categoryOptions(cats: Meta["categories"]) {
  const children = new Map<string, Meta["categories"]>();
  for (const c of cats) {
    const k = c.parentId ?? "__root";
    children.set(k, [...(children.get(k) ?? []), c]);
  }
  const out: { id: string; label: string }[] = [];
  const walk = (k: string, depth: number) => {
    for (const c of children.get(k) ?? []) {
      out.push({ id: c.id, label: `${"   ".repeat(depth)}${depth ? "└ " : ""}${c.nameEn}` });
      if (depth < 20) walk(c.id, depth + 1);
    }
  };
  walk("__root", 0);
  return out;
}

const sumOf = (rows: Row[], k: keyof Row) => rows.reduce((t, r) => t + Number(r[k] || 0), 0);

/** Sales per product (or per colour/size), sortable, with top-N and category filter. */
export default function ProductsTab({
  query,
  meta,
  categoryId,
  variants,
  search,
  top,
  onChange,
}: {
  query: string;
  meta: Meta | null;
  categoryId: string;
  variants: boolean;
  search: string;
  top: string;
  onChange: (patch: { cat?: string; variants?: string; q?: string; top?: string }) => void;
}) {
  const [term, setTerm] = useState(search);
  useEffect(() => setTerm(search), [search]);
  useEffect(() => {
    if (term === search) return;
    const t = setTimeout(() => onChange({ q: term }), 350);
    return () => clearTimeout(t);
  }, [term, search, onChange]);

  const params = new URLSearchParams(query);
  if (variants) params.set("variants", "1");
  if (categoryId) params.set("categoryId", categoryId);
  if (search) params.set("search", search);
  const { data, loading, error } = useReport<Data>("/api/reports/sales/by-product", params.toString());
  const cats = useMemo(() => categoryOptions(meta?.categories ?? []), [meta]);

  if (!data) return <StatusLine loading={loading} error={error} />;
  const limit = parseInt(top) || 0;
  const rows = limit > 0 ? data.rows.slice(0, limit) : data.rows;
  const netExVat = sumOf(rows, "netExVat");
  const profit = sumOf(rows, "profit");
  const missingCost = rows.filter((r) => !r.hasCost).length;

  return (
    <div className="space-y-3">
      <StatusLine loading={loading} error={error} />
      <DataTable
        id={variants ? "by-product-option" : "by-product"}
        title={variants ? "Sales by product option (colour / size)" : "Sales by product"}
        titleAr={variants ? "المبيعات حسب الخيار" : "المبيعات حسب المنتج"}
        subtitle={
          <>
            {limit > 0 && data.rows.length > limit ? `Top ${limit} of ${int(data.rows.length)} by net sales` : `${int(data.rows.length)} ${variants ? "options" : "products"} sold or returned`}
            {data.category && <> · category: {data.category.name} (incl. sub-categories)</>}
            {" · "}net excl. VAT after returns; cost at time of sale
          </>
        }
        rows={rows}
        rowKey={(r) => r.key}
        defaultSort={{ key: "netExVat", dir: "desc" }}
        printExtra={data.category ? `Category: ${data.category.name}` : undefined}
        note={missingCost > 0 ? <>* {missingCost} item{missingCost === 1 ? " has" : "s have"} sales without a purchase price — cost and profit are understated for them.</> : undefined}
        toolbar={
          <>
            <div className="relative">
              <LuSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name or SKU" className="admin-input !py-1.5 !pl-7 text-xs !w-40" />
            </div>
            <select value={categoryId} onChange={(e) => onChange({ cat: e.target.value })} className="admin-input admin-select !py-1.5 text-xs !w-auto max-w-[200px]">
              <option value="">All categories</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {categoryId && (
              <button type="button" onClick={() => onChange({ cat: "" })} className="admin-btn admin-btn-secondary !px-2 !py-1.5 text-xs" title="Clear category">
                <LuX size={13} />
              </button>
            )}
            <select value={top} onChange={(e) => onChange({ top: e.target.value })} className="admin-input admin-select !py-1.5 text-xs !w-auto">
              <option value="">All rows</option>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={variants} onChange={(e) => onChange({ variants: e.target.checked ? "1" : "" })} className="rounded" /> Per colour / size
            </label>
          </>
        }
        columns={[
          { key: "sku", label: "SKU", value: (r) => r.sku, className: "font-mono text-xs whitespace-nowrap", muted: true },
          {
            key: "name",
            label: "Product",
            labelAr: "المنتج",
            value: (r) => r.nameEn,
            render: (r) => (
              <div className="min-w-[160px]">
                <div className="font-medium text-slate-800">{r.nameEn}</div>
                {r.nameAr && <div className="text-xs text-slate-400" dir="rtl">{r.nameAr}</div>}
              </div>
            ),
            printValue: (r) => `${r.nameEn}${r.nameAr ? ` / ${r.nameAr}` : ""}`,
          },
          ...(variants ? [{ key: "option", label: "Option", labelAr: "الخيار", value: (r: Row) => r.variantLabel }] : []),
          { key: "category", label: "Category", labelAr: "الفئة", value: (r) => r.categoryName, muted: true },
          { key: "orders", label: "Sales", kind: "int", value: (r) => r.orders },
          { key: "qty", label: "Sold", labelAr: "المباع", kind: "int", value: (r) => r.qty, total: sumOf(rows, "qty") },
          { key: "returnedQty", label: "Returned", labelAr: "المرتجع", kind: "int", value: (r) => r.returnedQty, total: sumOf(rows, "returnedQty") },
          { key: "netQty", label: "Net qty", kind: "int", value: (r) => r.netQty, total: sumOf(rows, "netQty"), className: "font-medium" },
          { key: "gross", label: "Shelf value", labelAr: "سعر الرف", kind: "money", value: (r) => r.gross, total: sumOf(rows, "gross"), muted: true },
          { key: "offers", label: "Offers", kind: "money", value: (r) => r.offers, total: sumOf(rows, "offers") },
          { key: "discounts", label: "Discounts", kind: "money", value: (r) => r.discounts, total: sumOf(rows, "discounts") },
          { key: "vat", label: "VAT", kind: "money", value: (r) => r.vat, total: sumOf(rows, "vat") },
          { key: "netSales", label: "Sales excl. VAT", kind: "money", value: (r) => r.netSales, total: sumOf(rows, "netSales") },
          { key: "refunds", label: "Refunds", kind: "money", value: (r) => r.refunds, total: sumOf(rows, "refunds") },
          { key: "netExVat", label: "Net excl. VAT", labelAr: "الصافي", kind: "money", value: (r) => r.netExVat, total: netExVat, className: "font-semibold" },
          {
            key: "cost",
            label: "Cost",
            labelAr: "التكلفة",
            kind: "money",
            value: (r) => r.cost,
            total: sumOf(rows, "cost"),
            render: (r) => (
              <>
                {r.cost.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                {!r.hasCost && <span className="text-amber-600">*</span>}
              </>
            ),
          },
          { key: "profit", label: "Gross profit", labelAr: "الربح", kind: "money", value: (r) => r.profit, total: profit, className: "font-medium" },
          { key: "margin", label: "Margin", kind: "pct", value: (r) => r.margin, total: netExVat > 0 ? (profit / netExVat) * 100 : 0 },
          { key: "share", label: "Share", kind: "pct", value: (r) => r.share },
          { key: "avg", label: "Avg price", kind: "money", value: (r) => r.avgPrice },
          { key: "stock", label: "In stock", labelAr: "المخزون", kind: "int", value: (r) => r.stock },
        ]}
      />
    </div>
  );
}
