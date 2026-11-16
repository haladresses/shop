"use client";
import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  LuArrowDownLeft,
  LuChevronLeft,
  LuClipboardList,
  LuFileText,
  LuGlobe,
  LuLayoutDashboard,
  LuListTodo,
  LuMail,
  LuMessageCircle,
  LuPencil,
  LuPhone,
  LuPrinter,
  LuStar,
  LuTrash2,
  LuTriangleAlert,
  LuUndo2,
  LuWallet,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import PaymentModal from "@/components/admin/purchasing/PaymentModal";
import { PaymentsTable, RefundModal } from "@/components/admin/purchasing/PaymentsTable";
import { DebitNoteDoc, type PrintableReturn } from "@/components/admin/purchasing/PrintDocs";
import StatementView from "@/components/admin/purchasing/StatementView";
import SupplierFormModal, { supplierToForm } from "@/components/admin/purchasing/SupplierFormModal";
import { TaskList } from "@/components/admin/purchasing/Tasks";
import { BalanceText, Empty, Kpi, PayBadge, StatusBadge, TabBar, api, fmt3, fmtDate, methodText, useDocHeader, usePurchasingPerms, whatsappLink } from "@/components/admin/purchasing/shared";
import type { PoRow } from "@/components/admin/purchasing/types";

type Supplier = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  category: string | null;
  contactPerson: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  vatNumber: string | null;
  crNumber: string | null;
  paymentTermsDays: number;
  creditLimit: number | null;
  openingBalance: number;
  bankName: string | null;
  bankAccountName: string | null;
  iban: string | null;
  rating: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

type ReturnRow = {
  id: string;
  number: string;
  returnedAt: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  reason: string | null;
  units: number;
  items: PrintableReturn["items"];
  purchaseOrder: { id: string; number: string } | null;
  settlement: "CREDIT" | "REFUND";
};

type Profile = {
  supplier: Supplier;
  balance: { opening: number; purchased: number; returned: number; paid: number; balance: number };
  stats: {
    purchasedTotal: number;
    ordersCount: number;
    openOrders: number;
    drafts: number;
    lastOrderDate: string | null;
    avgLeadTimeDays: number | null;
    onTimeRate: number | null;
    unitsReceived: number;
    overdue: number;
    overdueCount: number;
    returnedTotal: number;
    overCreditLimit: boolean;
  };
  orders: PoRow[];
  payments: { id: string; number: string; amount: number; method: string; paidAt: string; isRefund: boolean }[];
  returns: ReturnRow[];
  topProducts: { productId: string | null; nameEn: string; nameAr: string | null; imageUrl: string | null; units: number; spent: number; lastUnitCost: number; lastDate: string | null }[];
};

type Tab = "overview" | "orders" | "payments" | "returns" | "statement" | "tasks" | "details";
const TABS: Tab[] = ["overview", "orders", "payments", "returns", "statement", "tasks", "details"];

export default function SupplierProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><span className="spinner" /></div>}>
      <SupplierProfile id={id} />
    </Suspense>
  );
}

