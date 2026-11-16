"use client";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { LuPackageCheck, LuUndo2 } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { Field, PAYMENT_METHOD_OPTIONS, api, fmt3, todayKey } from "./shared";
import type { PoDetailData } from "./types";

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Receive a delivery against an order — any quantities, all at once or part by part. */
export function ReceiveModal({
  open,
  po,
  onClose,
  onDone,
}: {
  open: boolean;
  po: PoDetailData;
  onClose: () => void;
  onDone: (receipt: { number: string; items: unknown }) => void;
}) {
  const pending = po.items.filter((i) => i.quantity - i.receivedQty > 0);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [receivedAt, setReceivedAt] = useState(todayKey());
  const [supplierReference, setSupplierReference] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setQty(Object.fromEntries(po.items.map((i) => [i.id, String(Math.max(0, i.quantity - i.receivedQty))])));
    setReceivedAt(todayKey());
    setSupplierReference(po.supplierReference ?? "");
    setInvoiceDate(po.invoiceDate ?? "");
    setNote("");
    setErr("");
  }, [open, po]);

  const units = pending.reduce((s, i) => s + Math.max(0, parseInt(qty[i.id] || "0") || 0), 0);
  const value = pending.reduce((s, i) => s + (Math.max(0, parseInt(qty[i.id] || "0") || 0)) * (i.landedUnitCost ?? i.unitCost), 0);

  const submit = async () => {
    const lines = pending
      .map((i) => ({ itemId: i.id, quantity: parseInt(qty[i.id] || "0") || 0 }))
      .filter((l) => l.quantity > 0);
    for (const l of lines) {
      const it = po.items.find((i) => i.id === l.itemId)!;
      if (l.quantity > it.quantity - it.receivedQty) return setErr(`Only ${it.quantity - it.receivedQty} of ${it.nameEn} are still to come.`);
    }
    if (lines.length === 0) return setErr("Enter how many units arrived.");
    setSaving(true);
    setErr("");
    const d = await api<{ number: string; units: number; items: unknown }>(`/api/purchases/${po.id}/receive`, {
      body: {
        lines,
        receivedAt,
        note: note || null,
        supplierReference: supplierReference || null,
        invoiceDate: invoiceDate || null,
      },
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not receive the goods.");
    toast.success(`${d.data.number}: ${d.data.units} unit${d.data.units === 1 ? "" : "s"} added to stock`);
    onDone({ number: d.data.number, items: d.data.items });
    onClose();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Receive goods · ${po.number}`}
      className="!max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving || units === 0} className="admin-btn admin-btn-primary disabled:opacity-40">
            <LuPackageCheck size={15} /> {saving ? "Receiving…" : `Receive ${units} unit${units === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-slate-600">Count what actually arrived. Anything not delivered stays open on the order.</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setQty(Object.fromEntries(pending.map((i) => [i.id, String(i.quantity - i.receivedQty)])))} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">
              Everything
            </button>
            <button type="button" onClick={() => setQty({})} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">
              Clear
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Ordered</th>
                <th className="text-right">Received</th>
                <th className="text-right">Still due</th>
                <th className="text-right w-28">Arrived now</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((i) => {
                const left = i.quantity - i.receivedQty;
                const v = parseInt(qty[i.id] || "0") || 0;
                return (
                  <tr key={i.id} className={v > left ? "bg-rose-50" : ""}>
                    <td>
                      <p className="font-medium text-slate-800">{i.nameEn}</p>
                      <p className="text-xs text-slate-500">{i.productId ? i.variantLabel || "Standard" : "Not a stock item"}</p>
                    </td>
                    <td className="text-right tabular-nums">{i.quantity}</td>
                    <td className="text-right tabular-nums text-slate-500">{i.receivedQty}</td>
                    <td className="text-right tabular-nums font-medium">{left}</td>
                    <td className="text-right">
                      <input type="number" min="0" max={left} className="admin-input !py-1 text-right" value={qty[i.id] ?? ""} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Received on">
            <input type="date" className="admin-input" value={receivedAt} max={todayKey()} onChange={(e) => setReceivedAt(e.target.value)} />
          </Field>
          <Field label="Supplier invoice no.">
            <input className="admin-input" value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} />
          </Field>
          <Field label="Invoice date">
            <input type="date" className="admin-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Damaged box, short delivery …" />
        </Field>
        <p className="text-xs text-slate-500">
          Stock value of this delivery: <strong className="tabular-nums">{fmt3(value)} OMR</strong> (landed cost). Each product&apos;s cost moves to the weighted average.
        </p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}

/** Send received goods back to the supplier (debit note). */
export function ReturnToSupplierModal({
  open,
  po,
  canRefund,
  onClose,
  onDone,
}: {
  open: boolean;
  po: PoDetailData;
  canRefund: boolean;
  onClose: () => void;
  onDone: (ret: { id: string; number: string }) => void;
}) {
  const returnable = useMemo(() => po.items.filter((i) => i.receivedQty - i.returnedQty > 0), [po]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [returnedAt, setReturnedAt] = useState(todayKey());
  const [settlement, setSettlement] = useState<"CREDIT" | "REFUND">("CREDIT");
  const [refundMethod, setRefundMethod] = useState("BANK_TRANSFER");
  const [refundReference, setRefundReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setQty({});
    setReason("");
    setReturnedAt(todayKey());
    setSettlement("CREDIT");
    setRefundReference("");
    setErr("");
  }, [open]);

  const value = useMemo(
    () =>
      r3(
        returnable.reduce((s, i) => {
          const q = parseInt(qty[i.id] || "0") || 0;
          if (q <= 0 || i.quantity <= 0) return s;
          return s + ((i.netAmount + i.taxAmount) / i.quantity) * q;
        }, 0),
      ),
    [returnable, qty],
  );
  const units = returnable.reduce((s, i) => s + (parseInt(qty[i.id] || "0") || 0), 0);

  const submit = async () => {
    const lines = returnable.map((i) => ({ itemId: i.id, quantity: parseInt(qty[i.id] || "0") || 0 })).filter((l) => l.quantity > 0);
    if (lines.length === 0) return setErr("Choose what is going back.");
    for (const l of lines) {
      const it = po.items.find((i) => i.id === l.itemId)!;
      const max = it.receivedQty - it.returnedQty;
      if (l.quantity > max) return setErr(`Only ${max} of ${it.nameEn} can be returned.`);
      if (it.variantId && it.onHand != null && l.quantity > it.onHand) return setErr(`Only ${it.onHand} of ${it.nameEn} are in stock to send back.`);
    }
    setSaving(true);
    setErr("");
    const d = await api<{ id: string; number: string; total: number }>(`/api/purchases/${po.id}/return`, {
      body: { lines, reason: reason || null, returnedAt, settlement, refundMethod, refundReference: refundReference || null },
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not record the return.");
    toast.success(`${d.data.number}: ${fmt3(d.data.total)} OMR ${settlement === "REFUND" ? "refunded" : "credited"}`);
    onDone({ id: d.data.id, number: d.data.number });
    onClose();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Return to supplier · ${po.number}`}
      className="!max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving || units === 0} className="admin-btn admin-btn-danger disabled:opacity-40">
            <LuUndo2 size={15} /> {saving ? "Saving…" : `Return ${units} unit${units === 1 ? "" : "s"} · ${fmt3(value)} OMR`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {returnable.length === 0 ? (
          <p className="text-slate-500 text-sm">Nothing received on this order can still be returned.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Received</th>
                  <th className="text-right">Returned</th>
                  <th className="text-right">In stock</th>
                  <th className="text-right">Value / unit</th>
                  <th className="text-right w-28">Return</th>
                </tr>
              </thead>
              <tbody>
                {returnable.map((i) => {
                  const max = i.receivedQty - i.returnedQty;
                  return (
                    <tr key={i.id}>
                      <td>
                        <p className="font-medium text-slate-800">{i.nameEn}</p>
                        <p className="text-xs text-slate-500">{i.productId ? i.variantLabel || "Standard" : "Not a stock item"}</p>
                      </td>
                      <td className="text-right tabular-nums">{i.receivedQty}</td>
                      <td className="text-right tabular-nums text-slate-500">{i.returnedQty}</td>
                      <td className="text-right tabular-nums text-slate-500">{i.onHand ?? "—"}</td>
                      <td className="text-right tabular-nums">{i.quantity > 0 ? fmt3((i.netAmount + i.taxAmount) / i.quantity) : "—"}</td>
                      <td className="text-right">
                        <input type="number" min="0" max={max} placeholder={`max ${max}`} className="admin-input !py-1 text-right" value={qty[i.id] ?? ""} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Reason">
            <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Faulty, wrong size, not as ordered …" />
          </Field>
          <Field label="Returned on">
            <input type="date" className="admin-input" value={returnedAt} max={todayKey()} onChange={(e) => setReturnedAt(e.target.value)} />
          </Field>
        </div>
        <SettlementPicker
          value={settlement}
          onChange={setSettlement}
          canRefund={canRefund}
          method={refundMethod}
          onMethod={setRefundMethod}
          reference={refundReference}
          onReference={setRefundReference}
        />
        <p className="text-xs text-slate-500">Stock goes down by the returned units and the value comes off what you owe this supplier.</p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}

/** How a return to the supplier is settled: credit on the account, or money paid back. */
export function SettlementPicker({
  value,
  onChange,
  canRefund,
  method,
  onMethod,
  reference,
  onReference,
}: {
  value: "CREDIT" | "REFUND";
  onChange: (v: "CREDIT" | "REFUND") => void;
  canRefund: boolean;
  method: string;
  onMethod: (v: string) => void;
  reference: string;
  onReference: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Settlement</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {(
          [
            ["CREDIT", "Credit to our account", "Reduces what we owe this supplier (or builds credit)."],
            ["REFUND", "Supplier refunded the money", "Records the money received back with the return."],
          ] as const
        ).map(([v, title, hint]) => (
          <button
            key={v}
            type="button"
            disabled={v === "REFUND" && !canRefund}
            onClick={() => onChange(v)}
            className={`text-left rounded-xl border p-3 transition-colors disabled:opacity-40 ${value === v ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <span className="block text-sm font-medium text-slate-800">{title}</span>
            <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>
          </button>
        ))}
      </div>
      {value === "REFUND" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Refunded by">
            <select className="admin-input admin-select" value={method} onChange={(e) => onMethod(e.target.value)}>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.en}</option>
              ))}
            </select>
          </Field>
          <Field label="Reference">
            <input className="admin-input" value={reference} onChange={(e) => onReference(e.target.value)} placeholder="Transfer ref / cheque no." />
          </Field>
        </div>
      )}
      {!canRefund && <p className="text-[11px] text-slate-400">Recording a refund needs the supplier-payments permission.</p>}
    </div>
  );
}

/** Confirmation (with optional reason) for cancel / close short / back to draft / place order / delete. */
export function ActionModal({
  open,
  title,
  body,
  confirmLabel,
  danger,
  askReason,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  askReason?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      className="!max-w-md"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Back</button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(reason.trim());
              setBusy(false);
            }}
            className={`admin-btn ${danger ? "admin-btn-danger" : "admin-btn-primary"} disabled:opacity-40`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-600">
        {body}
        {askReason && (
          <Field label="Reason (optional)">
            <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </div>
    </AdminModal>
  );
}
