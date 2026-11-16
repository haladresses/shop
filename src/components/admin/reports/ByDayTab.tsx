"use client";
import { useState } from "react";
import { dayLabel, int, money } from "./format";
import ReportTable, { Figure, type Column } from "./ReportTable";
import { useReportData } from "./useReportData";

type Row = {
  day: string;
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
  pos: number;
  online: number;
  cash: number;
  card: number;
  other: number;
};
type Data = { rows: Row[]; totals: Omit<Row, "day"> & { activeDays: number } };

export default function ByDayTab({ query, onDay }: { query: string; onDay: (day: string) => void }) {
  const { data, loading, error } = useReportData<Data>(`/api/reports/sales/by-day?${query}`);
  const [hideEmpty, setHideEmpty] = useState(true);
  const t = data?.totals;
  const rows = (data?.rows ?? []).filter((r) => !hideEmpty || r.orders > 0 || r.refundCount > 0);

  const cols: Column<Row>[] = [
    { key: "day", label: "Day", ar: "اليوم", kind: "text", value: (r) => r.day, render: (r) => <span className="font-medium">{dayLabel(r.day)}</span> },
    { key: "orders", label: "Receipts", ar: "الفواتير", kind: "int", value: (r) => r.orders, total: t?.orders },
    { key: "items", label: "Items", ar: "القطع", kind: "int", value: (r) => r.items, total: t?.items },
    { key: "subtotal", label: "Shelf price", ar: "سعر الرف", kind: "money", value: (r) => r.subtotal, total: t?.subtotal },
    { key: "offers", label: "Offers", ar: "العروض", kind: "money", value: (r) => r.offers, total: t?.offers },
    { key: "discounts", label: "Discounts", ar: "الخصومات", kind: "money", value: (r) => r.discounts, total: t?.discounts },
    { key: "shipping", label: "Delivery", ar: "التوصيل", kind: "money", value: (r) => r.shipping, total: t?.shipping },
    { key: "vat", label: "VAT", ar: "الضريبة", kind: "money", value: (r) => r.vat, total: t?.vat },
    { key: "gross", label: "Gross sales", ar: "إجمالي المبيعات", kind: "money", value: (r) => r.gross, total: t?.gross, className: "font-medium" },
    { key: "refunds", label: "Refunds", ar: "المرتجعات", kind: "money", value: (r) => r.refunds, total: t?.refunds },
    { key: "net", label: "Net sales", ar: "صافي المبيعات", kind: "money", value: (r) => r.net, total: t?.net, className: "font-semibold" },
    { key: "netExVat", label: "Net excl. VAT", ar: "الصافي قبل الضريبة", kind: "money", value: (r) => r.netExVat, total: t?.netExVat },
    { key: "avgTicket", label: "Avg ticket", ar: "متوسط الفاتورة", kind: "money", value: (r) => r.avgTicket, total: t?.avgTicket },
    { key: "pos", label: "POS", ar: "المتجر", kind: "money", value: (r) => r.pos, total: t?.pos },
    { key: "online", label: "Online", ar: "الإلكتروني", kind: "money", value: (r) => r.online, total: t?.online },
    { key: "cash", label: "Cash", ar: "نقداً", kind: "money", value: (r) => r.cash, total: t?.cash },
    { key: "card", label: "Card", ar: "بطاقة", kind: "money", value: (r) => r.card, total: t?.card },
    { key: "other", label: "Other", ar: "أخرى", kind: "money", value: (r) => r.other, total: t?.other },
  ];

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Figure label="Trading days" ar="أيام البيع" value={t ? int(t.activeDays) : "—"} sub={data ? `of ${data.rows.length} in period` : ""} />
        <Figure label="Receipts" ar="الفواتير" value={t ? int(t.orders) : "—"} sub={t ? `${int(t.items)} items` : ""} />
        <Figure label="Gross sales" ar="إجمالي المبيعات" value={t ? money(t.gross) : "—"} />
        <Figure label="Refunds" ar="المرتجعات" value={t ? money(t.refunds) : "—"} sub={t ? `${int(t.refundCount)} return(s)` : ""} />
        <Figure label="Avg per trading day" ar="متوسط اليوم" value={t && t.activeDays ? money(t.net / t.activeDays) : "—"} />
        <Figure label="Net sales" ar="صافي المبيعات" value={t ? money(t.net) : "—"} sub={t ? `Excl. VAT ${money(t.netExVat)}` : ""} strong />
      </div>
      <ReportTable
        id="sales-by-day"
        title="Sales by day"
        titleAr="المبيعات اليومية"
        columns={cols}
        rows={rows}
        rowKey={(r) => r.day}
        loading={loading}
        landscape
        onRowClick={(r) => onDay(r.day)}
        toolbar={
          <label className="flex items-center gap-1.5 text-xs text-slate-600 mr-1">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="rounded" /> Hide days without sales
          </label>
        }
        note="Sales are dated by when the order was placed; refunds by when they were made — so a day's net can be negative. Click a day for its full end-of-day summary."
      />
    </div>
  );
}
