"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LuArrowDownRight,
  LuArrowRight,
  LuArrowUpRight,
  LuBadgeAlert,
  LuBanknote,
  LuCirclePlus,
  LuClock,
  LuExternalLink,
  LuPackageX,
  LuReceipt,
  LuScanBarcode,
  LuShoppingBag,
  LuTrendingUp,
  LuTruck,
  LuUserPlus,
  LuWallet,
  LuWarehouse,
} from "react-icons/lu";
import { ColumnChart, VIZ } from "@/components/admin/charts";

type Sales = { orders: number; sales: number; online: number; pos: number };
type Dashboard = {
  today: Sales;
  yesterday: Sales;
  month: Sales;
  lastMonthToDate: Sales;
  monthProfit: number;
  newCustomers: number;
  series: { day: string; sales: number; orders: number }[];
  attention: {
    pending: number;
    toShip: number;
    unpaidTransfers: number;
    lowStock: number;
    outOfStock: number;
    openShifts: { cashier: string; openedAt: string }[];
  };
  recentOrders: {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    paymentStatus: string;
    source: string;
    createdAt: string;
    customer: string;
    items: number;
  }[];
  topProducts: { productId: string; nameEn: string; qty: number; revenue: number; image: string | null }[];
};

const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (k: string) => `${Number(k.slice(8))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;
const change = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / Math.abs(prev)) * 100);

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-sky-50 text-sky-700",
  PROCESSING: "bg-violet-50 text-violet-700",
  SHIPPED: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
  REFUNDED: "bg-slate-100 text-slate-600",
};

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [me, setMe] = useState<{ name: string; permissions: string[] }>({ name: "", permissions: [] });
  const [now, setNow] = useState<Date | null>(null);

  const load = () =>
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.success ? setData(d.data) : setError(d.error || "Could not load the dashboard")))
      .catch(() => setError("Could not load the dashboard"));

  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && setMe({ name: d.data.nameEn || d.data.email?.split("@")[0] || "", permissions: d.data.permissions || [] }))
      .catch(() => {});
    setNow(new Date());
    // Live-ish: refresh figures every minute while the tab is open.
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60000);
    return () => clearInterval(t);
  }, []);

  const can = (p: string) => me.permissions.includes(p);
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const actions = [
    { href: "/pos", label: "Open POS", icon: LuScanBarcode, perm: "pos.access" },
    { href: "/admin/products/new", label: "New product", icon: LuCirclePlus, perm: "admin.products.manage" },
    { href: "/admin/inventory", label: "Receive goods", icon: LuTruck, perm: "admin.inventory.manage" },
    { href: "/admin/finance", label: "Add expense", icon: LuReceipt, perm: "admin.finance.manage" },
  ].filter((a) => can(a.perm));

  return (
    <div className="space-y-6 pb-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight mt-0.5">
            {greeting}{me.name ? `, ${me.name.split(" ")[0]}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="inline-flex items-center gap-2 rounded-xl bg-white ring-1 ring-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:ring-slate-300 hover:bg-slate-50 transition">
              <a.icon size={16} className="text-slate-500" /> {a.label}
            </Link>
          ))}
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800">
            View store <LuExternalLink size={14} />
          </a>
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-sm">{error}</div>}

      {!data ? (
        <Skeleton />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <Kpi icon={LuBanknote} label="Today's sales" value={num(data.today.sales)} unit="OMR" delta={change(data.today.sales, data.yesterday.sales)} hint="vs yesterday" />
            <Kpi icon={LuShoppingBag} label="Orders today" value={String(data.today.orders)} delta={change(data.today.orders, data.yesterday.orders)} hint="vs yesterday" />
            <Kpi icon={LuTrendingUp} label="Sales this month" value={num(data.month.sales)} unit="OMR" delta={change(data.month.sales, data.lastMonthToDate.sales)} hint="vs same days last month" />
            {can("admin.finance.view") ? (
              <Kpi icon={LuWallet} label="Net profit this month" value={num(data.monthProfit)} unit="OMR" tone={data.monthProfit < 0 ? "bad" : undefined} hint="after cost & expenses" href="/admin/finance" />
            ) : (
              <Kpi icon={LuUserPlus} label="New customers" value={String(data.newCustomers)} hint="this month" />
            )}
          </div>

          <div className="grid xl:grid-cols-3 gap-4">
            {/* Sales chart */}
            <section className="xl:col-span-2 bg-white rounded-2xl ring-1 ring-slate-200/70 p-5 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-slate-800">Sales · last 30 days</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Paid orders, online + in-store</p>
                </div>
                <div className="text-end">
                  <p className="text-xl font-semibold text-slate-900 tabular-nums">{num(data.series.reduce((s, d) => s + d.sales, 0))} <span className="text-xs font-medium text-slate-400">OMR</span></p>
                  <p className="text-xs text-slate-400">{data.series.reduce((s, d) => s + d.orders, 0)} orders</p>
                </div>
              </div>
              <ColumnChart
                ariaLabel="Daily sales, last 30 days"
                height={240}
                data={data.series.map((d) => ({ key: d.day, label: dayLabel(d.day), value: d.sales }))}
                format={(n) => `${num(n)} OMR`}
                renderTooltip={(_, i) => (
                  <div>
                    <p className="font-semibold text-slate-800">{dayLabel(data.series[i].day)}</p>
                    <p className="tabular-nums">{num(data.series[i].sales)} OMR</p>
                    <p className="text-slate-400">{data.series[i].orders} orders</p>
                  </div>
                )}
              />
            </section>

            {/* Needs attention */}
            <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Needs attention</h2>
              <ul className="divide-y divide-slate-100">
                <Attention href="/admin/orders?status=PENDING" icon={LuClock} label="New orders to confirm" count={data.attention.pending} tone="amber" />
                <Attention href="/admin/orders?status=PROCESSING" icon={LuTruck} label="Online orders to ship" count={data.attention.toShip} tone="sky" />
                <Attention href="/admin/orders" icon={LuBadgeAlert} label="Bank transfers awaiting payment" count={data.attention.unpaidTransfers} tone="violet" />
                <Attention href="/admin/inventory" icon={LuWarehouse} label="Low stock" count={data.attention.lowStock} tone="amber" />
                <Attention href="/admin/inventory" icon={LuPackageX} label="Out of stock" count={data.attention.outOfStock} tone="rose" />
              </ul>
              <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3">
                <p className="text-xs font-medium text-slate-500 mb-1.5">At the till</p>
                {data.attention.openShifts.length === 0 ? (
                  <p className="text-sm text-slate-400">No open POS shift</p>
                ) : (
                  data.attention.openShifts.map((s, i) => (
                    <p key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {s.cashier} <span className="text-slate-400">· since {new Date(s.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                    </p>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid xl:grid-cols-3 gap-4">
            {/* Recent orders */}
            <section className="xl:col-span-2 bg-white rounded-2xl ring-1 ring-slate-200/70 min-w-0">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="font-semibold text-slate-800">Recent orders</h2>
                <Link href="/admin/orders" className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
                  All orders <LuArrowRight size={14} />
                </Link>
              </div>
              {data.recentOrders.length === 0 ? (
                <p className="px-5 pb-8 text-sm text-slate-400">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders?search=${encodeURIComponent(o.orderNumber)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${o.source === "POS" ? "bg-orange-50 text-orange-600" : "bg-sky-50 text-sky-600"}`}>
                          {o.source === "POS" ? <LuScanBarcode size={17} /> : <LuShoppingBag size={17} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{o.customer}</p>
                          <p className="text-xs text-slate-400 truncate">{o.orderNumber} · {o.items} item{o.items === 1 ? "" : "s"} · {timeAgo(o.createdAt)}</p>
                        </div>
                        <span className={`hidden sm:inline-flex text-[11px] font-semibold rounded-full px-2.5 py-1 ${STATUS_BADGE[o.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                        </span>
                        <span className="w-24 text-end text-sm font-semibold text-slate-800 tabular-nums">{num(o.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-4">
              {/* Channel split this month */}
              <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-5">
                <h2 className="font-semibold text-slate-800 mb-3">This month by channel</h2>
                <Split online={data.month.online} pos={data.month.pos} />
              </section>

              {/* Best sellers */}
              <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-slate-800">Best sellers · 30 days</h2>
                  {can("admin.finance.view") && (
                    <Link href="/admin/finance" className="text-xs text-slate-500 hover:text-slate-900">Details</Link>
                  )}
                </div>
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-slate-400">No sales yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {data.topProducts.map((p, i) => (
                      <li key={p.productId}>
                        <Link href={`/admin/products/${p.productId}`} className="flex items-center gap-3 group">
                          <span className="w-5 text-xs font-semibold text-slate-400 tabular-nums">{i + 1}</span>
                          <span className="w-10 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.image && <img src={p.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">{p.nameEn}</span>
                            <span className="block text-xs text-slate-400">{p.qty} sold · {num(p.revenue)} OMR</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  hint,
  tone,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  hint?: string;
  tone?: "bad";
  href?: string;
}) {
  const body = (
    <div className="h-full bg-white rounded-2xl ring-1 ring-slate-200/70 p-4 sm:p-5 transition hover:ring-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-slate-500">{label}</span>
        <span className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center"><Icon size={16} /></span>
      </div>
      <p className={`mt-3 text-xl sm:text-[26px] font-semibold tracking-tight tabular-nums truncate ${tone === "bad" ? "text-rose-600" : "text-slate-900"}`}>
        {value}
        {unit && <span className="ms-1 text-xs font-medium text-slate-400">{unit}</span>}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs min-h-[18px]">
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {delta >= 0 ? <LuArrowUpRight size={13} /> : <LuArrowDownRight size={13} />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {delta === null && <span className="font-semibold text-emerald-600">new</span>}
        {hint && <span className="text-slate-400 truncate">{hint}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const TONES: Record<string, string> = {
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
};

function Attention({ href, icon: Icon, label, count, tone }: { href: string; icon: React.ElementType; label: string; count: number; tone: string }) {
  return (
    <li>
      <Link href={href} className={`flex items-center gap-3 py-2.5 group ${count === 0 ? "opacity-50" : ""}`}>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${count ? TONES[tone] : "bg-slate-50 text-slate-400"}`}>
          <Icon size={16} />
        </span>
        <span className="flex-1 text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
        <span className={`min-w-[28px] h-6 px-2 rounded-full text-xs font-semibold flex items-center justify-center tabular-nums ${count ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>
          {count}
        </span>
      </Link>
    </li>
  );
}

function Split({ online, pos }: { online: number; pos: number }) {
  const total = online + pos;
  const op = total > 0 ? (online / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-[2px]">
        {online > 0 && <div style={{ width: `${op}%`, background: VIZ.series1 }} />}
        {pos > 0 && <div style={{ width: `${100 - op}%`, background: VIZ.series2 }} />}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {[
          ["Online store", online, VIZ.series1, op],
          ["In-store POS", pos, VIZ.series2, total > 0 ? 100 - op : 0],
        ].map(([label, v, color, pct]) => (
          <div key={label as string}>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <i className="w-2.5 h-2.5 rounded-sm" style={{ background: color as string }} /> {label as string}
            </p>
            <p className="font-semibold text-slate-800 tabular-nums mt-0.5">{num(v as number)}</p>
            <p className="text-xs text-slate-400">{(pct as number).toFixed(0)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[120px] rounded-2xl bg-white ring-1 ring-slate-200/70" />)}
      </div>
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 h-[320px] rounded-2xl bg-white ring-1 ring-slate-200/70" />
        <div className="h-[320px] rounded-2xl bg-white ring-1 ring-slate-200/70" />
      </div>
    </div>
  );
}
