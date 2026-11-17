"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LuClipboardList, LuDownload, LuPlus, LuSearch, LuTruck } from "react-icons/lu";
import { Empty, PayBadge, Pager, StatusBadge, SupplierPicker, api, fmt3, fmtDate, usePurchasingPerms, type SupplierOption } from "@/components/admin/purchasing/shared";
import type { PoRow } from "@/components/admin/purchasing/types";

type ListData = {
  items: PoRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  counts: Record<string, number>;
  totals: { value: number; vat: number; outstanding: number };
};

const TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "DRAFT", label: "Drafts" },
  { id: "open", label: "Awaiting delivery" },
  { id: "PARTIALLY_RECEIVED", label: "Part received" },
  { id: "RECEIVED", label: "Received" },
  { id: "CANCELLED", label: "Cancelled" },
];

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><span className="spinner" /></div>}>
      <PurchaseOrders />
    </Suspense>
  );
}

function PurchaseOrders() {
  const router = useRouter();
  const sp = useSearchParams();
  const perms = usePurchasingPerms();
  const [status, setStatus] = useState(sp.get("status") || "all");
  const [payment, setPayment] = useState(sp.get("payment") || "");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [supplier, setSupplier] = useState<SupplierOption | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams({ status, page: String(page), pageSize: "25", ...extra });
      if (payment) p.set("payment", payment);
      if (search.trim()) p.set("search", search.trim());
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (supplier) p.set("supplierId", supplier.id);
      return p;
    },
    [status, payment, search, from, to, supplier, page],
  );

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api<ListData>(`/api/purchases?${query()}`).then((d) => {
        if (d.success && d.data) setData(d.data);
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const reset = (fn: () => void) => {
    setPage(1);
    fn();
  };

  const exportCsv = async () => {
    const d = await api<ListData>(`/api/purchases?${query({ page: "1", pageSize: "200" })}`);
    const rows = d.data?.items ?? [];
    const head = ["PO", "Status", "Supplier", "Order date", "Expected", "Due", "Supplier invoice", "Units ordered", "Units received", "VAT", "Total", "Paid", "Returned", "Outstanding", "Payment"];
    const cell = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [r.number, r.status, r.supplier?.nameEn, r.orderDate, r.expectedDate, r.dueDate, r.supplierReference, r.unitsOrdered, r.unitsReceived, r.taxTotal.toFixed(3), r.total.toFixed(3), r.amountPaid.toFixed(3), r.returnedTotal.toFixed(3), r.outstanding.toFixed(3), r.overdue ? "OVERDUE" : r.paymentStatus]
        .map(cell)
        .join(","),
    );
    const blob = new Blob([`﻿${[head.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `purchase-orders.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const counts = data?.counts ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Orders placed with suppliers, deliveries received into stock and what is still owed.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="admin-btn admin-btn-secondary"><LuDownload size={15} /> Export CSV</button>
          {perms.managePurchases && (
            <Link href="/admin/purchases/new" className="admin-btn admin-btn-primary"><LuPlus size={16} /> New purchase order</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Value (placed orders in view)" value={`${fmt3(data?.totals.value)} OMR`} />
        <Stat label="Input VAT" value={`${fmt3(data?.totals.vat)} OMR`} />
        <Stat label="Still to pay" value={`${fmt3(data?.totals.outstanding)} OMR`} tone={(data?.totals.outstanding ?? 0) > 0 ? "bad" : undefined} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => reset(() => setStatus(t.id))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium ${
              status === t.id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
            {counts[t.id] ? <span className={`rounded-full px-1.5 text-[11px] ${status === t.id ? "bg-white/20" : "bg-slate-100"}`}>{counts[t.id]}</span> : null}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
        <div className="relative">
          <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => reset(() => setSearch(e.target.value))} placeholder="PO, supplier invoice, supplier, item or barcode" className="admin-input !py-2 !pl-9 text-sm" />
        </div>
        <SupplierPicker value={supplier} onChange={(s) => reset(() => setSupplier(s))} placeholder="All suppliers" />
        <select value={payment} onChange={(e) => reset(() => setPayment(e.target.value))} className="admin-input admin-select !py-2 text-sm">
          <option value="">Any payment state</option>
          <option value="open">Not fully paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Part paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="admin-input !py-2 text-sm !w-auto min-w-0" aria-label="From" />
          <span className="text-slate-400 text-sm">–</span>
          <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} className="admin-input !py-2 text-sm !w-auto min-w-0" aria-label="To" />
        </div>
        {supplier && (
          <button onClick={() => reset(() => setSupplier(null))} className="text-xs text-indigo-600 hover:underline justify-self-start">Clear supplier</button>
        )}
      </div>

      <div className="admin-card">
        {loading && !data ? (
          <div className="flex justify-center py-14"><span className="spinner" /></div>
        ) : !data || data.items.length === 0 ? (
          <Empty icon={LuClipboardList} title="No purchase orders">
            {perms.managePurchases ? <Link href="/admin/purchases/new" className="text-indigo-600 hover:underline">Create the first one</Link> : null}
          </Empty>
        ) : (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="admin-table min-w-[960px]">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Delivery</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Outstanding</th>
                  <th>Payment</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => router.push(`/admin/purchases/${r.id}`)}>
                    <td>
                      <Link href={`/admin/purchases/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-medium text-indigo-600 hover:underline">{r.number}</Link>
                      <p className="text-xs text-slate-500">
                        {fmtDate(r.orderDate)}
                        {r.supplierReference && ` · invoice ${r.supplierReference}`}
                      </p>
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">{r.supplier?.nameEn}</p>
                      <p className="text-xs text-slate-400">{r.supplier?.code}</p>
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-sm">
                      <span className="tabular-nums">{r.unitsReceived}/{r.unitsOrdered}</span>
                      <span className="text-slate-400 text-xs"> units</span>
                      {r.lateDelivery && (
                        <span className="flex items-center gap-1 text-xs text-rose-600"><LuTruck size={12} /> late · expected {fmtDate(r.expectedDate)}</span>
                      )}
                      {!r.lateDelivery && r.expectedDate && ["ORDERED", "PARTIALLY_RECEIVED"].includes(r.status) && (
                        <span className="block text-xs text-slate-400">Expected {fmtDate(r.expectedDate)}</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{fmt3(r.total)}</td>
                    <td className={`text-right tabular-nums font-semibold ${r.outstanding > 0.0005 ? (r.overdue ? "text-rose-600" : "text-slate-800") : "text-slate-300"}`}>{fmt3(r.outstanding)}</td>
                    <td><PayBadge status={r.paymentStatus} overdue={r.overdue} days={r.daysOverdue} /></td>
                    <td className={`text-sm whitespace-nowrap ${r.overdue ? "text-rose-600 font-medium" : "text-slate-500"}`}>{fmtDate(r.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone === "bad" ? "text-rose-600" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
