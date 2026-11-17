"use client";
import { DataTable, StatusLine, fmtDateTime, useReport, type Figures } from "./shared";

type Row = Figures & { sellerId: string; name: string; share: number; firstSale: string | null; lastSale: string | null };
type Data = { rows: Row[]; totals: Figures };

/** One row per salesperson; clicking a row lists that person's receipts. */
export default function SellersTab({ query, onOpenReceipts }: { query: string; onOpenReceipts: (sellerId: string) => void }) {
  const { data, loading, error } = useReport<Data>("/api/reports/sales/by-salesperson", query);
  if (!data) return <StatusLine loading={loading} error={error} />;
  const t = data.totals;
  return (
    <div className="space-y-3">
      <StatusLine loading={loading} error={error} />
      <DataTable
        id="by-salesperson"
        title="Sales by salesperson"
        titleAr="المبيعات حسب البائع"
        subtitle="POS sales by cashier; online orders as “Online store”. Refunds of POS sales count for whoever processed them. Click a row to see the receipts."
        rows={data.rows}
        rowKey={(r) => r.sellerId}
        defaultSort={{ key: "gross", dir: "desc" }}
        onRowClick={(r) => onOpenReceipts(r.sellerId)}
        columns={[
          { key: "name", label: "Salesperson", labelAr: "البائع", value: (r) => r.name, className: "font-medium text-indigo-700" },
          { key: "orders", label: "Receipts", labelAr: "الإيصالات", kind: "int", value: (r) => r.orders, total: t.orders },
          { key: "items", label: "Items", labelAr: "القطع", kind: "int", value: (r) => r.items, total: t.items },
          { key: "subtotal", label: "Shelf value", kind: "money", value: (r) => r.subtotal, total: t.subtotal, muted: true },
          { key: "offers", label: "Offers", labelAr: "العروض", kind: "money", value: (r) => r.offers, total: t.offers },
          { key: "discounts", label: "Discounts", labelAr: "الخصم", kind: "money", value: (r) => r.discounts, total: t.discounts },
          { key: "vat", label: "VAT", labelAr: "الضريبة", kind: "money", value: (r) => r.vat, total: t.vat },
          { key: "gross", label: "Gross", labelAr: "الإجمالي", kind: "money", value: (r) => r.gross, total: t.gross, className: "font-medium" },
          { key: "refundCount", label: "Returns", kind: "int", value: (r) => r.refundCount, total: t.refundCount },
          { key: "refunds", label: "Refunds", labelAr: "المرتجعات", kind: "money", value: (r) => r.refunds, total: t.refunds },
          { key: "net", label: "Net", labelAr: "الصافي", kind: "money", value: (r) => r.net, total: t.net, className: "font-semibold" },
          { key: "netExVat", label: "Net excl. VAT", kind: "money", value: (r) => r.netExVat, total: t.netExVat },
          { key: "avg", label: "Average sale", kind: "money", value: (r) => r.avgTicket, total: t.avgTicket },
          { key: "share", label: "Share", labelAr: "الحصة", kind: "pct", value: (r) => r.share, total: data.rows.length ? 100 : 0 },
          { key: "first", label: "First sale", value: (r) => (r.firstSale ? fmtDateTime(r.firstSale) : null), muted: true },
          { key: "last", label: "Last sale", value: (r) => (r.lastSale ? fmtDateTime(r.lastSale) : null), muted: true },
        ]}
      />
    </div>
  );
}
