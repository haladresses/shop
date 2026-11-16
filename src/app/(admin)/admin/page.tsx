"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { LuChevronRight, LuCircleCheck, LuStar, LuX } from "react-icons/lu";
import { ADMIN_NAVIGATION_META } from "@/lib/adminNavigationMeta";
import { useShortcuts } from "@/lib/adminShortcuts";
import { ORDER_TODOS } from "@/lib/orderTodos";

// Admin home, kept deliberately quiet: your own shortcuts (pages you starred),
// three numbers for today and this month, and a short list of what is waiting.
// Only lines with something in them are shown.

type Sales = { orders: number; sales: number };
type Dashboard = {
  today: Sales;
  month: Sales;
  attention: { pending: number; toShip: number; unpaidTransfers: number; lowStock: number; outOfStock: number };
};

const omr = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Icon for a starred page: the menu item whose link is the longest match. */
function iconFor(href: string): IconType {
  let best: { len: number; icon: IconType } = { len: 0, icon: LuStar };
  for (const m of ADMIN_NAVIGATION_META) {
    if ((href === m.href || href.startsWith(`${m.href}/`)) && m.href.length > best.len) best = { len: m.href.length, icon: m.icon };
  }
  return best.icon;
}

export default function AdminDashboard() {
  const { items: shortcuts, ready, remove } = useShortcuts();
  const [me, setMe] = useState<{ name: string; permissions: string[] } | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && setMe({ name: d.data.nameEn || "", permissions: d.data.permissions || [] }))
      .catch(() => {});
  }, []);

  const canSeeFigures = !!me?.permissions.includes("admin.dashboard.view");

  useEffect(() => {
    if (!canSeeFigures) return;
    const load = () =>
      fetch("/api/dashboard", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => d.success && setData(d.data))
        .catch(() => {});
    load();
    // Keep the numbers fresh while the tab is open.
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60000);
    return () => clearInterval(t);
  }, [canSeeFigures]);

  const can = (p: string) => !!me?.permissions.includes(p);
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const a = data?.attention;
  const waiting = a
    ? [
        { n: a.pending, label: ORDER_TODOS.confirm.label, href: "/admin/orders?todo=confirm", show: can("admin.orders.view") },
        { n: a.toShip, label: ORDER_TODOS.ship.label, href: "/admin/orders?todo=ship", show: can("admin.orders.view") },
        { n: a.unpaidTransfers, label: ORDER_TODOS.transfer.label, href: "/admin/orders?todo=transfer", show: can("admin.orders.view") },
        { n: a.lowStock, label: "Items running low", href: "/admin/inventory?status=low", show: can("admin.inventory.view") },
        { n: a.outOfStock, label: "Items out of stock", href: "/admin/inventory?status=out", show: can("admin.inventory.view") },
      ].filter((w) => w.show && w.n > 0)
    : [];

  return (
    <div className="max-w-5xl space-y-6 pb-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          {greeting}
          {me?.name ? `, ${me.name.split(" ")[0]}` : ""}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Your shortcuts */}
      <section>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Your shortcuts</h3>
        {!ready ? (
          <div className="h-20" />
        ) : shortcuts.length === 0 ? (
          <div className="admin-card p-5 text-sm text-slate-600 flex items-start gap-3">
            <LuStar size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <p>
              Open any page and tap the <strong>star</strong> next to its title. It will appear here so you can open it in one tap.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {shortcuts.map((s) => {
              const Icon = iconFor(s.href);
              return (
                <div key={s.href} className="relative">
                  <Link
                    href={s.href}
                    className="admin-card flex items-center gap-3 p-4 pr-9 h-full hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Icon size={20} />
                    </span>
                    <span className="text-sm font-medium text-slate-800 leading-snug">{s.label}</span>
                  </Link>
                  <button
                    onClick={() => remove(s.href)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                    title={`Remove "${s.label}" from your shortcuts`}
                    aria-label={`Remove ${s.label} from your shortcuts`}
                  >
                    <LuX size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {canSeeFigures && (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* Today */}
          <section>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Sales</h3>
            <div className="admin-card divide-y divide-slate-100">
              {[
                { label: "Sales today", value: data ? `${omr(data.today.sales)} OMR` : "-" },
                { label: "Orders today", value: data ? String(data.today.orders) : "-" },
                { label: "Sales this month", value: data ? `${omr(data.month.sales)} OMR` : "-" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="text-lg font-semibold text-slate-900 tabular-nums">{r.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Waiting for you */}
          <section>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Waiting for you</h3>
            <div className="admin-card">
              {!data ? (
                <p className="px-5 py-3.5 text-slate-400">-</p>
              ) : waiting.length === 0 ? (
                <p className="px-5 py-3.5 text-slate-600 flex items-center gap-2">
                  <LuCircleCheck size={18} className="text-emerald-600" /> Nothing is waiting. All done.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {waiting.map((w) => (
                    <li key={w.href}>
                      <Link href={w.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                        <span className="min-w-[2.75rem] h-8 px-2 rounded-lg bg-amber-100 text-amber-900 font-semibold flex items-center justify-center tabular-nums">
                          {w.n}
                        </span>
                        <span className="flex-1 text-slate-700">{w.label}</span>
                        <LuChevronRight size={18} className="text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
