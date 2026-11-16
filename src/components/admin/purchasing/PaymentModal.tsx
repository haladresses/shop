"use client";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import AdminModal from "@/components/admin/AdminModal";
import { BalanceText, Field, PAYMENT_METHOD_OPTIONS, SupplierPicker, api, fmt3, fmtDate, todayKey, type SupplierOption } from "./shared";

type OpenPo = {
  id: string;
  number: string;
  orderDate: string | null;
  dueDate: string | null;
  total: number;
  outstanding: number;
  overdue: boolean;
  daysOverdue: number;
  supplierReference: string | null;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Record a payment to a supplier. Settles their oldest open orders first by
 * default, or lets the user split it across chosen orders; anything left over
 * stays as credit on the supplier's account.
 */
export default function PaymentModal({
  open,
  onClose,
  supplier: fixedSupplier,
  purchaseOrderId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Pre-selected supplier (hides the picker). */
  supplier?: { id: string; nameEn: string; code?: string; balance?: number } | null;
  /** Pay this order (switches to manual allocation on it). */
  purchaseOrderId?: string | null;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<SupplierOption | null>(null);
  const supplierId = fixedSupplier?.id ?? picked?.id ?? "";
  const balance = fixedSupplier?.balance ?? picked?.balance ?? null;

  const [pos, setPos] = useState<OpenPo[]>([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayKey());
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setAmount("");
    setMethod("BANK_TRANSFER");
    setReference("");
    setPaidAt(todayKey());
    setNote("");
    setMode(purchaseOrderId ? "manual" : "auto");
    setAlloc({});
    setErr("");
  }, [open, purchaseOrderId]);

  useEffect(() => {
    if (!open || !supplierId) {
      setPos([]);
      return;
    }
    setLoadingPos(true);
    Promise.all([
      api<{ items: OpenPo[] }>(`/api/purchases?supplierId=${supplierId}&payment=unpaid&pageSize=200`),
      api<{ items: OpenPo[] }>(`/api/purchases?supplierId=${supplierId}&payment=partial&pageSize=200`),
    ]).then(([a, b]) => {
      const list = [...(a.data?.items ?? []), ...(b.data?.items ?? [])]
        .filter((p) => p.outstanding > 0.0005)
        .sort((x, y) => (x.dueDate ?? "9999").localeCompare(y.dueDate ?? "9999") || (x.orderDate ?? "").localeCompare(y.orderDate ?? ""));
      setPos(list);
      setLoadingPos(false);
      const preset = purchaseOrderId ? list.find((p) => p.id === purchaseOrderId) : null;
      if (preset) {
        setAmount(fmt3(preset.outstanding).replace(/,/g, ""));
        setAlloc({ [preset.id]: String(preset.outstanding) });
      } else if (!purchaseOrderId) {
        const due = r3(list.reduce((s, p) => s + p.outstanding, 0));
        const suggest = balance != null && balance > 0 ? balance : due;
        if (suggest > 0) setAmount(String(r3(suggest)));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierId, purchaseOrderId]);

  const amountNum = r3(parseFloat(amount) || 0);
  const totalOpen = r3(pos.reduce((s, p) => s + p.outstanding, 0));

  // What the automatic mode would do — shown as a preview.
  const autoPreview = useMemo(() => {
    let left = amountNum;
    const out: Record<string, number> = {};
    for (const p of pos) {
      if (left <= 0.0005) break;
      const take = r3(Math.min(left, p.outstanding));
      out[p.id] = take;
      left = r3(left - take);
    }
    return out;
  }, [pos, amountNum]);

  const allocated =
    mode === "auto"
      ? r3(Object.values(autoPreview).reduce((s, v) => s + v, 0))
      : r3(Object.values(alloc).reduce((s, v) => s + (parseFloat(v) || 0), 0));
  const credit = r3(amountNum - allocated);

  const fillOldest = () => {
    const next: Record<string, string> = {};
    Object.entries(autoPreview).forEach(([k, v]) => (next[k] = String(v)));
    setAlloc(next);
  };

  const submit = async () => {
    if (!supplierId) return setErr("Choose a supplier.");
    if (amountNum <= 0) return setErr("Enter the amount paid.");
    if (mode === "manual" && allocated > amountNum + 0.0005) return setErr("You applied more to orders than the payment amount.");
    for (const p of pos) {
      const v = parseFloat(alloc[p.id] || "0") || 0;
      if (mode === "manual" && v > p.outstanding + 0.0005) return setErr(`${p.number} only has ${fmt3(p.outstanding)} left to pay.`);
    }
    setSaving(true);
    setErr("");
    const d = await api<{ number: string; unallocated: number }>(`/api/suppliers/${supplierId}/payments`, {
      body: {
        amount: amountNum,
        method,
        reference: reference || null,
        paidAt,
        note: note || null,
        autoAllocate: mode === "auto",
        allocations:
          mode === "manual"
            ? Object.entries(alloc)
                .map(([purchaseOrderId, v]) => ({ purchaseOrderId, amount: r3(parseFloat(v) || 0) }))
                .filter((a) => a.amount > 0)
            : undefined,
      },
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not record the payment.");
    toast.success(`Payment ${d.data.number} recorded${d.data.unallocated > 0.0005 ? ` · ${fmt3(d.data.unallocated)} kept as credit` : ""}`);
    onDone();
    onClose();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Record supplier payment"
      className="!max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving || !supplierId || amountNum <= 0} className="admin-btn admin-btn-primary">
            {saving ? "Saving…" : `Pay ${fmt3(amountNum)} OMR`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {fixedSupplier ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-800">{fixedSupplier.nameEn}</p>
              {fixedSupplier.code && <p className="text-xs text-slate-500">{fixedSupplier.code}</p>}
            </div>
            {balance != null && (
              <div className="text-right">
                <p className="text-xs text-slate-500">Balance</p>
                <BalanceText value={balance} />
              </div>
            )}
          </div>
        ) : (
          <Field label="Supplier">
            <SupplierPicker value={picked} onChange={setPicked} />
          </Field>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Amount (OMR)">
            <input type="number" min="0" step="0.001" inputMode="decimal" className="admin-input text-right text-lg font-semibold" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date paid">
            <input type="date" className="admin-input" value={paidAt} max={todayKey()} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label="Method">
            <select className="admin-input admin-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.en}</option>
              ))}
            </select>
          </Field>
          <Field label={method === "CHEQUE" ? "Cheque number" : "Reference"}>
            <input className="admin-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "BANK_TRANSFER" ? "Transfer reference" : ""} />
          </Field>
        </div>

        {supplierId && (
          <div className="rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-700">
                Apply to orders <span className="text-slate-400 font-normal">· {pos.length} open · {fmt3(totalOpen)} OMR due</span>
              </p>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                {(["auto", "manual"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => { setMode(m); if (m === "manual" && Object.keys(alloc).length === 0) fillOldest(); }} className={`px-3 py-1.5 ${mode === m ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}>
                    {m === "auto" ? "Oldest first" : "Choose orders"}
                  </button>
                ))}
              </div>
            </div>
            {loadingPos ? (
              <p className="px-4 py-4 text-sm text-slate-400">Loading open orders…</p>
            ) : pos.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">No unpaid orders — the whole payment will be kept as credit (e.g. against the opening balance or as an advance).</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Due</th>
                      <th className="text-right">Outstanding</th>
                      <th className="text-right w-36">Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/admin/purchases/${p.id}`} className="font-medium text-indigo-600 hover:underline" target="_blank">{p.number}</Link>
                          {p.supplierReference && <p className="text-xs text-slate-400">Inv {p.supplierReference}</p>}
                        </td>
                        <td className={p.overdue ? "text-rose-600 font-medium" : "text-slate-600"}>
                          {fmtDate(p.dueDate)}
                          {p.overdue && <span className="block text-[11px]">{p.daysOverdue} days late</span>}
                        </td>
                        <td className="text-right tabular-nums">{fmt3(p.outstanding)}</td>
                        <td className="text-right">
                          {mode === "auto" ? (
                            <span className="tabular-nums text-slate-600">{autoPreview[p.id] ? fmt3(autoPreview[p.id]) : "—"}</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={alloc[p.id] ?? ""}
                                onChange={(e) => setAlloc({ ...alloc, [p.id]: e.target.value })}
                                className="admin-input !py-1 !w-24 text-right"
                              />
                              <button type="button" onClick={() => setAlloc({ ...alloc, [p.id]: String(p.outstanding) })} className="text-[11px] text-indigo-600 hover:underline">Full</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Applied <strong className="text-slate-800 tabular-nums">{fmt3(allocated)}</strong></span>
              <span className={credit < -0.0005 ? "text-rose-600" : "text-slate-500"}>
                {credit < -0.0005 ? "Over-applied" : "Kept as credit"} <strong className="tabular-nums">{fmt3(Math.abs(credit))}</strong>
              </span>
            </div>
          </div>
        )}

        <Field label="Note">
          <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        {balance != null && amountNum > balance + 0.0005 && balance >= 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            This is more than you owe ({fmt3(balance)} OMR) — the extra {fmt3(amountNum - balance)} OMR will be kept as credit with the supplier.
          </p>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}
