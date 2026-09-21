"use client";
import { useCallback, useEffect, useState } from "react";
import { LuChartColumn, LuMonitor, LuScanBarcode, LuWallet } from "react-icons/lu";

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
  if (preset === "today") {
    // from = to = today
  } else if (preset === "7d") {
    from.setDate(from.getDate() - 6);
  } else if (preset === "30d") {
    from.setDate(from.getDate() - 29);
  } else if (preset === "month") {
    from.setDate(1);
  }
  return { from: toISODate(from), to: toISODate(to) };
}

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
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-white p-2.5">
        {([
          ["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["month", "This month"],
        ] as [Preset, string][]).map(([p, label]) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              preset === p ? "bg-slate-800 border-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="date"
            value={range.from}
            onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); }}
            className="admin-input !py-1.5 text-sm"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); }}
            className="admin-input !py-1.5 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 ring-4 ring-fuchsia-100 flex items-center justify-center text-white flex-shrink-0">
                <LuWallet size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-slate-800 leading-tight truncate">{omr(totalRevenue)}</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">Total Revenue</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 ring-4 ring-indigo-100 flex items-center justify-center text-white flex-shrink-0">
                <LuChartColumn size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-slate-800 leading-tight truncate">{report?.totals.orders ?? 0}</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">Paid Orders</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-400 to-sky-500 ring-4 ring-sky-100 flex items-center justify-center text-white flex-shrink-0">
                <LuMonitor size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-slate-800 leading-tight truncate">{omr(online.revenue)}</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">Online · {online.orders} orders ({onlineShare.toFixed(0)}%)</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 ring-4 ring-emerald-100 flex items-center justify-center text-white flex-shrink-0">
                <LuScanBarcode size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-slate-800 leading-tight truncate">{omr(pos.revenue)}</p>
                <p className="text-xs sm:text-sm text-slate-500 truncate">POS · {pos.orders} orders ({posShare.toFixed(0)}%)</p>
              </div>
            </div>
          </div>

          {/* Channel share bar */}
          {totalRevenue > 0 && (
            <div className="admin-card p-4 sm:p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Revenue by channel</p>
              <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex">
                <div className="h-full bg-sky-500" style={{ width: `${onlineShare}%` }} title={`Online ${onlineShare.toFixed(1)}%`} />
                <div className="h-full bg-emerald-500" style={{ width: `${posShare}%` }} title={`POS ${posShare.toFixed(1)}%`} />
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Online — {omr(online.revenue)}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> POS — {omr(pos.revenue)}</span>
                <span className="ml-auto">Avg order: {omr(report?.totals.avgOrderValue ?? 0)}</span>
              </div>
            </div>
          )}

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
                        <td className="font-medium text-slate-700">{d.date}</td>
                        <td className="text-right">{omr(d.onlineRevenue)}</td>
                        <td className="text-center text-slate-500">{d.onlineOrders}</td>
                        <td className="text-right">{omr(d.posRevenue)}</td>
                        <td className="text-center text-slate-500">{d.posOrders}</td>
                        <td className="text-right font-medium">{omr(d.onlineRevenue + d.posRevenue)}</td>
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
