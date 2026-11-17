"use client";
import { dateTime, int, money } from "./format";
import ReportTable, { type Column } from "./ReportTable";
import { useReportData } from "./useReportData";

type Row = {
  sellerId: string;
  name: string;
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
  share: number;
  firstSale: string | null;
  lastSale: string | null;
};
type Data = { rows: Row[]; totals: Omit<Row, "sellerId" | "name" | "share" | "firstSale" | "lastSale"> };

export default function SellerTab({ query, onSeller }: { query: string; onSeller: (id: string) => void }) {
  const { data, loading, error } = useReportData<Data>(`/api/reports/sales/by-salesperson?${query}`);
  const t = data?.totals;
  const cols: Column<Row>[] = [
    { key: "name", label: "Salesperson", ar: "البائع", kind: "text", value: (r) => r.name, render: (r) => <span className="font-medium text-indigo-700">{r.name}</span> },
    { key: "orders", label: "Receipts", ar: "الفواتير", kind: "int", value: (r) => r.orders, total: t?.orders },
    { key: "items", label: "Items", ar: "القطع", kind: "int", value: (r) => r.items, total: t?.items },
    { key: "ipr", label: "Items / receipt", ar: "قطع/فاتورة", kind: "text", align: "right", value: (r) => (r.orders ? (r.items / r.orders).toFixed(2) : "-"), total: t && t.orders ? (t.items / t.orders).toFixed(2) : "-" },
    { key: "subtotal", label: "Shelf price", ar: "سعر الرف", kind: "money", value: (r) => r.subtotal, total: t?.subtotal },
    { key: "offers", label: "Offers", ar: "العروض", kind: "money", value: (r) => r.offers, total: t?.offers },
    { key: "discounts", label: "Discounts given", ar: "الخصومات", kind: "money", value: (r) => r.discounts, total: t?.discounts },
    { key: "vat", label: "VAT", ar: "الضريبة", kind: "money", value: (r) => r.vat, total: t?.vat },
    { key: "gross", label: "Gross sales", ar: "إجمالي المبيعات", kind: "money", value: (r) => r.gross, total: t?.gross, className: "font-medium" },
    { key: "refundCount", label: "Returns #", ar: "عدد المرتجعات", kind: "int", value: (r) => r.refundCount, total: t?.refundCount },
    { key: "refunds", label: "Refunds handled", ar: "قيمة المرتجعات", kind: "money", value: (r) => r.refunds, total: t?.refunds },
    { key: "net", label: "Net", ar: "الصافي", kind: "money", value: (r) => r.net, total: t?.net, className: "font-semibold" },
    { key: "avgTicket", label: "Average sale", ar: "متوسط الفاتورة", kind: "money", value: (r) => r.avgTicket, total: t?.avgTicket },
    { key: "share", label: "Share of sales", ar: "النسبة", kind: "pct", value: (r) => r.share, total: data?.rows.length ? 100 : undefined },
    { key: "first", label: "First sale", ar: "أول بيع", kind: "text", value: (r) => (r.firstSale ? dateTime(r.firstSale) : "-") },
    { key: "last", label: "Last sale", ar: "آخر بيع", kind: "text", value: (r) => (r.lastSale ? dateTime(r.lastSale) : "-") },
  ];
  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}
      <ReportTable
        id="sales-by-salesperson"
        title="Sales by salesperson"
        titleAr="المبيعات حسب البائع"
        columns={cols}
        rows={data?.rows ?? []}
        rowKey={(r) => r.sellerId}
        loading={loading}
        landscape
        onRowClick={(r) => onSeller(r.sellerId)}
        note={
          <>
            POS sales are credited to the cashier who rang them up; online orders appear as “Online store”. Refunds are credited to whoever processed them, so every refund is counted once.
            {t ? ` Totals: ${int(t.orders)} receipts · ${money(t.net)} OMR net.` : ""} Click a row to see that person&apos;s receipts.
          </>
        }
      />
    </div>
  );
}
