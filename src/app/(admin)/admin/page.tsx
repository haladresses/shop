"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LuArrowRight, LuCirclePlus, LuExternalLink, LuReceipt, LuScanBarcode, LuTruck } from "react-icons/lu";

// Admin home: a plain daily overview for the shop owner. Numbers and small
// tables only (no charts, no animation): today's figures, what is waiting to
// be handled, recent orders, sales per day, channels and best sellers.

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
/** "2026-11-16" → "Mon 16 Nov" */
const dayName = (k: string) =>
  new Date(`${k}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Bold totals row cell, same look as the Sales Report tables. */
const TOTAL = "font-bold text-slate-900 bg-slate-100 border-t-2 border-slate-300 whitespace-nowrap";

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [me, setMe] = useState<{ name: string; permissions: string[] }>({ name: "", permissions: [] });
  const [now, setNow] = useState<Date | null>(null);
  const [allDays, setAllDays] = useState(false);

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
    // Keep the figures fresh: reload every minute while the tab is open.
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
    <div className="space-y-5 pb-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-0.5">
            {greeting}
            {me.name ? `, ${me.name.split(" ")[0]}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="admin-btn admin-btn-secondary">
              <a.icon size={16} /> {a.label}
            </Link>
          ))}
          <a href="/" target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary">
            View store <LuExternalLink size={14} />
          </a>
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-sm">{error}</div>}

      {!data ? (
        !error && (
          <div className="flex justify-center py-16">
            <div className="spinner" />
          </div>
        )
      ) : (
        <>
          {/* Today in numbers */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Figure label="Sales today" value={num(data.today.sales)} unit="OMR" note={`Yesterday: ${num(data.yesterday.sales)} OMR`} />
            <Figure label="Orders today" value={String(data.today.orders)} note={`Yesterday: ${data.yesterday.orders}`} />
            <Figure
              label="Sales this month"
              value={num(data.month.sales)}
              unit="OMR"
              note={`Same days last month: ${num(data.lastMonthToDate.sales)} OMR`}
            />
            {can("admin.finance.view") ? (
              <Figure
                label={data.monthProfit < 0 ? "Loss this month" : "Profit this month"}
                value={num(data.monthProfit)}
                unit="OMR"
                note="After cost of goods and expenses"
                negative={data.monthProfit < 0}
                href="/admin/finance"
              />
            ) : (
              <Figure label="New customers this month" value={String(data.newCustomers)} note="New accounts" />
            )}
          </div>

          <div className="grid xl:grid-cols-3 gap-5 items-start">
            {/* Waiting to be handled */}
            <Panel title="Waiting for you">
              <ul className="divide-y divide-slate-100">
                <Todo href="/admin/orders?status=PENDING" label="New orders to confirm" count={data.attention.pending} />
                <Todo href="/admin/orders?status=PROCESSING" label="Online orders to ship" count={data.attention.toShip} />
                <Todo href="/admin/orders" label="Bank transfers not paid yet" count={data.attention.unpaidTransfers} />
                <Todo href="/admin/inventory" label="Products running low" count={data.attention.lowStock} />
                <Todo href="/admin/inventory" label="Products out of stock" count={data.attention.outOfStock} />
              </ul>
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <span className="text-slate-500">Till (POS): </span>
                {data.attention.openShifts.length === 0 ? (
                  <span className="text-slate-700">no shift open</span>
                ) : (
                  <span className="text-slate-700">
                    {data.attention.openShifts.map((s) => `${s.cashier || "Cashier"} since ${clock(s.openedAt)}`).join(", ")}
                  </span>
                )}
              </div>
            </Panel>

            {/* Recent orders */}
            <Panel
              title="Latest orders"
              className="xl:col-span-2"
              action={
                <Link href="/admin/orders" className="text-sm font-medium text-indigo-600 hover:underline inline-flex items-center gap-1">
                  All orders <LuArrowRight size={14} />
                </Link>
              }
            >
              {data.recentOrders.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No orders yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table tabular-nums">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Where</th>
                        <th>Status</th>
                        <th className="text-right">Total (OMR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td className="whitespace-nowrap">
                            <Link href={`/admin/orders?search=${encodeURIComponent(o.orderNumber)}`} className="font-medium text-slate-800 hover:text-indigo-600 hover:underline">
                              {o.orderNumber}
                            </Link>
                            <p className="text-xs text-slate-500">{timeAgo(o.createdAt)}</p>
                          </td>
                          <td className="max-w-[220px]">
                            <p className="truncate">{o.customer}</p>
                            <p className="text-xs text-slate-500">
                              {o.items} item{o.items === 1 ? "" : "s"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap">{o.source === "POS" ? "In store" : "Online"}</td>
                          <td>
                            <span className={`badge badge-${o.status.toLowerCase()}`}>{o.status.charAt(0) + o.status.slice(1).toLowerCase()}</span>
                          </td>
                          <td className="text-right font-semibold whitespace-nowrap">{num(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid xl:grid-cols-3 gap-5 items-start">
            <SalesByDay series={data.series} allDays={allDays} onToggle={() => setAllDays((v) => !v)} reportsLink={can("admin.reports.view")} />

            <Panel title="This month: online and in store" note="Paid orders, amounts in OMR">
              <ChannelTable online={data.month.online} pos={data.month.pos} />
            </Panel>

            <Panel title="Best sellers, last 30 days" note="Pieces sold and sales in OMR">
              {data.topProducts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No sales yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table tabular-nums">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Sold</th>
                        <th className="text-right">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p) => (
                        <tr key={p.productId}>
                          <td className="!py-2">
                            <Link href={`/admin/products/${p.productId}`} className="flex items-center gap-2.5 min-w-0 hover:text-indigo-600">
                              <span className="w-8 h-10 rounded bg-slate-100 overflow-hidden shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {p.image && <img src={p.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                              </span>
                              <span className="truncate max-w-[180px]">{p.nameEn}</span>
                            </Link>
                          </td>
                          <td className="text-right">{p.qty}</td>
                          <td className="text-right whitespace-nowrap">{num(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/** White card with a title bar; content (usually a table) runs edge to edge. */
function Panel({
  title,
  note,
  action,
  className = "",
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`admin-card min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {note && <p className="text-xs text-slate-500">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One headline number with a plain-words comparison under it. */
function Figure({
  label,
  value,
  unit,
  note,
  negative,
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  negative?: boolean;
  href?: string;
}) {
  const body = (
    <div className={`admin-card h-full p-4 ${href ? "hover:border-slate-300" : ""}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-xl sm:text-2xl font-semibold tabular-nums ${negative ? "text-rose-600" : "text-slate-900"}`}>
        {value}
        {unit && <span className="ms-1 text-sm font-normal text-slate-500">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function Todo({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
        <span className={count ? "text-slate-800" : "text-slate-500"}>{label}</span>
        <span className={`tabular-nums ${count ? "font-bold text-slate-900" : "text-slate-400"}`}>{count}</span>
      </Link>
    </li>
  );
}

/** Sales per day, newest first: the last 7 days, or all 30 on request. */
function SalesByDay({
  series,
  allDays,
  onToggle,
  reportsLink,
}: {
  series: Dashboard["series"];
  allDays: boolean;
  onToggle: () => void;
  reportsLink: boolean;
}) {
  const days = allDays ? series : series.slice(-7);
  const rows = [...days].reverse();
  const today = series[series.length - 1]?.day;
  const yesterday = series[series.length - 2]?.day;
  const total = days.reduce((t, d) => ({ orders: t.orders + d.orders, sales: t.sales + d.sales }), { orders: 0, sales: 0 });

  return (
    <Panel
      title="Sales by day"
      note="Paid orders, online and in store"
      action={
        <button type="button" onClick={onToggle} className="text-sm font-medium text-indigo-600 hover:underline">
          {allDays ? "Show 7 days" : "Show 30 days"}
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="admin-table tabular-nums">
          <thead>
            <tr>
              <th>Day</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Sales (OMR)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              // Days without a sale stay readable but step back.
              const muted = d.orders === 0 ? "text-slate-400" : "";
              return (
                <tr key={d.day}>
                  <td className={`whitespace-nowrap ${muted}`}>{d.day === today ? "Today" : d.day === yesterday ? "Yesterday" : dayName(d.day)}</td>
                  <td className={`text-right ${muted}`}>{d.orders}</td>
                  <td className={`text-right whitespace-nowrap ${muted}`}>{num(d.sales)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className={TOTAL}>Total, {days.length} days</td>
              <td className={`${TOTAL} text-right`}>{total.orders}</td>
              <td className={`${TOTAL} text-right`}>{num(total.sales)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {reportsLink && (
        <div className="px-4 py-2.5 border-t border-slate-200 text-sm">
          <Link href="/admin/reports" className="font-medium text-indigo-600 hover:underline inline-flex items-center gap-1">
            Full sales report <LuArrowRight size={14} />
          </Link>
        </div>
      )}
    </Panel>
  );
}

/** Online vs in-store sales as two plain rows with their share and a total. */
function ChannelTable({ online, pos }: { online: number; pos: number }) {
  const total = online + pos;
  // One decimal, and the two shares always add up to exactly 100%.
  const onlineShare = total > 0 ? Math.round((online / total) * 1000) / 10 : 0;
  const share = (v: number) => (total > 0 ? `${v.toFixed(1)}%` : "-");
  return (
    <div className="overflow-x-auto">
      <table className="admin-table tabular-nums">
        <thead>
          <tr>
            <th>Channel</th>
            <th className="text-right">Sales</th>
            <th className="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Online store</td>
            <td className="text-right whitespace-nowrap">{num(online)}</td>
            <td className="text-right">{share(onlineShare)}</td>
          </tr>
          <tr>
            <td>In store (POS)</td>
            <td className="text-right whitespace-nowrap">{num(pos)}</td>
            <td className="text-right">{share(100 - onlineShare)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className={TOTAL}>Total</td>
            <td className={`${TOTAL} text-right`}>{num(total)}</td>
            <td className={`${TOTAL} text-right`}>{share(100)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
