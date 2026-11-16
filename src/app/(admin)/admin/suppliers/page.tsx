"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LuCalendarClock,
  LuCircleAlert,
  LuClipboardList,
  LuHandshake,
  LuListTodo,
  LuPlus,
  LuTruck,
  LuUndo2,
  LuWallet,
} from "react-icons/lu";
import { PayablesTab, SuppliersTab } from "@/components/admin/purchasing/DashboardTabs";
import PaymentModal from "@/components/admin/purchasing/PaymentModal";
import { PaymentsTable } from "@/components/admin/purchasing/PaymentsTable";
import SupplierFormModal from "@/components/admin/purchasing/SupplierFormModal";
import { TaskList } from "@/components/admin/purchasing/Tasks";
import { Kpi, TabBar, api, fmt3, fmtDate, usePurchasingPerms } from "@/components/admin/purchasing/shared";

type Summary = {
  suppliers: { total: number; active: number };
  totalPayable: number;
  totalCredit: number;
  netBalance: number;
  overdue: { amount: number; count: number };
  dueSoon: { amount: number; count: number };
  aging: { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; onAccount: number };
  awaitingDelivery: { count: number; value: number; late: number; lateOrders: { id: string; number: string; supplier: { id: string; nameEn: string }; expectedDate: string | null }[] };
  month: { purchases: number; purchaseVat: number; orders: number; payments: number; paymentsCount: number; returns: number; returnsCount: number; refunds: number };
  tasks: { open: number; overdue: number; dueToday: number };
  topSuppliers: { id: string; code: string; nameEn: string; balance: number }[];
  upcoming: { id: string; number: string; supplier: { id: string; nameEn: string; code: string }; dueDate: string | null; outstanding: number; daysOverdue: number }[];
};

type Tab = "suppliers" | "payables" | "payments" | "tasks";

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><span className="spinner" /></div>}>
      <Suppliers />
    </Suspense>
  );
}

