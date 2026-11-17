"use client";
import { DataTable, StatusLine, f3, fmtDay, methodName, useReport } from "./shared";

type Row = { method: string; transactions: number; orders: number; amount: number; pos: number; online: number; avg: number; share: number; refundCount: number; refunds: number; net: number };
type MatrixRow = { day: string; cells: Record<string, number>; total: number; refunds: number; net: number };
type Data = {
  rows: Row[];
  totals: { transactions: number; amount: number; pos: number; online: number; refundCount: number; refunds: number; net: number };
  grossSales: number;
  orders: number;
  unrecorded: number;
  matrix: { methods: string[]; rows: MatrixRow[] };
};

/** Takings per payment method, and a day × method grid. */
export default function PaymentsTab({ query }: { query: string }) {
  const { data, loading, error } = useReport<Data>("/api/reports/sales/by-payment", query);
  if (!data) return <StatusLine loading={loading} error={error} />;
  const t = data.totals;
  const m = data.matrix;
  const colTotal = (k: string) => m.rows.reduce((s, r) => s + (r.cells[k] ?? 0), 0);

  return (
    <div className="space-y-4">
      <StatusLine loading={loading} error={error} />
      <DataTable
        id="by-payment"
        title="Sales by payment method"
        titleAr="المبيعات حسب طريقة الدفع"
        subtitle="Sales by how they were paid (a split payment counts once per method); refunds by how the money went back."
        rows={data.rows}
        rowKey={(r) => r.method}
        defaultSort={{ key: "amount", dir: "desc" }}
        note={
          data.unrecorded !== 0 ? (
            <>
              Gross sales {f3(data.grossSales)} OMR · payments recorded {f3(t.amount)} OMR · <b>{f3(data.unrecorded)} OMR</b> of paid sales have no payment record (older orders).
            </>
          ) : undefined
        }
        columns={[
          { key: "method", label: "Method", labelAr: "الطريقة", value: (r) => methodName(r.method), className: "font-medium" },
          { key: "tx", label: "Payments", labelAr: "العمليات", kind: "int", value: (r) => r.transactions, total: t.transactions },
          { key: "orders", label: "Sales", kind: "int", value: (r) => r.orders },
          { key: "pos", label: "POS", kind: "money", value: (r) => r.pos, total: t.pos, muted: true },
          { key: "online", label: "Online", kind: "money", value: (r) => r.online, total: t.online, muted: true },
          { key: "amount", label: "Taken", labelAr: "المحصّل", kind: "money", value: (r) => r.amount, total: t.amount, className: "font-medium" },
          { key: "avg", label: "Average payment", kind: "money", value: (r) => r.avg },
          { key: "share", label: "Share", kind: "pct", value: (r) => r.share, total: data.rows.length ? 100 : 0 },
          { key: "refundCount", label: "Returns", kind: "int", value: (r) => r.refundCount, total: t.refundCount },
          { key: "refunds", label: "Refunded", labelAr: "المسترد", kind: "money", value: (r) => r.refunds, total: t.refunds },
          { key: "net", label: "Net", labelAr: "الصافي", kind: "money", value: (r) => r.net, total: t.net, className: "font-semibold" },
        ]}
      />

      <DataTable
        id="payment-matrix"
        title="Day × payment method"
        titleAr="اليوم × طريقة الدفع"
        subtitle="Money taken each day per method, refunds paid out that day and the net."
        rows={m.rows}
        rowKey={(r) => r.day}
        defaultSort={{ key: "day", dir: "asc" }}
        emptyText="No payments in this period."
        columns={[
          { key: "day", label: "Date", labelAr: "التاريخ", value: (r) => r.day, render: (r) => <span className="whitespace-nowrap">{fmtDay(r.day)}</span>, printValue: (r) => fmtDay(r.day) },
          ...m.methods.map((k) => ({ key: `m-${k}`, label: methodName(k), kind: "money" as const, value: (r: MatrixRow) => r.cells[k] ?? 0, total: colTotal(k) })),
          { key: "total", label: "Taken", kind: "money", value: (r) => r.total, total: m.rows.reduce((s, r) => s + r.total, 0), className: "font-medium" },
          { key: "refunds", label: "Refunded", kind: "money", value: (r) => r.refunds, total: m.rows.reduce((s, r) => s + r.refunds, 0) },
          { key: "net", label: "Net", kind: "money", value: (r) => r.net, total: m.rows.reduce((s, r) => s + r.net, 0), className: "font-semibold" },
        ]}
      />
    </div>
  );
}
