"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuArrowDownRight,
  LuArrowUpRight,
  LuCalendarRange,
  LuDownload,
  LuPencil,
  LuPlus,
  LuReceipt,
  LuTrash2,
  LuTriangleAlert,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { BarList, ColumnChart, VIZ } from "@/components/admin/charts";
import { EXPENSE_CATEGORIES, Granularity } from "@/lib/finance";

type Totals = {
  grossSales: number;
  discounts: number;
  shipping: number;
  refunds: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  expenses: number;
  netProfit: number;
  orders: number;
  itemsSold: number;
  avgOrderValue: number;
  onlineSales: number;
  posSales: number;
};

type Bucket = {
  bucket: string;
  orders: number;
  itemsSold: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  onlineSales: number;
  posSales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};

type Summary = {
  range: { from: string; to: string; granularity: Granularity };
  previousRange: { from: string; to: string };
  totals: Totals;
  previous: Totals;
  breakdown: Bucket[];
  linesMissingCost: number;
  topProducts: { productId: string; nameEn: string; quantity: number; revenue: number; cost: number; profit: number; margin: number; hasCost: boolean }[];
  topCategories: { categoryId: string; name: string; quantity: number; revenue: number; profit: number }[];
  paymentMethods: { method: string; amount: number; count: number }[];
  expensesByCategory: { category: string; amount: number }[];
};

type Expense = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  paymentMethod: string;
  reference: string | null;
  date: string;
};

const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const omr = (n: number) => `${num(n)} OMR`;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const G_LABEL: Record<Granularity, string> = { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };

