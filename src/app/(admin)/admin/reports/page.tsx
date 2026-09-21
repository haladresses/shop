"use client";
import { useCallback, useEffect, useState } from "react";
import { LuCalendarRange, LuChartColumn, LuMonitor, LuScanBarcode, LuWallet } from "react-icons/lu";

type SourceStat = { revenue: number; orders: number };

type DayStat = {
  date: string;
  onlineRevenue: number;
  posRevenue: number;
  onlineOrders: number;
  posOrders: number;
};

type Report = {
  range: { from: string; to: string };
  totals: { revenue: number; orders: number; avgOrderValue: number };
  bySource: { ONLINE: SourceStat; POS: SourceStat };
  byDay: DayStat[];
};

const omr = (n: number) => `${n.toFixed(3)} OMR`;
// Local calendar date, not toISOString() (which is UTC and would shift the
// day depending on the viewer's timezone offset — e.g. late-night Muscat
// time rolling into the wrong UTC day).
const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

type Preset = "today" | "7d" | "30d" | "month" | "custom";

function presetRange(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 6);
  else if (preset === "30d") from.setDate(from.getDate() - 29);
  else if (preset === "month") from.setDate(1);
  return { from: toISODate(from), to: toISODate(to) };
}

const StatCard = ({
  icon: Icon, accent, ring, value, label,
}: { icon: React.ElementType; accent: string; ring: string; value: string; label: string }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${accent} ring-4 ${ring} flex items-center justify-center text-white flex-shrink-0`}>
      <Icon size={22} />
    </div>
    <div className="min-w-0">
      <p className="text-lg sm:text-xl font-bold text-slate-800 leading-tight truncate">{value}</p>
      <p className="text-xs sm:text-sm text-slate-500 truncate">{label}</p>
    </div>
  </div>
);

export default function SalesReportPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: { from: string; to: string }) => {
    setLoading(true);
    const res = await fetch(`/api/reports/sales?from=${r.from}&to=${r.to}`, { cache: "no-store" });
    const data = await res.json();
    if (data.success) setReport(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const online = report?.bySource.ONLINE ?? { revenue: 0, orders: 0 };
  const pos = report?.bySource.POS ?? { revenue: 0, orders: 0 };
  const totalRevenue = report?.totals.revenue ?? 0;
  const onlineShare = totalRevenue > 0 ? (online.revenue / totalRevenue) * 100 : 0;
  const posShare = totalRevenue > 0 ? (pos.revenue / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Date range */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["month", "This month"],
          ] as [Preset, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                preset === p ? "bg-slate-800 border-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <LuCalendarRange size={16} className="text-slate-400 flex-shrink-0 hidden sm:block" />
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); }}
            className="admin-input !py-1.5 text-sm !w-auto"
          />
          <span className="text-slate-400 text-sm flex-shrink-0">to</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); }}
            className="admin-input !py-1.5 text-sm !w-auto"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard icon={LuWallet} accent="from-fuchsia-500 to-pink-500" ring="ring-fuchsia-100" value={omr(totalRevenue)} label="Total Revenue" />
            <StatCard icon={LuChartColumn} accent="from-indigo-500 to-violet-500" ring="ring-indigo-100" value={String(report?.totals.orders ?? 0)} label="Paid Orders" />
            <StatCard icon={LuWallet} accent="from-amber-400 to-orange-500" ring="ring-amber-100" value={omr(report?.totals.avgOrderValue ?? 0)} label="Average Order" />
          </div>

          {/* By channel */}
          <div className="admin-card p-4 sm:p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Revenue by channel</p>

            <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-100 flex mb-4">
              <div className="h-full bg-sky-500" style={{ width: `${onlineShare}%` }} />
              <div className="h-full bg-emerald-500" style={{ width: `${posShare}%` }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5">
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                  <LuMonitor size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Online</p>
                  <p className="text-xs text-slate-400">{online.orders} order{online.orders === 1 ? "" : "s"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-800">{omr(online.revenue)}</p>
                  <p className="text-xs text-slate-400">{onlineShare.toFixed(0)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <LuScanBarcode size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">POS</p>
                  <p className="text-xs text-slate-400">{pos.orders} order{pos.orders === 1 ? "" : "s"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-800">{omr(pos.revenue)}</p>
                  <p className="text-xs text-slate-400">{posShare.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Daily breakdown */}
          <div className="admin-card">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Daily breakdown</p>
            </div>
            {!report || report.byDay.length === 0 ? (
              <p className="text-center py-10 text-sm text-slate-400">No paid orders in this range</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Online Revenue</th>
                      <th className="text-center">Online Orders</th>
                      <th className="text-right">POS Revenue</th>
                      <th className="text-center">POS Orders</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...report.byDay].reverse().map((d) => (
                      <tr key={d.date}>
                        <td className="font-medium text-slate-700 whitespace-nowrap">{d.date}</td>
                        <td className="text-right whitespace-nowrap">{omr(d.onlineRevenue)}</td>
                        <td className="text-center text-slate-500">{d.onlineOrders}</td>
                        <td className="text-right whitespace-nowrap">{omr(d.posRevenue)}</td>
                        <td className="text-center text-slate-500">{d.posOrders}</td>
                        <td className="text-right font-medium whitespace-nowrap">{omr(d.onlineRevenue + d.posRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
