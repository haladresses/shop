"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuClipboardList, LuHandshake, LuMessageCircle, LuPlus, LuSearch, LuStar, LuWallet } from "react-icons/lu";
import PaymentModal from "./PaymentModal";
import { BalanceText, Empty, PayBadge, Pager, StatusBadge, api, fmt3, fmtDate, whatsappLink, type PurchasingPerms } from "./shared";
import type { PoRow } from "./types";

export type SupplierRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  category: string | null;
  contactPerson: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  paymentTermsDays: number;
  creditLimit: number | null;
  rating: number | null;
  isActive: boolean;
  balance: number;
  purchased: number;
  paid: number;
  overdue: number;
  overdueCount: number;
  maxDaysOverdue: number;
  nextDueDate: string | null;
  openOrders: number;
  ordersCount: number;
  lastOrderDate: string | null;
  overCreditLimit: boolean;
};

type PayTarget = { supplier: { id: string; nameEn: string; code: string; balance: number }; purchaseOrderId?: string } | null;

export function SuppliersTab({ perms, reloadKey, onChanged }: { perms: PurchasingPerms; reloadKey: number; onChanged: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [totals, setTotals] = useState({ balance: 0, payable: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [pay, setPay] = useState<PayTarget>(null);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const p = new URLSearchParams({ status, sort, page: String(page), pageSize: "25" });
      if (search.trim()) p.set("search", search.trim());
      if (filter) p.set("filter", filter);
      api<{ items: SupplierRow[]; meta: typeof meta; totals: typeof totals }>(`/api/suppliers?${p}`).then((d) => {
        if (d.success && d.data) {
          setRows(d.data.items);
          setMeta(d.data.meta);
          setTotals(d.data.totals);
        }
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [search, status, filter, sort, page, reloadKey]);

  const reset = (fn: () => void) => {
    setPage(1);
    fn();
  };

  return (
    <div className="admin-card">
      <div className="p-3 border-b border-slate-100 grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_170px_170px]">
        <div className="relative">
          <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => reset(() => setSearch(e.target.value))} placeholder="Name, code, phone, category, VAT number" className="admin-input !py-2 !pl-9 text-sm" />
        </div>
        <select value={status} onChange={(e) => reset(() => setStatus(e.target.value))} className="admin-input admin-select !py-2 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <select value={filter} onChange={(e) => reset(() => setFilter(e.target.value))} className="admin-input admin-select !py-2 text-sm">
          <option value="">Any balance</option>
          <option value="owing">We owe them</option>
          <option value="overdue">Overdue</option>
          <option value="credit">We have credit</option>
        </select>
        <select value={sort} onChange={(e) => reset(() => setSort(e.target.value))} className="admin-input admin-select !py-2 text-sm">
          <option value="name">Sort: name</option>
          <option value="balance">Sort: balance owed</option>
          <option value="overdue">Sort: overdue</option>
          <option value="recent">Sort: last order</option>
        </select>
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-14"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <Empty icon={LuHandshake} title="No suppliers found" />
      ) : (
        <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
          <table className="admin-table min-w-[980px]">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>Terms</th>
                <th className="text-right">Open orders</th>
                <th>Last order</th>
                <th className="text-right">Overdue</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const wa = whatsappLink(s.whatsapp || s.phone);
                return (
                  <tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/admin/suppliers/${s.id}`)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/suppliers/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-800 hover:text-indigo-600">{s.nameEn}</Link>
                        {!s.isActive && <span className="text-xs text-slate-400">Inactive</span>}
                        {s.rating ? (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-500"><LuStar size={11} className="fill-amber-400" />{s.rating}</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-400">
                        {s.code}
                        {s.nameAr && <span dir="rtl"> · {s.nameAr}</span>}
                        {s.category && ` · ${s.category}`}
                      </p>
                    </td>
                    <td className="text-sm">
                      <p className="text-slate-700">{s.contactPerson || "-"}</p>
                      <p className="text-xs text-slate-400">{s.phone || s.email || ""}</p>
                    </td>
                    <td className="text-sm text-slate-600 whitespace-nowrap">{s.paymentTermsDays ? `Net ${s.paymentTermsDays}` : "Cash"}</td>
                    <td className="text-right tabular-nums">{s.openOrders || "-"}</td>
                    <td className="text-sm text-slate-500 whitespace-nowrap">{fmtDate(s.lastOrderDate)}</td>
                    <td className="text-right">
                      {s.overdue > 0.0005 ? (
                        <span className="tabular-nums font-semibold text-rose-600">
                          {fmt3(s.overdue)}
                          <span className="block text-[11px] font-normal">{s.maxDaysOverdue}d late</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="text-right">
                      <BalanceText value={s.balance} />
                      {s.overCreditLimit && <span className="block text-[11px] text-rose-600">over credit limit</span>}
                      {s.balance < -0.0005 && <span className="block text-[11px] text-emerald-600">credit</span>}
                    </td>
                    <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {perms.managePurchases && s.isActive && (
                        <Link href={`/admin/purchases/new?supplierId=${s.id}`} className="p-1.5 inline-flex text-slate-400 hover:text-indigo-600" title="New purchase order">
                          <LuClipboardList size={16} />
                        </Link>
                      )}
                      {perms.pay && (
                        <button onClick={() => setPay({ supplier: { id: s.id, nameEn: s.nameEn, code: s.code, balance: s.balance } })} className="p-1.5 inline-flex text-slate-400 hover:text-emerald-600" title="Record payment">
                          <LuWallet size={16} />
                        </button>
                      )}
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener" className="p-1.5 inline-flex text-slate-400 hover:text-emerald-600" title="WhatsApp">
                          <LuMessageCircle size={16} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-right text-sm font-semibold text-slate-600">{meta.total} supplier{meta.total === 1 ? "" : "s"}</td>
                <td className="text-right tabular-nums font-semibold text-rose-600">{totals.overdue > 0 ? fmt3(totals.overdue) : "-"}</td>
                <td className="text-right"><BalanceText value={totals.balance} /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={meta.totalPages} onPage={setPage} />
      <PaymentModal open={!!pay} onClose={() => setPay(null)} supplier={pay?.supplier ?? null} purchaseOrderId={pay?.purchaseOrderId} onDone={onChanged} />
    </div>
  );
}

/** Open payables — every placed order not fully paid, soonest due first. */
export function PayablesTab({ perms, reloadKey, onChanged }: { perms: PurchasingPerms; reloadKey: number; onChanged: () => void }) {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PoRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [pay, setPay] = useState<PayTarget>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ status: "all", payment: overdueOnly ? "overdue" : "open", page: String(page), pageSize: "50" });
    api<{ items: PoRow[]; meta: typeof meta }>(`/api/purchases?${p}`).then((d) => {
      if (d.success && d.data) {
        setRows(d.data.items);
        setMeta(d.data.meta);
      }
      setLoading(false);
    });
  }, [overdueOnly, page, reloadKey]);

  const openPay = async (r: PoRow) => {
    if (!r.supplier) return;
    let bal = balances[r.supplier.id];
    if (bal === undefined) {
      const d = await api<{ balance: { balance: number } }>(`/api/suppliers/${r.supplier.id}`);
      bal = d.data?.balance.balance ?? 0;
      setBalances((b) => ({ ...b, [r.supplier!.id]: bal }));
    }
    setPay({ supplier: { id: r.supplier.id, nameEn: r.supplier.nameEn, code: r.supplier.code, balance: bal }, purchaseOrderId: r.id });
  };

  const total = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="admin-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div className="flex gap-1.5">
          {[false, true].map((o) => (
            <button
              key={String(o)}
              onClick={() => {
                setPage(1);
                setOverdueOnly(o);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${overdueOnly === o ? (o ? "bg-rose-600 text-white" : "bg-slate-800 text-white") : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {o ? "Overdue only" : "All unpaid"}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          {meta.total} order{meta.total === 1 ? "" : "s"} · <span className="tabular-nums font-semibold text-slate-800">{fmt3(total)} OMR</span> on this page
        </p>
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-14"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <Empty icon={LuWallet} title={overdueOnly ? "Nothing overdue" : "Everything is paid"} />
      ) : (
        <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
          <table className="admin-table min-w-[880px]">
            <thead>
              <tr>
                <th>Due</th>
                <th>Order</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Outstanding</th>
                {perms.pay && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.overdue ? "bg-rose-50/40" : ""}>
                  <td className={`whitespace-nowrap text-sm ${r.overdue ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
                    {r.dueDate ? fmtDate(r.dueDate) : "On delivery"}
                    {r.overdue && <span className="block text-[11px] font-normal">{r.daysOverdue} days late</span>}
                  </td>
                  <td>
                    <Link href={`/admin/purchases/${r.id}`} className="font-mono text-indigo-600 hover:underline">{r.number}</Link>
                    {r.supplierReference && <p className="text-xs text-slate-400">Invoice {r.supplierReference}</p>}
                  </td>
                  <td>
                    {r.supplier && <Link href={`/admin/suppliers/${r.supplier.id}`} className="text-slate-800 hover:text-indigo-600">{r.supplier.nameEn}</Link>}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-right tabular-nums">{fmt3(r.total - r.returnedTotal)}</td>
                  <td className="text-right tabular-nums text-slate-500">{fmt3(r.amountPaid)}</td>
                  <td className="text-right">
                    <span className={`tabular-nums font-semibold ${r.overdue ? "text-rose-600" : "text-slate-800"}`}>{fmt3(r.outstanding)}</span>
                    <span className="block"><PayBadge status={r.paymentStatus} /></span>
                  </td>
                  {perms.pay && (
                    <td className="text-right">
                      <button onClick={() => openPay(r)} className="admin-btn admin-btn-secondary !py-1.5 text-xs"><LuPlus size={13} /> Pay</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={meta.totalPages} onPage={setPage} />
      <PaymentModal
        open={!!pay}
        onClose={() => setPay(null)}
        supplier={pay?.supplier ?? null}
        purchaseOrderId={pay?.purchaseOrderId}
        onDone={() => {
          setBalances({});
          onChanged();
        }}
      />
    </div>
  );
}