function SupplierProfile({ id }: { id: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const perms = usePurchasingPerms();
  const header = useDocHeader();
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(TABS.includes(sp.get("tab") as Tab) ? (sp.get("tab") as Tab) : "overview");
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printRet, setPrintRet] = useState<ReturnRow | null>(null);

  const load = useCallback(() => {
    api<Profile>(`/api/suppliers/${id}`).then((d) => {
      if (d.success && d.data) {
        setData(d.data);
        setError("");
      } else setError(d.error || "Could not load the supplier.");
    });
  }, [id]);
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const changed = () => setReloadKey((k) => k + 1);
  const go = (t: Tab) => {
    setTab(t);
    router.replace(`/admin/suppliers/${id}?tab=${t}`, { scroll: false });
  };

  if (error) {
    return (
      <div className="admin-card p-10 text-center">
        <p className="text-slate-600">{error}</p>
        <Link href="/admin/suppliers" className="admin-btn admin-btn-secondary mt-4">Back to suppliers</Link>
      </div>
    );
  }
  if (!data) return <div className="flex justify-center py-16"><span className="spinner" /></div>;

  const s = data.supplier;
  const b = data.balance;
  const wa = whatsappLink(s.whatsapp || s.phone, `Hello ${s.contactPerson || s.nameEn},`);

  const toggleActive = async () => {
    const d = await api(`/api/suppliers/${s.id}`, { method: "PATCH", body: { isActive: !s.isActive } });
    if (!d.success) return void toast.error(d.error || "Could not update");
    toast.success(s.isActive ? "Supplier deactivated" : "Supplier reactivated");
    changed();
  };

  const remove = async () => {
    const d = await api(`/api/suppliers/${s.id}`, { method: "DELETE" });
    if (!d.success) {
      setDeleteOpen(false);
      return void toast.error(d.error || "Could not delete");
    }
    toast.success("Supplier deleted");
    router.push("/admin/suppliers");
  };

  const printReturn = (r: ReturnRow) => {
    setPrintRet(r);
    setTimeout(() => printArea("supplier-dn", { page: "a4", title: r.number }), 60);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/suppliers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
            <LuChevronLeft size={16} /> Suppliers
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-800">{s.nameEn}</h1>
            {s.nameAr && <span className="text-lg text-slate-500" dir="rtl">{s.nameAr}</span>}
            {!s.isActive && <span className="rounded-full bg-slate-100 text-slate-500 text-xs font-semibold px-2.5 py-0.5">Inactive</span>}
          </div>
          <p className="text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
            <span className="font-mono">{s.code}</span>
            {s.category && <span>· {s.category}</span>}
            <span>· {s.paymentTermsDays ? `Net ${s.paymentTermsDays} days` : "Cash on delivery"}</span>
            {s.rating ? (
              <span className="inline-flex items-center gap-0.5 text-amber-500">
                ·{" "}
                {Array.from({ length: 5 }, (_, i) => (
                  <LuStar key={i} size={13} className={i < (s.rating ?? 0) ? "fill-amber-400" : "text-slate-200"} />
                ))}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {s.phone && <a href={`tel:${s.phone}`} className="admin-btn admin-btn-secondary !py-1.5 text-xs"><LuPhone size={13} /> {s.phone}</a>}
            {wa && <a href={wa} target="_blank" rel="noopener" className="admin-btn admin-btn-secondary !py-1.5 text-xs"><LuMessageCircle size={13} /> WhatsApp</a>}
            {s.email && <a href={`mailto:${s.email}`} className="admin-btn admin-btn-secondary !py-1.5 text-xs"><LuMail size={13} /> Email</a>}
            {s.website && (
              <a href={/^https?:\/\//.test(s.website) ? s.website : `https://${s.website}`} target="_blank" rel="noopener" className="admin-btn admin-btn-secondary !py-1.5 text-xs">
                <LuGlobe size={13} /> Website
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className={`rounded-2xl px-5 py-3 text-right ${b.balance > 0.0005 ? "bg-rose-50" : b.balance < -0.0005 ? "bg-emerald-50" : "bg-slate-50"}`}>
            <p className="text-xs text-slate-500">{b.balance > 0.0005 ? "We owe" : b.balance < -0.0005 ? "Credit in our favour" : "Balance"}</p>
            <p className="text-2xl font-bold tabular-nums">
              <BalanceText value={b.balance} /> <span className="text-sm font-normal text-slate-500">OMR</span>
            </p>
            {s.creditLimit ? <p className="text-[11px] text-slate-500">Credit limit {fmt3(s.creditLimit)}</p> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {perms.managePurchases && s.isActive && (
              <Link href={`/admin/purchases/new?supplierId=${s.id}`} className="admin-btn admin-btn-primary"><LuClipboardList size={15} /> New order</Link>
            )}
            {perms.pay && <button onClick={() => setPayOpen(true)} className="admin-btn admin-btn-secondary"><LuWallet size={15} /> Pay</button>}
            {perms.pay && <button onClick={() => setRefundOpen(true)} className="admin-btn admin-btn-secondary"><LuArrowDownLeft size={15} /> Refund received</button>}
            {perms.receive && <Link href={`/admin/supplier-returns/new?supplierId=${s.id}`} className="admin-btn admin-btn-secondary"><LuUndo2 size={15} /> Return goods</Link>}
          </div>
        </div>
      </div>

      {data.stats.overCreditLimit && (
        <div className="rounded-2xl bg-rose-50 text-rose-800 px-4 py-3 text-sm flex items-center gap-2">
          <LuTriangleAlert size={16} /> The balance owed is over this supplier&apos;s credit limit of {fmt3(s.creditLimit)} OMR.
        </div>
      )}
      {data.stats.overdue > 0.0005 && (
        <div className="rounded-2xl bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-center gap-2">
          <LuTriangleAlert size={16} /> {fmt3(data.stats.overdue)} OMR is overdue on {data.stats.overdueCount} order{data.stats.overdueCount === 1 ? "" : "s"}.
        </div>
      )}

      <TabBar<Tab>
        tabs={[
          { id: "overview", label: "Overview", icon: LuLayoutDashboard },
          { id: "orders", label: "Purchase orders", icon: LuClipboardList, count: data.orders.length },
          { id: "payments", label: "Payments", icon: LuWallet },
          { id: "returns", label: "Returns", icon: LuUndo2, count: data.returns.length },
          { id: "statement", label: "Statement", icon: LuFileText },
          { id: "tasks", label: "Tasks", icon: LuListTodo },
          { id: "details", label: "Details", icon: LuPencil },
        ]}
        value={tab}
        onChange={go}
      />

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={LuClipboardList} label="Purchased (all time)" value={fmt3(data.stats.purchasedTotal)} sub={`${data.stats.ordersCount} orders · ${data.stats.unitsReceived} units received`} />
            <Kpi icon={LuWallet} label="Paid" value={fmt3(b.paid)} sub={b.opening ? `Opening balance ${fmt3(b.opening)}` : `${data.stats.openOrders} order(s) awaiting delivery`} tone="good" />
            <Kpi icon={LuUndo2} label="Returned" value={fmt3(b.returned)} sub={`${data.returns.length} debit note(s)`} />
            <Kpi
              icon={LuFileText}
              label="Delivery performance"
              value={data.stats.avgLeadTimeDays != null ? `${data.stats.avgLeadTimeDays} days` : "-"}
              sub={data.stats.onTimeRate != null ? `${data.stats.onTimeRate}% on time` : "Average lead time"}
              tone="info"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="admin-card">
              <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Most bought</p>
              {data.topProducts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">Nothing bought yet.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="text-right">Units</th>
                      <th className="text-right">Spent</th>
                      <th className="text-right">Last price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p) => (
                      <tr key={`${p.productId}-${p.nameEn}`}>
                        <td>
                          {p.productId ? <Link href={`/admin/products/${p.productId}`} className="font-medium text-slate-800 hover:text-indigo-600">{p.nameEn}</Link> : <span className="text-slate-700">{p.nameEn}</span>}
                        </td>
                        <td className="text-right tabular-nums">{p.units}</td>
                        <td className="text-right tabular-nums">{fmt3(p.spent)}</td>
                        <td className="text-right tabular-nums text-slate-600">
                          {fmt3(p.lastUnitCost)}
                          <span className="block text-[11px] text-slate-400">{fmtDate(p.lastDate)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="space-y-5">
              <div className="admin-card">
                <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Recent orders</p>
                <OrdersTable rows={data.orders.slice(0, 6)} compact />
              </div>
              <div className="admin-card">
                <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Recent payments</p>
                {data.payments.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-slate-400 text-center">No payments yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {data.payments.slice(0, 5).map((p) => (
                      <li key={p.id} className="px-4 py-2.5 flex justify-between gap-3">
                        <span>
                          <span className="font-mono text-xs">{p.number}</span>
                          <span className="block text-xs text-slate-500">{fmtDate(p.paidAt)} · {p.isRefund ? "Refund received · " : ""}{methodText(p.method)}</span>
                        </span>
                        <span className={`tabular-nums font-semibold ${p.isRefund ? "text-emerald-700" : ""}`}>{p.isRefund ? `−${fmt3(-p.amount)}` : fmt3(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="admin-card">
          <OrdersTable rows={data.orders} />
        </div>
      )}

      {tab === "payments" && <PaymentsTable supplierId={s.id} canVoid={perms.pay} reloadKey={reloadKey} onChanged={changed} />}

      {tab === "returns" && (
        <div className="admin-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="font-semibold text-slate-700 text-sm">Goods returned to {s.nameEn}</p>
            {perms.receive && <Link href={`/admin/supplier-returns/new?supplierId=${s.id}`} className="admin-btn admin-btn-secondary !py-1.5 text-xs"><LuUndo2 size={13} /> New return</Link>}
          </div>
          {data.returns.length === 0 ? (
            <Empty icon={LuUndo2} title="No returns to this supplier" />
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Debit note</th>
                    <th>Date</th>
                    <th>Order</th>
                    <th className="text-right">Units</th>
                    <th className="text-right">Total</th>
                    <th>Settlement</th>
                    <th>Reason</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.returns.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-sm">{r.number}</td>
                      <td className="text-sm whitespace-nowrap">{fmtDate(r.returnedAt)}</td>
                      <td>{r.purchaseOrder ? <Link href={`/admin/purchases/${r.purchaseOrder.id}`} className="font-mono text-xs text-indigo-600 hover:underline">{r.purchaseOrder.number}</Link> : <span className="text-xs text-slate-400">Not on an order</span>}</td>
                      <td className="text-right tabular-nums">{r.units}</td>
                      <td className="text-right tabular-nums font-semibold">{fmt3(r.total)}</td>
                      <td className="text-sm">{r.settlement === "REFUND" ? <span className="text-emerald-700">Refunded</span> : "Credit"}</td>
                      <td className="text-sm text-slate-500 max-w-[220px] truncate">{r.reason || "-"}</td>
                      <td><button onClick={() => printReturn(r)} className="p-1.5 text-slate-400 hover:text-slate-700" title="Print debit note"><LuPrinter size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "statement" && <StatementView supplierId={s.id} />}

      {tab === "tasks" && (
        <TaskList supplierId={s.id} supplierForNew={{ id: s.id, nameEn: s.nameEn, code: s.code }} canManage={perms.manageSuppliers || perms.managePurchases} />
      )}

      {tab === "details" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="admin-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-700">Supplier details</p>
              {perms.manageSuppliers && (
                <button onClick={() => setEditOpen(true)} className="admin-btn admin-btn-secondary !py-1.5 text-sm"><LuPencil size={14} /> Edit</button>
              )}
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Detail label="Contact person" value={s.contactPerson} />
              <Detail label="Phone" value={s.phone} />
              <Detail label="WhatsApp" value={s.whatsapp} />
              <Detail label="Email" value={s.email} />
              <Detail label="Website" value={s.website} />
              <Detail label="Address" value={[s.address, s.city, s.country].filter(Boolean).join(", ")} />
              <Detail label="VAT number" value={s.vatNumber} />
              <Detail label="CR number" value={s.crNumber} />
              <Detail label="Payment terms" value={s.paymentTermsDays ? `Net ${s.paymentTermsDays} days` : "Cash on delivery"} />
              <Detail label="Credit limit" value={s.creditLimit ? `${fmt3(s.creditLimit)} OMR` : null} />
              <Detail label="Opening balance" value={s.openingBalance ? `${fmt3(s.openingBalance)} OMR` : null} />
              <Detail label="Supplier since" value={fmtDate(s.createdAt)} />
            </dl>
            {s.notes && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{s.notes}</p>
              </div>
            )}
          </div>
          <div className="space-y-5">
            <div className="admin-card p-5">
              <p className="font-semibold text-slate-700 mb-3">Bank details</p>
              <dl className="grid gap-y-3 text-sm">
                <Detail label="Bank" value={s.bankName} />
                <Detail label="Account name" value={s.bankAccountName} />
                <Detail label="IBAN / account no." value={s.iban} mono />
              </dl>
            </div>
            {perms.manageSuppliers && (
              <div className="admin-card p-5 space-y-3">
                <p className="font-semibold text-slate-700">Status</p>
                <p className="text-sm text-slate-500">
                  {s.isActive
                    ? "Inactive suppliers are hidden from pickers and can't get new orders. Their history stays."
                    : "This supplier is inactive. Reactivate to order from them again."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={toggleActive} className="admin-btn admin-btn-secondary">{s.isActive ? "Deactivate" : "Reactivate"}</button>
                  <button onClick={() => setDeleteOpen(true)} className="admin-btn admin-btn-danger"><LuTrash2 size={14} /> Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <SupplierFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={supplierToForm(s)}
        onSaved={() => {
          setEditOpen(false);
          changed();
        }}
      />
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} supplier={{ id: s.id, nameEn: s.nameEn, code: s.code, balance: b.balance }} onDone={changed} />
      <RefundModal open={refundOpen} supplier={{ id: s.id, nameEn: s.nameEn, balance: b.balance }} onClose={() => setRefundOpen(false)} onDone={changed} />
      <AdminModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${s.nameEn}?`}
        className="!max-w-md"
        footer={
          <>
            <button onClick={() => setDeleteOpen(false)} className="admin-btn admin-btn-secondary">Keep</button>
            <button onClick={remove} className="admin-btn admin-btn-danger">Delete</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Only a supplier with no orders, payments or returns can be deleted. Otherwise deactivate it to keep its history.</p>
      </AdminModal>

      {printRet && (
        <PrintArea id="supplier-dn">
          <DebitNoteDoc
            header={header}
            ret={{
              number: printRet.number,
              returnedAt: printRet.returnedAt,
              subtotal: printRet.subtotal,
              taxTotal: printRet.taxTotal,
              total: printRet.total,
              reason: printRet.reason,
              settlement: printRet.settlement,
              purchaseOrder: printRet.purchaseOrder,
              items: printRet.items,
              supplier: s,
            }}
          />
        </PrintArea>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-slate-800 ${mono ? "font-mono" : ""}`}>{value || <span className="text-slate-300">-</span>}</dd>
    </div>
  );
}

function OrdersTable({ rows, compact }: { rows: PoRow[]; compact?: boolean }) {
  const router = useRouter();
  if (rows.length === 0) return <p className="px-4 py-6 text-sm text-slate-400 text-center">No purchase orders yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className={`admin-table ${compact ? "" : "min-w-[820px]"}`}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Status</th>
            {!compact && <th>Delivery</th>}
            <th className="text-right">Total</th>
            <th className="text-right">Outstanding</th>
            {!compact && <th>Due</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer" onClick={() => router.push(`/admin/purchases/${r.id}`)}>
              <td>
                <span className="font-mono text-sm text-indigo-600">{r.number}</span>
                <span className="block text-xs text-slate-400">{fmtDate(r.orderDate)}{r.supplierReference && ` · inv ${r.supplierReference}`}</span>
              </td>
              <td><StatusBadge status={r.status} /></td>
              {!compact && <td className="text-sm tabular-nums">{r.unitsReceived}/{r.unitsOrdered}</td>}
              <td className="text-right tabular-nums">{fmt3(r.total)}</td>
              <td className="text-right">
                <span className={`tabular-nums font-semibold ${r.outstanding > 0.0005 ? (r.overdue ? "text-rose-600" : "") : "text-slate-300"}`}>{fmt3(r.outstanding)}</span>
                {compact && r.outstanding > 0.0005 && <span className="block"><PayBadge status={r.paymentStatus} overdue={r.overdue} days={r.daysOverdue} /></span>}
              </td>
              {!compact && (
                <td className={`text-sm ${r.overdue ? "text-rose-600 font-medium" : "text-slate-500"}`}>
                  {fmtDate(r.dueDate)}
                  {r.overdue && <span className="block text-[11px]">{r.daysOverdue}d late</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
