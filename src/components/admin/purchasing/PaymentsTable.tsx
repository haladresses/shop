"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { LuArrowDownLeft, LuSearch, LuTrash2, LuWallet } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { Empty, Field, PAYMENT_METHOD_OPTIONS, Pager, api, fmt3, fmtDate, methodText, todayKey } from "./shared";

type PaymentRow = {
  id: string;
  number: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  note: string | null;
  supplier: { id: string; code: string; nameEn: string; nameAr: string | null };
  createdBy: string;
  allocated: number;
  allocations: { amount: number; purchaseOrder: { id: string; number: string } }[];
};

/**
 * Payments to suppliers (and refunds received back, shown as negative rows).
 * Voiding a payment puts the orders it paid back to unpaid.
 */
export function PaymentsTable({
  supplierId,
  canVoid,
  reloadKey = 0,
  onChanged,
}: {
  supplierId?: string;
  canVoid: boolean;
  reloadKey?: number;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [sum, setSum] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState<PaymentRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (supplierId) p.set("supplierId", supplierId);
    if (search.trim()) p.set("search", search.trim());
    if (method) p.set("method", method);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api<{ items: PaymentRow[]; meta: typeof meta; sum: number }>(`/api/supplier-payments?${p}`).then((d) => {
      if (d.success && d.data) {
        setRows(d.data.items);
        setMeta(d.data.meta);
        setSum(d.data.sum);
      }
      setLoading(false);
    });
  }, [page, supplierId, search, method, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load, reloadKey]);

  const doVoid = async () => {
    if (!voiding) return;
    const d = await api(`/api/supplier-payments/${voiding.id}`, { method: "DELETE" });
    if (!d.success) return void toast.error(d.error || "Could not void the payment");
    toast.success(`${voiding.number} voided`);
    setVoiding(null);
    load();
    onChanged?.();
  };

  return (
    <div className="admin-card">
      <div className="p-3 border-b border-slate-100 grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_auto]">
        <div className="relative">
          <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder={supplierId ? "Payment no. or reference" : "Payment no., reference or supplier"} className="admin-input !py-2 !pl-9 text-sm" />
        </div>
        <select value={method} onChange={(e) => { setPage(1); setMethod(e.target.value); }} className="admin-input admin-select !py-2 text-sm">
          <option value="">All methods</option>
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.en}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className="admin-input !py-2 text-sm !w-auto min-w-0" aria-label="From" />
          <span className="text-slate-400 text-sm">–</span>
          <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className="admin-input !py-2 text-sm !w-auto min-w-0" aria-label="To" />
        </div>
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-12"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <Empty icon={LuWallet} title="No payments recorded" />
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[820px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment</th>
                {!supplierId && <th>Supplier</th>}
                <th>Method</th>
                <th>Applied to</th>
                <th className="text-right">Amount</th>
                {canVoid && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const refund = p.amount < 0;
                const credit = !refund ? Math.max(0, p.amount - p.allocated) : 0;
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-sm">{fmtDate(p.paidAt)}</td>
                    <td>
                      <p className="font-mono text-sm text-slate-800">{p.number}</p>
                      <p className="text-xs text-slate-400">{[p.reference && `ref ${p.reference}`, p.createdBy].filter(Boolean).join(" · ")}</p>
                    </td>
                    {!supplierId && (
                      <td>
                        <Link href={`/admin/suppliers/${p.supplier.id}`} className="font-medium text-slate-800 hover:text-indigo-600">{p.supplier.nameEn}</Link>
                        <p className="text-xs text-slate-400">{p.supplier.code}</p>
                      </td>
                    )}
                    <td className="text-sm">
                      {refund && <span className="inline-flex items-center gap-1 text-emerald-700 font-medium mr-1"><LuArrowDownLeft size={13} /> Refund ·</span>}
                      {methodText(p.method)}
                    </td>
                    <td className="text-xs text-slate-600 max-w-[280px]">
                      {refund ? (
                        <span className="text-slate-500">{p.note || "Money received back"}</span>
                      ) : (
                        <>
                          {p.allocations.map((a) => (
                            <Link key={a.purchaseOrder.id} href={`/admin/purchases/${a.purchaseOrder.id}`} className="inline-block mr-2 text-indigo-600 hover:underline">
                              {a.purchaseOrder.number} ({fmt3(a.amount)})
                            </Link>
                          ))}
                          {credit > 0.0005 && <span className="text-emerald-700">On account {fmt3(credit)}</span>}
                          {p.note && <span className="block text-slate-400 truncate">{p.note}</span>}
                        </>
                      )}
                    </td>
                    <td className={`text-right tabular-nums font-semibold ${refund ? "text-emerald-700" : "text-slate-800"}`}>{refund ? `−${fmt3(-p.amount)}` : fmt3(p.amount)}</td>
                    {canVoid && (
                      <td>
                        <button onClick={() => setVoiding(p)} className="p-1.5 text-slate-400 hover:text-rose-600" title="Void (entered by mistake)">
                          <LuTrash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={supplierId ? 4 : 5} className="text-right text-sm font-semibold text-slate-600">
                  Net paid · {meta.total} record{meta.total === 1 ? "" : "s"}
                </td>
                <td className="text-right tabular-nums font-bold">{fmt3(sum)}</td>
                {canVoid && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={meta.totalPages} onPage={setPage} />

      <AdminModal
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title={`Void ${voiding?.number ?? ""}?`}
        className="!max-w-md"
        footer={
          <>
            <button onClick={() => setVoiding(null)} className="admin-btn admin-btn-secondary">Keep</button>
            <button onClick={doVoid} className="admin-btn admin-btn-danger">Void payment</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {voiding && voiding.amount < 0
            ? `The refund of ${fmt3(-voiding.amount)} OMR from ${voiding.supplier.nameEn} is removed and the supplier balance goes back accordingly.`
            : `The ${fmt3(voiding?.amount ?? 0)} OMR payment is removed and the orders it paid become unpaid again. Use this only for a payment entered by mistake.`}
        </p>
      </AdminModal>
    </div>
  );
}

/** Money a supplier paid back to us (e.g. for returned goods credited earlier). */
export function RefundModal({
  open,
  supplier,
  onClose,
  onDone,
}: {
  open: boolean;
  supplier: { id: string; nameEn: string; balance: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayKey());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(supplier.balance < -0.0005 ? (-supplier.balance).toFixed(3) : "");
    setMethod("BANK_TRANSFER");
    setReference("");
    setReceivedAt(todayKey());
    setNote("");
    setErr("");
  }, [open, supplier.balance]);

  const submit = async () => {
    const v = parseFloat(amount) || 0;
    if (v <= 0) return setErr("Enter the amount received.");
    setSaving(true);
    const d = await api<{ number: string }>(`/api/suppliers/${supplier.id}/refunds`, {
      body: { amount: v, method, reference: reference || null, receivedAt, note: note || null },
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not record the refund.");
    toast.success(`Refund ${d.data.number} recorded`);
    onDone();
    onClose();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Refund received from ${supplier.nameEn}`}
      className="!max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="admin-btn admin-btn-primary">{saving ? "Saving…" : "Record refund"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Money the supplier paid back to you — for example for goods returned and credited earlier, or an overpayment.
          {supplier.balance < -0.0005 && ` You currently have ${fmt3(-supplier.balance)} OMR credit with them.`}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Amount (OMR)">
            <input type="number" min="0" step="0.001" className="admin-input text-right font-semibold" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Received on">
            <input type="date" className="admin-input" value={receivedAt} max={todayKey()} onChange={(e) => setReceivedAt(e.target.value)} />
          </Field>
          <Field label="Method">
            <select className="admin-input admin-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.en}</option>
              ))}
            </select>
          </Field>
          <Field label="Reference">
            <input className="admin-input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}
