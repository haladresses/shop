"use client";
import { dayLabel, int, methodName, money } from "./format";
import ReportTable, { Figure, type Column } from "./ReportTable";
import { useReportData } from "./useReportData";

type Row = {
  method: string;
  transactions: number;
  orders: number;
  amount: number;
  pos: number;
  online: number;
  avg: number;
  share: number;
  refundCount: number;
  refunds: number;
  net: number;
};
type MatrixRow = { day: string; cells: Record<string, number>; total: number; refunds: number; net: number };
type Data = {
  rows: Row[];
  totals: { transactions: number; amount: number; pos: number; online: number; refundCount: number; refunds: number; net: number };
  grossSales: number;
  orders: number;
  unrecorded: number;
  matrix: { methods: string[]; rows: MatrixRow[] };
};

export default function PaymentTab({ query }: { query: string }) {
  const { data, loading, error } = useReportData<Data>(`/api/reports/sales/by-payment?${query}`);
  const t = data?.totals;
  const rows: Row[] = data
    ? [
        ...data.rows,
        ...(data.unrecorded
          ? [{ method: "No payment record", transactions: 0, orders: 0, amount: data.unrecorded, pos: 0, online: 0, avg: 0, share: 0, refundCount: 0, refunds: 0, net: data.unrecorded }]
          : []),
      ]
    : [];
  const cols: Column<Row>[] = [
    { key: "method", label: "Payment method", ar: "طريقة الدفع", kind: "text", value: (r) => methodName(r.method), render: (r) => <span className="font-medium">{methodName(r.method)}</span> },
    { key: "transactions", label: "Transactions", ar: "العمليات", kind: "int", value: (r) => r.transactions, total: t?.transactions },
    { key: "orders", label: "Receipts", ar: "الفواتير", kind: "int", value: (r) => r.orders },
    { key: "pos", label: "POS", ar: "المتجر", kind: "money", value: (r) => r.pos, total: t?.pos },
    { key: "online", label: "Online", ar: "الإلكتروني", kind: "money", value: (r) => r.online, total: t?.online },
    { key: "amount", label: "Received", ar: "المقبوض", kind: "money", value: (r) => r.amount, total: t ? t.amount + (data?.unrecorded ?? 0) : undefined, className: "font-medium" },
    { key: "avg", label: "Average transaction", ar: "متوسط العملية", kind: "money", value: (r) => r.avg },
    { key: "share", label: "Share", ar: "النسبة", kind: "pct", value: (r) => r.share, total: t?.amount ? 100 : undefined },
    { key: "refundCount", label: "Refunds #", ar: "عدد المرتجعات", kind: "int", value: (r) => r.refundCount, total: t?.refundCount },
    { key: "refunds", label: "Refunded", ar: "المسترد", kind: "money", value: (r) => r.refunds, total: t?.refunds },
    { key: "net", label: "Net", ar: "الصافي", kind: "money", value: (r) => r.net, total: t ? t.net + (data?.unrecorded ?? 0) : undefined, className: "font-semibold" },
  ];

  const methods = data?.matrix.methods ?? [];
  const mtx = data?.matrix.rows ?? [];
  const matrixCols: Column<MatrixRow>[] = [
    { key: "day", label: "Day", ar: "اليوم", kind: "text", value: (r) => r.day, render: (r) => dayLabel(r.day) },
    ...methods.map<Column<MatrixRow>>((m) => ({
      key: m,
      label: methodName(m),
      kind: "money",
      value: (r) => r.cells[m] ?? 0,
      total: mtx.reduce((s, r) => s + (r.cells[m] ?? 0), 0),
    })),
    { key: "total", label: "Total received", ar: "إجمالي المقبوض", kind: "money", value: (r) => r.total, total: mtx.reduce((s, r) => s + r.total, 0), className: "font-medium" },
    { key: "refunds", label: "Refunded", ar: "المسترد", kind: "money", value: (r) => r.refunds, total: mtx.reduce((s, r) => s + r.refunds, 0) },
    { key: "net", label: "Net", ar: "الصافي", kind: "money", value: (r) => r.net, total: mtx.reduce((s, r) => s + r.net, 0), className: "font-semibold" },
  ];

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Figure label="Received" ar="المقبوض" value={t ? money(t.amount) : "-"} sub={t ? `${int(t.transactions)} transactions` : ""} />
        <Figure label="Refunded" ar="المسترد" value={t ? money(t.refunds) : "-"} sub={t ? `${int(t.refundCount)} refunds` : ""} />
        <Figure label="Net takings" ar="صافي المقبوض" value={t ? money(t.net) : "-"} strong />
        <Figure label="Gross sales" ar="إجمالي المبيعات" value={data ? money(data.grossSales) : "-"} sub={data?.unrecorded ? `${money(data.unrecorded)} without a payment record` : "Reconciles with payments"} />
      </div>
      <ReportTable
        id="sales-by-payment"
        title="Takings by payment method"
        titleAr="المقبوضات حسب طريقة الدفع"
        columns={cols}
        rows={rows}
        rowKey={(r) => r.method}
        loading={loading}
        landscape
        note="Sales are listed by how they were paid (a split POS payment counts under each method); refunds by how the money was returned. “No payment record” is paid sales without a matching payment entry."
      />
      <ReportTable
        id="payments-by-day"
        title="Payment methods by day"
        titleAr="طرق الدفع اليومية"
        columns={matrixCols}
        rows={mtx}
        rowKey={(r) => r.day}
        loading={loading}
        landscape
      />
    </div>
  );
}