function Suppliers() {
  const router = useRouter();
  const sp = useSearchParams();
  const perms = usePurchasingPerms();
  const [tab, setTab] = useState<Tab>(((["suppliers", "payables", "payments", "tasks"] as Tab[]).includes(sp.get("tab") as Tab) ? sp.get("tab") : "suppliers") as Tab);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const loadSummary = useCallback(() => {
    api<Summary>("/api/suppliers/summary").then((d) => d.success && d.data && setSummary(d.data));
  }, []);
  useEffect(() => {
    loadSummary();
  }, [loadSummary, reloadKey]);

  const changed = () => setReloadKey((k) => k + 1);
  const go = (t: Tab) => {
    setTab(t);
    router.replace(`/admin/suppliers?tab=${t}`, { scroll: false });
  };

  const a = summary?.aging;
  const agingRows: [string, number, string][] = a
    ? [
        ["Not yet due", a.current, "text-slate-800"],
        ["1–30 days late", a.d1_30, "text-amber-600"],
        ["31–60 days late", a.d31_60, "text-orange-600"],
        ["61–90 days late", a.d61_90, "text-rose-600"],
        ["Over 90 days late", a.d90plus, "text-rose-700"],
        ["On account (opening / unapplied)", a.onAccount, "text-slate-500"],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Suppliers</h1>
          <p className="text-sm text-slate-500">Who you buy from, what you owe them, what&apos;s coming and what needs doing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {perms.pay && (
            <button onClick={() => setPayOpen(true)} className="admin-btn admin-btn-secondary"><LuWallet size={15} /> Record payment</button>
          )}
          {perms.receive && (
            <Link href="/admin/supplier-returns/new" className="admin-btn admin-btn-secondary"><LuUndo2 size={15} /> Return goods</Link>
          )}
          {perms.managePurchases && (
            <Link href="/admin/purchases/new" className="admin-btn admin-btn-secondary"><LuClipboardList size={15} /> New purchase order</Link>
          )}
          {perms.manageSuppliers && (
            <button onClick={() => setNewOpen(true)} className="admin-btn admin-btn-primary"><LuPlus size={16} /> New supplier</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={LuWallet} label="Total payable" value={summary ? `${fmt3(summary.totalPayable)}` : "-"} sub={summary ? (summary.totalCredit > 0 ? `${fmt3(summary.totalCredit)} credit with suppliers` : `${summary.suppliers.active} active suppliers`) : ""} tone="info" onClick={() => go("payables")} />
        <Kpi icon={LuCircleAlert} label="Overdue" value={summary ? fmt3(summary.overdue.amount) : "-"} sub={summary ? `${summary.overdue.count} order${summary.overdue.count === 1 ? "" : "s"}` : ""} tone={summary && summary.overdue.amount > 0 ? "bad" : undefined} onClick={() => go("payables")} />
        <Kpi icon={LuCalendarClock} label="Due in the next 7 days" value={summary ? fmt3(summary.dueSoon.amount) : "-"} sub={summary ? `${summary.dueSoon.count} order${summary.dueSoon.count === 1 ? "" : "s"}` : ""} tone="warn" />
        <Kpi
          icon={LuTruck}
          label="Awaiting delivery"
          value={summary ? String(summary.awaitingDelivery.count) : "-"}
          sub={summary ? `${fmt3(summary.awaitingDelivery.value)} OMR${summary.awaitingDelivery.late ? ` · ${summary.awaitingDelivery.late} late` : ""}` : ""}
          tone={summary?.awaitingDelivery.late ? "bad" : undefined}
          onClick={() => router.push("/admin/purchases?status=open")}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="admin-card">
          <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Payables by age</p>
          <table className="admin-table">
            <tbody>
              {agingRows.map(([label, v, cls]) => (
                <tr key={label}>
                  <td className="text-sm text-slate-600">{label}</td>
                  <td className={`text-right tabular-nums font-semibold ${Math.abs(v) > 0.0005 ? cls : "text-slate-300"}`}>{v < -0.0005 ? `−${fmt3(-v)}` : fmt3(v)}</td>
                </tr>
              ))}
              {summary && (
                <tr>
                  <td className="text-sm font-semibold text-slate-800">Net balance</td>
                  <td className="text-right tabular-nums font-bold">{fmt3(summary.netBalance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-card">
          <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Next payments due</p>
          {!summary || summary.upcoming.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">Nothing with a due date is outstanding.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {summary.upcoming.slice(0, 7).map((u) => (
                <li key={u.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <Link href={`/admin/purchases/${u.id}`} className="font-mono text-xs text-indigo-600 hover:underline">{u.number}</Link>
                    <span className="block text-slate-700 truncate">{u.supplier.nameEn}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block tabular-nums font-semibold">{fmt3(u.outstanding)}</span>
                    <span className={`block text-xs ${u.daysOverdue > 0 ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                      {u.daysOverdue > 0 ? `${u.daysOverdue}d overdue` : fmtDate(u.dueDate)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-card">
          <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">This month</p>
          {summary ? (
            <table className="admin-table">
              <tbody>
                <tr><td className="text-sm text-slate-600">Purchases ({summary.month.orders} orders)</td><td className="text-right tabular-nums font-semibold">{fmt3(summary.month.purchases)}</td></tr>
                <tr><td className="text-sm text-slate-600">· of which input VAT</td><td className="text-right tabular-nums text-slate-500">{fmt3(summary.month.purchaseVat)}</td></tr>
                <tr><td className="text-sm text-slate-600">Paid to suppliers ({summary.month.paymentsCount})</td><td className="text-right tabular-nums font-semibold">{fmt3(summary.month.payments)}</td></tr>
                <tr><td className="text-sm text-slate-600">Returned to suppliers ({summary.month.returnsCount})</td><td className="text-right tabular-nums">{fmt3(summary.month.returns)}</td></tr>
                {summary.month.refunds > 0 && <tr><td className="text-sm text-slate-600">Refunds received</td><td className="text-right tabular-nums">{fmt3(summary.month.refunds)}</td></tr>}
                <tr>
                  <td className="text-sm text-slate-600">Tasks open / overdue</td>
                  <td className="text-right tabular-nums">
                    <button onClick={() => go("tasks")} className="hover:underline">
                      {summary.tasks.open} / <span className={summary.tasks.overdue ? "text-rose-600 font-semibold" : ""}>{summary.tasks.overdue}</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="flex justify-center py-8"><span className="spinner" /></div>
          )}
          {summary && summary.awaitingDelivery.lateOrders.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 text-xs">
              <p className="font-semibold text-rose-600 mb-1">Late deliveries</p>
              {summary.awaitingDelivery.lateOrders.map((o) => (
                <Link key={o.id} href={`/admin/purchases/${o.id}`} className="block text-slate-600 hover:text-indigo-600">
                  {o.number} · {o.supplier.nameEn} · expected {fmtDate(o.expectedDate)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <TabBar<Tab>
        tabs={[
          { id: "suppliers", label: "Suppliers", icon: LuHandshake, count: summary?.suppliers.active },
          { id: "payables", label: "Payables", icon: LuCalendarClock, count: summary?.overdue.count || null },
          { id: "payments", label: "Payments", icon: LuWallet },
          { id: "tasks", label: "Tasks", icon: LuListTodo, count: summary?.tasks.open },
        ]}
        value={tab}
        onChange={go}
      />

      {tab === "suppliers" && <SuppliersTab perms={perms} reloadKey={reloadKey} onChanged={changed} />}
      {tab === "payables" && <PayablesTab perms={perms} reloadKey={reloadKey} onChanged={changed} />}
      {tab === "payments" && <PaymentsTable canVoid={perms.pay} reloadKey={reloadKey} onChanged={changed} />}
      {tab === "tasks" && <TaskList canManage={perms.manageSuppliers || perms.managePurchases} onChanged={loadSummary} />}

      <SupplierFormModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSaved={(s) => {
          setNewOpen(false);
          router.push(`/admin/suppliers/${s.id}`);
        }}
      />
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} onDone={changed} />
    </div>
  );
}