function bucketLabel(key: string, g: Granularity, long = false): string {
  const [y, m, d] = key.split("-").map(Number);
  if (g === "year") return String(y);
  if (g === "month") return long ? `${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ’${String(y).slice(2)}`;
  if (g === "week") return long ? `Week of ${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
  return long ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

/** Default window for each view: 30 days / 12 weeks / 12 months / 5 years. */
function defaultRange(g: Granularity): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (g === "day") from.setDate(from.getDate() - 29);
  else if (g === "week") from.setDate(from.getDate() - 7 * 11 - ((from.getDay() + 6) % 7));
  else if (g === "month") { from.setMonth(from.getMonth() - 11, 1); }
  else { from.setFullYear(from.getFullYear() - 4, 0, 1); }
  return { from: iso(from), to: iso(to) };
}

const PRESETS: { id: string; label: string; g: Granularity; range: () => { from: string; to: string } }[] = [
  { id: "today", label: "Today", g: "day", range: () => ({ from: iso(new Date()), to: iso(new Date()) }) },
  { id: "week", label: "This week", g: "day", range: () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: iso(d), to: iso(new Date()) }; } },
  { id: "month", label: "This month", g: "day", range: () => { const d = new Date(); d.setDate(1); return { from: iso(d), to: iso(new Date()) }; } },
  { id: "year", label: "This year", g: "month", range: () => { const d = new Date(); d.setMonth(0, 1); return { from: iso(d), to: iso(new Date()) }; } },
];

function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export default function FinancePage() {
  const [tab, setTab] = useState<"overview" | "expenses">("overview");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [range, setRange] = useState(() => defaultRange("day"));
  const [preset, setPreset] = useState<string>("");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCanManage(!!d.data?.permissions?.includes("admin.finance.manage")))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/finance/summary?granularity=${granularity}&from=${range.from}&to=${range.to}`, { cache: "no-store" });
      const d = await res.json();
      if (d.success) setData(d.data);
      else setError(d.error || "Could not load the report.");
    } catch {
      setError("Could not load the report.");
    } finally {
      setLoading(false);
    }
  }, [granularity, range]);

  useEffect(() => {
    load();
  }, [load]);

  const pickGranularity = (g: Granularity) => {
    setGranularity(g);
    setRange(defaultRange(g));
    setPreset("");
  };

  const t = data?.totals;
  const p = data?.previous;

  const exportCsv = () => {
    if (!data) return;
    const head = ["Period", "Orders", "Items sold", "Gross sales", "Discounts", "Refunds", "Net sales", "Online", "POS", "Cost of goods", "Gross profit", "Expenses", "Net profit"];
    const rows = data.breakdown.map((b) => [
      bucketLabel(b.bucket, data.range.granularity, true), b.orders, b.itemsSold, b.grossSales, b.discounts, b.refunds, b.netSales,
      b.onlineSales, b.posSales, b.cogs, b.grossProfit, b.expenses, b.netProfit,
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${data.range.granularity}-${data.range.from}_${data.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {([["overview", "Profit & Loss"], ["expenses", "Expenses"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "expenses" ? (
        <ExpensesTab canManage={canManage} onChange={load} />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm w-full sm:w-auto">
              {(["day", "week", "month", "year"] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => pickGranularity(g)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg font-medium transition-colors ${granularity === g ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {G_LABEL[g]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((pr) => (
                <button
                  key={pr.id}
                  onClick={() => { setPreset(pr.id); setGranularity(pr.g); setRange(pr.range()); }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border ${preset === pr.id ? "bg-slate-800 border-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  {pr.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <LuCalendarRange size={16} className="text-slate-400 hidden sm:block" />
              <input type="date" value={range.from} max={range.to} onChange={(e) => { setPreset(""); setRange((r) => ({ ...r, from: e.target.value })); }} className="admin-input !py-1.5 text-sm !w-auto min-w-0" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={range.to} min={range.from} onChange={(e) => { setPreset(""); setRange((r) => ({ ...r, to: e.target.value })); }} className="admin-input !py-1.5 text-sm !w-auto min-w-0" />
              <button onClick={exportCsv} disabled={!data} className="admin-btn admin-btn-secondary !py-1.5 text-sm shrink-0" title="Export CSV">
                <LuDownload size={15} /> CSV
              </button>
            </div>
          </div>

          {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-sm">{error}</div>}

          {!data || !t || !p ? (
            <div className="flex justify-center py-16"><div className="spinner" /></div>
          ) : (
            <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {data.linesMissingCost > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 px-4 py-3 text-sm">
                  <LuTriangleAlert size={18} className="shrink-0 mt-0.5" />
                  <p>
                    {data.linesMissingCost} sold line{data.linesMissingCost === 1 ? " has" : "s have"} no purchase price, so profit is overstated.
                    Add a <strong>Purchase Price</strong> on those products (Products → edit).
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Net sales" value={omr(t.netSales)} change={pctChange(t.netSales, p.netSales)} />
                <Kpi label="Gross profit" value={omr(t.grossProfit)} sub={`${t.grossMargin.toFixed(1)}% margin`} change={pctChange(t.grossProfit, p.grossProfit)} />
                <Kpi label={t.netProfit < 0 ? "Net loss" : "Net profit"} value={omr(t.netProfit)} change={pctChange(t.netProfit, p.netProfit)} tone={t.netProfit < 0 ? "loss" : "profit"} />
                <Kpi label="Expenses" value={omr(t.expenses)} change={pctChange(t.expenses, p.expenses)} invert />
                <Kpi label="Orders" value={t.orders.toLocaleString()} change={pctChange(t.orders, p.orders)} />
                <Kpi label="Avg. order value" value={omr(t.avgOrderValue)} change={pctChange(t.avgOrderValue, p.avgOrderValue)} />
                <Kpi label="Items sold" value={t.itemsSold.toLocaleString()} change={pctChange(t.itemsSold, p.itemsSold)} />
                <Kpi label="Refunds" value={omr(t.refunds)} change={pctChange(t.refunds, p.refunds)} invert />
              </div>
              <p className="text-xs text-slate-400 -mt-2">Change vs previous period {data.previousRange.from} → {data.previousRange.to}</p>

              <div className="grid lg:grid-cols-2 gap-5">
                <Card title="Net sales" subtitle={`${G_LABEL[data.range.granularity]} · after refunds`}>
                  <ColumnChart
                    ariaLabel="Net sales per period"
                    data={data.breakdown.map((b) => ({ key: b.bucket, label: bucketLabel(b.bucket, data.range.granularity), value: b.netSales }))}
                    format={omr}
                    renderTooltip={(_, i) => {
                      const b = data.breakdown[i];
                      return (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800 mb-1">{bucketLabel(b.bucket, data.range.granularity, true)}</p>
                          <TipRow label="Net sales" value={omr(b.netSales)} />
                          <TipRow label="Online / POS" value={`${num(b.onlineSales)} / ${num(b.posSales)}`} />
                          <TipRow label="Orders" value={String(b.orders)} />
                        </div>
                      );
                    }}
                  />
                </Card>
                <Card
                  title="Net profit"
                  subtitle="After cost of goods and expenses"
                  legend={
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: VIZ.positive }} /> Profit</span>
                      <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: VIZ.negative }} /> Loss</span>
                    </div>
                  }
                >
                  <ColumnChart
                    ariaLabel="Net profit or loss per period"
                    diverging
                    data={data.breakdown.map((b) => ({ key: b.bucket, label: bucketLabel(b.bucket, data.range.granularity), value: b.netProfit }))}
                    format={omr}
                    renderTooltip={(_, i) => {
                      const b = data.breakdown[i];
                      return (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800 mb-1">{bucketLabel(b.bucket, data.range.granularity, true)}</p>
                          <TipRow label="Net sales" value={num(b.netSales)} />
                          <TipRow label="− Cost of goods" value={num(b.cogs)} />
                          <TipRow label="− Expenses" value={num(b.expenses)} />
                          <TipRow label={b.netProfit < 0 ? "Net loss" : "Net profit"} value={omr(b.netProfit)} strong />
                        </div>
                      );
                    }}
                  />
                </Card>
              </div>

              <div className="grid lg:grid-cols-3 gap-5">
                <Card title="Profit & loss statement" subtitle={`${data.range.from} → ${data.range.to}`}>
                  <dl className="text-sm divide-y divide-slate-100">
                    <PlRow label="Sales (incl. shipping)" value={t.grossSales} />
                    <PlRow label="  discounts given" value={t.discounts} muted />
                    <PlRow label="  shipping charged" value={t.shipping} muted />
                    <PlRow label="Refunds & returns" value={-t.refunds} />
                    <PlRow label="Net sales" value={t.netSales} strong />
                    <PlRow label="Cost of goods sold" value={-t.cogs} />
                    <PlRow label="Gross profit" value={t.grossProfit} strong />
                    {data.expensesByCategory.map((e) => (
                      <PlRow key={e.category} label={`  ${e.category}`} value={-e.amount} muted />
                    ))}
                    <PlRow label="Operating expenses" value={-t.expenses} />
                    <PlRow label={t.netProfit < 0 ? "Net loss" : "Net profit"} value={t.netProfit} strong highlight />
                  </dl>
                </Card>

                <Card title="Sales channels & payments">
                  <ChannelSplit online={t.onlineSales} pos={t.posSales} />
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Payment methods</p>
                    {data.paymentMethods.length === 0 ? (
                      <p className="text-sm text-slate-400">No payments in this period.</p>
                    ) : (
                      <BarList
                        items={data.paymentMethods.map((m) => ({
                          label: m.method.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
                          value: m.amount,
                          sub: `${m.count} payments`,
                        }))}
                        format={num}
                      />
                    )}
                  </div>
                </Card>

                <Card title="Top categories">
                  {data.topCategories.length === 0 ? (
                    <p className="text-sm text-slate-400">No sales in this period.</p>
                  ) : (
                    <BarList items={data.topCategories.map((c) => ({ label: c.name, value: c.revenue, sub: `${c.quantity} sold · profit ${num(c.profit)}` }))} format={num} />
                  )}
                </Card>
              </div>

              <Card title="Best-selling products" subtitle="Revenue, purchase cost and profit per product">
                <div className="overflow-x-auto -mx-5">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Sold</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">Profit</th>
                        <th className="text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((tp) => (
                        <tr key={tp.productId}>
                          <td className="max-w-[260px]">
                            <a href={`/admin/products/${tp.productId}`} className="font-medium text-slate-800 hover:text-indigo-600 truncate block">{tp.nameEn}</a>
                            {!tp.hasCost && <span className="text-[11px] text-amber-600">No purchase price</span>}
                          </td>
                          <td className="text-right tabular-nums">{tp.quantity}</td>
                          <td className="text-right tabular-nums">{num(tp.revenue)}</td>
                          <td className="text-right tabular-nums text-slate-500">{num(tp.cost)}</td>
                          <td className={`text-right tabular-nums font-medium ${tp.profit < 0 ? "text-rose-600" : "text-slate-800"}`}>{num(tp.profit)}</td>
                          <td className="text-right tabular-nums">{tp.margin.toFixed(1)}%</td>
                        </tr>
                      ))}
                      {data.topProducts.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">No sales in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Breakdown by period" subtitle="Table view of the charts above">
                <div className="overflow-x-auto -mx-5 max-h-[520px] overflow-y-auto">
                  <table className="admin-table">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th>Period</th>
                        <th className="text-right">Orders</th>
                        <th className="text-right">Net sales</th>
                        <th className="text-right">Refunds</th>
                        <th className="text-right">COGS</th>
                        <th className="text-right">Gross profit</th>
                        <th className="text-right">Expenses</th>
                        <th className="text-right">Net profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.breakdown].reverse().map((b) => (
                        <tr key={b.bucket}>
                          <td className="whitespace-nowrap">{bucketLabel(b.bucket, data.range.granularity, true)}</td>
                          <td className="text-right tabular-nums">{b.orders}</td>
                          <td className="text-right tabular-nums">{num(b.netSales)}</td>
                          <td className="text-right tabular-nums text-slate-500">{num(b.refunds)}</td>
                          <td className="text-right tabular-nums text-slate-500">{num(b.cogs)}</td>
                          <td className="text-right tabular-nums">{num(b.grossProfit)}</td>
                          <td className="text-right tabular-nums text-slate-500">{num(b.expenses)}</td>
                          <td className={`text-right tabular-nums font-semibold ${b.netProfit < 0 ? "text-rose-600" : "text-slate-800"}`}>{num(b.netProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ title, subtitle, legend, children }: { title: string; subtitle?: string; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/70 p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, change, invert, tone }: { label: string; value: string; sub?: string; change: number | null; invert?: boolean; tone?: "profit" | "loss" }) {
  const good = change === null ? null : invert ? change <= 0 : change >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-lg sm:text-xl font-bold mt-1 tabular-nums truncate ${tone === "loss" ? "text-rose-600" : "text-slate-800"}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1 min-h-[18px]">
        {change !== null ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? "text-emerald-600" : "text-rose-600"}`}>
            {change >= 0 ? <LuArrowUpRight size={13} /> : <LuArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        ) : (
          <span className="text-xs text-slate-400">new</span>
        )}
        {sub && <span className="text-xs text-slate-400 truncate">{sub}</span>}
      </div>
    </div>
  );
}

function PlRow({ label, value, strong, muted, highlight }: { label: string; value: number; strong?: boolean; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-2 ${highlight ? "bg-slate-50 -mx-2 px-2 rounded-lg" : ""}`}>
      <dt className={`whitespace-pre ${strong ? "font-semibold text-slate-800" : muted ? "text-slate-400 text-xs" : "text-slate-600"}`}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""} ${muted ? "text-slate-400 text-xs" : value < 0 && strong ? "text-rose-600" : "text-slate-800"}`}>
        {num(value)}
      </dd>
    </div>
  );
}

function TipRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold text-slate-800 pt-0.5" : ""}`}>
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ChannelSplit({ online, pos }: { online: number; pos: number }) {
  const total = online + pos;
  const op = total > 0 ? (online / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 gap-[2px]">
        {online > 0 && <div style={{ width: `${op}%`, background: VIZ.series1 }} />}
        {pos > 0 && <div style={{ width: `${100 - op}%`, background: VIZ.series2 }} />}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
        <div>
          <p className="flex items-center gap-1.5 text-slate-500 text-xs"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: VIZ.series1 }} /> Online store</p>
          <p className="font-semibold text-slate-800 tabular-nums">{num(online)}</p>
          <p className="text-xs text-slate-400">{op.toFixed(0)}%</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-slate-500 text-xs"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: VIZ.series2 }} /> In-store POS</p>
          <p className="font-semibold text-slate-800 tabular-nums">{num(pos)}</p>
          <p className="text-xs text-slate-400">{total > 0 ? (100 - op).toFixed(0) : 0}%</p>
        </div>
      </div>
    </div>
  );
}

const emptyExpense = () => ({ category: "Rent", amount: "", description: "", paymentMethod: "CASH", reference: "", date: iso(new Date()) });

function ExpensesTab({ canManage, onChange }: { canManage: boolean; onChange: () => void }) {
  const [items, setItems] = useState<Expense[]>([]);
  const [sum, setSum] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", category: "", search: "" });
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyExpense());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const d = await fetch(`/api/finance/expenses?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (d?.success) {
      setItems(d.data.items);
      setSum(d.data.sum);
      setTotalPages(Math.max(1, d.data.meta.totalPages));
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyExpense());
    setErr("");
    setFormOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({ category: e.category, amount: String(e.amount), description: e.description || "", paymentMethod: e.paymentMethod, reference: e.reference || "", date: e.date });
    setErr("");
    setFormOpen(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setErr("");
    const body = { ...form, amount: parseFloat(form.amount), description: form.description || null, reference: form.reference || null };
    const res = await fetch(editing ? `/api/finance/expenses/${editing.id}` : "/api/finance/expenses", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setSaving(false);
    if (!d.success) return setErr(d.error || "Could not save.");
    setFormOpen(false);
    load();
    onChange();
  };

  const remove = async (e: Expense) => {
    if (!confirm(`Delete this ${e.category} expense of ${omr(e.amount)}?`)) return;
    await fetch(`/api/finance/expenses/${e.id}`, { method: "DELETE" });
    load();
    onChange();
  };

  const categories = useMemo(() => Array.from(new Set<string>([...EXPENSE_CATEGORIES, ...items.map((i) => i.category)])), [items]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
        <input value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="Search description / reference" className="admin-input !py-2 text-sm md:max-w-xs" />
        <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)} className="admin-input admin-select !py-2 text-sm md:max-w-[200px]">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className="admin-input !py-2 text-sm !w-auto min-w-0" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className="admin-input !py-2 text-sm !w-auto min-w-0" />
        </div>
        <div className="md:ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-500">Total <strong className="text-slate-800">{omr(sum)}</strong></span>
          {canManage && (
            <button onClick={openNew} className="admin-btn admin-btn-primary !py-2 text-sm"><LuPlus size={16} /> Add expense</button>
          )}
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-slate-400">
            <LuReceipt size={32} className="mb-2" />
            <p>No expenses recorded{filters.from || filters.category || filters.search ? " for these filters" : " yet"}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Paid by</th>
                  <th className="text-right">Amount</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{e.date}</td>
                    <td><span className="badge bg-slate-100 text-slate-700">{e.category}</span></td>
                    <td className="max-w-[320px]">
                      <p className="truncate">{e.description || "—"}</p>
                      {e.reference && <p className="text-xs text-slate-400">Ref: {e.reference}</p>}
                    </td>
                    <td className="text-slate-500 text-sm">{e.paymentMethod.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="text-right tabular-nums font-medium">{num(e.amount)}</td>
                    {canManage && (
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100" aria-label="Edit"><LuPencil size={15} /></button>
                        <button onClick={() => remove(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Delete"><LuTrash2 size={15} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Prev</button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      <AdminModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        className="!max-w-md"
        title={editing ? "Edit expense" : "Add expense"}
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} className="admin-btn admin-btn-secondary">Cancel</button>
            <button type="submit" form="expense-form" disabled={saving} className="admin-btn admin-btn-primary">{saving ? "Saving..." : "Save"}</button>
          </>
        }
      >
        <form id="expense-form" onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="admin-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (OMR)</label>
              <input type="number" step="0.001" min="0.001" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="admin-input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <input list="expense-cats" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="admin-input" />
            <datalist id="expense-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="admin-input" placeholder="e.g. October shop rent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paid by</label>
              <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="admin-input admin-select">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="admin-input" placeholder="Invoice #" />
            </div>
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </form>
      </AdminModal>
    </div>
  );
}
