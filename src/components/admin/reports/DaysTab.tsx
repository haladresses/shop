"use client";
import { useState } from "react";
import { DataTable, StatusLine, fmtDay, useReport, type Figures } from "./shared";

type DayRow = Figures & { day: string; pos: number; online: number; cash: number; card: number; other: number };
type Data = { range: { from: string; to: string }; rows: DayRow[]; totals: Figures & { pos: number; online: number; cash: number; card: number; other: number; activeDays: number } };

/** One row per business day in the period. */
export default function DaysTab({ query }: { query: string }) {
  const { data, loading, error } = useReport<Data>("/api/reports/sales/by-day", query);
  const [hideEmpty, setHideEmpty] = useState(false);
  if (!data) return <StatusLine loading={loading} error={error} />;
  const t = data.totals;
  const rows = hideEmpty ? data.rows.filter((r) => r.orders > 0 || r.refundCount > 0) : data.rows;
  const avgPerDay = t.activeDays > 0 ? t.net / t.activeDays : 0;

  return (
    <div className="space-y-3">
      <StatusLine loading={loading} error={error} />
      <DataTable
        id="by-day"
        title="Sales by day"
        titleAr="المبيعات حسب اليوم"
        subtitle={`${data.rows.length} days · ${t.activeDays} with sales · average net per trading day ${avgPerDay.toFixed(3)} OMR`}
        rows={rows}
        rowKey={(r) => r.day}
        defaultSort={{ key: "day", dir: "asc" }}
        rowClassName={(r) => (r.orders === 0 && r.refundCount === 0 ? "text-slate-400" : "")}
        toolbar={
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="rounded" /> Hide days without sales
          </label>
        }
        columns={[
          { key: "day", label: "Date", labelAr: "التاريخ", value: (r) => r.day, render: (r) => <span className="whitespace-nowrap">{fmtDay(r.day)}</span>, printValue: (r) => fmtDay(r.day) },
          { key: "orders", label: "Sales", labelAr: "المبيعات", kind: "int", value: (r) => r.orders, total: t.orders },
          { key: "items", label: "Items", labelAr: "القطع", kind: "int", value: (r) => r.items, total: t.items },
          { key: "subtotal", label: "Shelf value", labelAr: "سعر الرف", kind: "money", value: (r) => r.subtotal, total: t.subtotal, muted: true },
          { key: "offers", label: "Offers", labelAr: "العروض", kind: "money", value: (r) => r.offers, total: t.offers },
          { key: "discounts", label: "Discounts", labelAr: "الخصم", kind: "money", value: (r) => r.discounts, total: t.discounts },
          { key: "shipping", label: "Delivery", labelAr: "التوصيل", kind: "money", value: (r) => r.shipping, total: t.shipping },
          { key: "vat", label: "VAT", labelAr: "الضريبة", kind: "money", value: (r) => r.vat, total: t.vat },
          { key: "gross", label: "Gross", labelAr: "الإجمالي", kind: "money", value: (r) => r.gross, total: t.gross, className: "font-medium" },
          { key: "pos", label: "POS", kind: "money", value: (r) => r.pos, total: t.pos, muted: true },
          { key: "online", label: "Online", kind: "money", value: (r) => r.online, total: t.online, muted: true },
          { key: "cash", label: "Cash", labelAr: "نقداً", kind: "money", value: (r) => r.cash, total: t.cash },
          { key: "card", label: "Card", labelAr: "بطاقة", kind: "money", value: (r) => r.card, total: t.card },
          { key: "other", label: "Other", labelAr: "أخرى", kind: "money", value: (r) => r.other, total: t.other },
          { key: "refunds", label: "Refunds", labelAr: "المرتجعات", kind: "money", value: (r) => r.refunds, total: t.refunds },
          { key: "net", label: "Net", labelAr: "الصافي", kind: "money", value: (r) => r.net, total: t.net, className: "font-semibold" },
          { key: "netExVat", label: "Net excl. VAT", labelAr: "قبل الضريبة", kind: "money", value: (r) => r.netExVat, total: t.netExVat },
          { key: "avg", label: "Average sale", labelAr: "المتوسط", kind: "money", value: (r) => r.avgTicket, total: t.avgTicket },
        ]}
      />
    </div>
  );
}
