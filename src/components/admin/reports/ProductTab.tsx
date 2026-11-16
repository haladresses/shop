"use client";
import { useEffect, useMemo, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";
import { int, money } from "./format";
import ReportTable, { Figure, type Column } from "./ReportTable";
import { useReportData } from "./useReportData";

export type LineFigures = {
  qtySold: number;
  qtyReturned: number;
  netQty: number;
  orders: number;
  gross: number;
  offers: number;
  discounts: number;
  vat: number;
  netExVat: number;
  refunds: number;
  refundsExVat: number;
  cost: number;
  profit: number;
  margin: number;
  avgPrice: number;
  hasCost: boolean;
};
type Row = LineFigures & {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  variantLabel: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string;
  stock: number | null;
  share: number;
};
type Data = { group: "product" | "variant"; rows: Row[]; totals: LineFigures & { products: number } };

const TOP_OPTIONS = [0, 10, 20, 50, 100];

/** Sums line figures and re-derives the ratios. */
export function sumFigures<T extends LineFigures>(rows: T[]): LineFigures {
  const s = (k: keyof LineFigures) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  const netExVat = s("netExVat");
  const refundsExVat = s("refundsExVat");
  const cost = s("cost");
  const revenue = netExVat - refundsExVat;
  const qtySold = s("qtySold");
  return {
    qtySold,
    qtyReturned: s("qtyReturned"),
    netQty: s("netQty"),
    orders: s("orders"),
    gross: s("gross"),
    offers: s("offers"),
    discounts: s("discounts"),
    vat: s("vat"),
    netExVat,
    refunds: s("refunds"),
    refundsExVat,
    cost,
    profit: revenue - cost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    avgPrice: qtySold > 0 ? (netExVat + s("vat")) / qtySold : 0,
    hasCost: rows.every((r) => r.hasCost),
  };
}

export default function ProductTab({
  query,
  categoryId,
  categoryName,
  onClearCategory,
}: {
  query: string;
  categoryId: string | null;
  categoryName?: string;
  onClearCategory: () => void;
}) {
  const [group, setGroup] = useState<"product" | "variant">("product");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [top, setTop] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const url = `/api/reports/sales/by-product?${query}&group=${group}${categoryId ? `&categoryId=${categoryId}` : ""}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`;
  const { data, loading, error } = useReportData<Data>(url);
  const rows = useMemo(() => (top ? (data?.rows ?? []).slice(0, top) : data?.rows ?? []), [data, top]);
  const t = useMemo(() => sumFigures(rows), [rows]);
  const share = rows.reduce((s, r) => s + r.share, 0);
  const missingCost = rows.filter((r) => !r.hasCost).length;

  const cols: Column<Row>[] = [
    { key: "sku", label: "SKU", ar: "الرمز", kind: "text", value: (r) => r.sku ?? "", render: (r) => <span className="font-mono text-xs">{r.sku ?? "—"}</span> },
    { key: "name", label: "Product", ar: "المنتج", kind: "text", value: (r) => r.nameEn, render: (r) => <span className="font-medium text-slate-800">{r.nameEn}</span> },
    { key: "nameAr", label: "Arabic name", ar: "الاسم بالعربية", kind: "text", value: (r) => r.nameAr, render: (r) => <span dir="rtl">{r.nameAr}</span> },
    ...(group === "variant"
      ? [{ key: "variant", label: "Colour / size", ar: "اللون / المقاس", kind: "text" as const, value: (r: Row) => r.variantLabel }]
      : []),
    { key: "category", label: "Category", ar: "الفئة", kind: "text", value: (r) => r.categoryName },
    { key: "qtySold", label: "Qty sold", ar: "الكمية المباعة", kind: "int", value: (r) => r.qtySold, total: t.qtySold },
    { key: "qtyReturned", label: "Returned", ar: "المرتجع", kind: "int", value: (r) => r.qtyReturned, total: t.qtyReturned },
    { key: "netQty", label: "Net qty", ar: "صافي الكمية", kind: "int", value: (r) => r.netQty, total: t.netQty, className: "font-medium" },
    { key: "gross", label: "Gross sales", ar: "إجمالي المبيعات", kind: "money", value: (r) => r.gross, total: t.gross },
    { key: "offers", label: "Offers", ar: "العروض", kind: "money", value: (r) => r.offers, total: t.offers },
    { key: "discounts", label: "Other discounts", ar: "خصومات أخرى", kind: "money", value: (r) => r.discounts, total: t.discounts },
    { key: "vat", label: "VAT", ar: "الضريبة", kind: "money", value: (r) => r.vat, total: t.vat },
    { key: "netExVat", label: "Net excl. VAT", ar: "الصافي قبل الضريبة", kind: "money", value: (r) => r.netExVat, total: t.netExVat, className: "font-semibold" },
    { key: "refunds", label: "Refunds", ar: "المرتجعات", kind: "money", value: (r) => r.refunds, total: t.refunds },
    { key: "cost", label: "Cost", ar: "التكلفة", kind: "money", value: (r) => r.cost, total: t.cost, render: (r) => <span className={r.hasCost ? "" : "text-amber-700"} title={r.hasCost ? undefined : "Some units have no purchase price"}>{money(r.cost)}{r.hasCost ? "" : " *"}</span> },
    { key: "profit", label: "Gross profit", ar: "إجمالي الربح", kind: "money", value: (r) => r.profit, total: t.profit, render: (r) => <span className={r.profit < 0 ? "text-rose-600 font-medium" : "font-medium"}>{money(r.profit)}</span> },
    { key: "margin", label: "Margin", ar: "الهامش", kind: "pct", value: (r) => r.margin, total: t.margin },
    { key: "share", label: "Share of sales", ar: "حصة المبيعات", kind: "pct", value: (r) => r.share, total: share },
    { key: "avgPrice", label: "Avg price", ar: "متوسط السعر", kind: "money", value: (r) => r.avgPrice, total: t.avgPrice },
    { key: "stock", label: "In stock", ar: "المخزون", kind: "int", value: (r) => r.stock },
  ];

  return (
    <div className="space-y-4">
      <div className="admin-card px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product name, SKU or barcode" className="admin-input !pl-9" />
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {(["product", "variant"] as const).map((gk) => (
            <button key={gk} onClick={() => setGroup(gk)} className={`px-3 py-1.5 ${group === gk ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {gk === "product" ? "Per product" : "Per colour / size"}
            </button>
          ))}
        </div>
        <select value={top} onChange={(e) => setTop(Number(e.target.value))} className="admin-input admin-select !w-auto">
          {TOP_OPTIONS.map((n) => (
            <option key={n} value={n}>{n ? `Top ${n} by net sales` : "All products"}</option>
          ))}
        </select>
        {categoryId && (
          <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-indigo-50 text-indigo-700 pl-3 pr-1.5 py-1">
            Category: {categoryName || "selected"} (incl. sub-categories)
            <button onClick={onClearCategory} className="p-0.5 rounded-full hover:bg-indigo-100" aria-label="Clear category"><LuX size={12} /></button>
          </span>
        )}
      </div>
      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Figure label={group === "variant" ? "Options sold" : "Products sold"} value={int(rows.filter((r) => r.qtySold > 0).length)} />
        <Figure label="Units sold" ar="القطع المباعة" value={int(t.qtySold)} sub={`${int(t.qtyReturned)} returned`} />
        <Figure label="Net excl. VAT" ar="الصافي قبل الضريبة" value={money(t.netExVat)} />
        <Figure label="Refunds" ar="المرتجعات" value={money(t.refunds)} />
        <Figure label="Gross profit" ar="إجمالي الربح" value={money(t.profit)} sub={`Margin ${t.margin.toFixed(1)}%`} strong />
        <Figure label="Cost of goods" ar="تكلفة البضاعة" value={money(t.cost)} sub={missingCost ? `${missingCost} without purchase price` : "All priced"} />
      </div>
      <ReportTable
        id={group === "variant" ? "sales-by-option" : "sales-by-product"}
        title={group === "variant" ? "Sales by product option" : "Sales by product"}
        titleAr={group === "variant" ? "المبيعات حسب اللون والمقاس" : "المبيعات حسب المنتج"}
        columns={cols}
        rows={rows}
        rowKey={(r) => r.key}
        loading={loading}
        landscape
        empty="No products sold in this period."
        note={
          <>
            Gross = shelf price × qty. Net excl. VAT = what was actually charged after offers and discounts, before VAT. Refunds and returned quantities are counted on the day of the return.
            Profit = net excl. VAT − refunds excl. VAT − cost (returned items put back in stock are taken out of cost).
            {missingCost > 0 && " * Some units have no purchase price, so their cost counts as zero and profit is overstated."}
          </>
        }
      />
    </div>
  );
}
