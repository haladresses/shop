"use client";
import { useCallback, useEffect, useState } from "react";
import { LuLoaderCircle, LuMinus, LuPlus, LuPrinter, LuRotateCcw, LuSearch } from "react-icons/lu";
import { PosModal, methodLabel, omr } from "@/components/pos/PosUi";
import PrintArea from "@/components/print/PrintArea";
import { SaleDocument } from "@/components/print/SaleDocument";
import { printArea } from "@/lib/print";
import { refundToCreditNote, type InvoiceData, type StoreInfo } from "@/lib/invoice";
import { DEFAULT_TAX_SETTINGS, type TaxSettings } from "@/lib/taxCalc";

// Shared by the POS terminal, the admin Returns screen and the admin order
// screen. Any number of units of any line can be returned — e.g. 1 of the 4
// items on an order — and the rest of the order stays as it is.

type SaleItem = {
  id: string;
  nameEn: string;
  nameAr?: string;
  color: string | null;
  size: string | null;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  /** What one returned unit refunds (after offers/discount, incl. VAT). */
  refundPerUnit?: number;
};

type Sale = {
  id: string;
  orderNumber: string;
  invoiceNumber?: string | null;
  source: string;
  paymentStatus: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  total: number;
  refundedAmount?: number;
  items: SaleItem[];
} & Record<string, unknown>;

type RefundResult = { amount: number; taxAmount: number; creditNoteNumber: string | null; fullyReturned: boolean } & Record<string, unknown>;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

async function postJson<T = unknown>(url: string, body: unknown): Promise<{ success: boolean; data?: T; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

export default function ReturnModal({
  open,
  onClose,
  onDone,
  orderNumber,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  /** Open straight on this order (admin order screen). */
  orderNumber?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Sale[]>([]);
  const [order, setOrder] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<RefundResult | null>(null);
  const [creditNote, setCreditNote] = useState<InvoiceData | null>(null);
  const [store, setStore] = useState<StoreInfo>({});
  const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);

  const reset = () => {
    setQ(""); setResults([]); setOrder(null); setQty({}); setMethod("CASH"); setReason(""); setRestock(true); setErr(""); setDone(null); setCreditNote(null);
  };

  const search = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setBusy(true);
    setErr("");
    const d = await fetch(`/api/pos/orders?q=${encodeURIComponent(term.trim())}`).then((r) => r.json()).catch(() => null);
    setBusy(false);
    const list: Sale[] = d?.success ? d.data : [];
    const exact = list.find((s) => s.orderNumber === term.trim());
    setResults(list);
    if (exact) setOrder(exact);
    else if (list.length === 1) setOrder(list[0]);
    if (list.length === 0) setErr("No order found with that number.");
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings?group=general").then((r) => r.json()).then((d) => d.success && setStore(d.data)).catch(() => {});
    fetch("/api/tax/settings").then((r) => r.json()).then((d) => d.success && setTax(d.data)).catch(() => {});
    if (orderNumber) {
      setQ(orderNumber);
      search(orderNumber);
    }
  }, [open, orderNumber, search]);

  const unitRefund = (it: SaleItem) => {
    if (it.refundPerUnit != null) return it.refundPerUnit;
    const ratio = order && order.subtotal > 0 ? order.discount / order.subtotal : 0;
    return it.unitPrice * (1 - ratio);
  };
  const refundAmount = order ? r3(order.items.reduce((s, it) => s + (qty[it.id] || 0) * unitRefund(it), 0)) : 0;
  const units = Object.values(qty).reduce((s, n) => s + n, 0);
  const allLeft = order ? order.items.reduce((s, it) => s + (it.quantity - it.returnedQuantity), 0) : 0;

  const setAll = (mode: "all" | "none") => {
    if (!order) return;
    setQty(mode === "none" ? {} : Object.fromEntries(order.items.map((it) => [it.id, it.quantity - it.returnedQuantity])));
  };

  const submit = async () => {
    if (!order) return;
    const items = Object.entries(qty).filter(([, n]) => n > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) return setErr("Choose how many of each item is coming back.");
    setBusy(true);
    setErr("");
    const d = await postJson<RefundResult>("/api/pos/returns", { orderId: order.id, items, method, reason: reason || undefined, restock }).catch(() => null);
    setBusy(false);
    if (!d?.success || !d.data) return setErr(d?.error || "Return failed.");
    setDone(d.data);
    setCreditNote(refundToCreditNote(order, { ...d.data, createdAt: new Date().toISOString() }));
    onDone();
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <PosModal open={open} onClose={close} title="Return / refund" size="lg">
      {done !== null ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3"><LuRotateCcw size={28} /></div>
          <p className="text-lg font-semibold text-slate-800">Return recorded</p>
          <p className="text-slate-500 mt-1">
            Give the customer <strong className="text-slate-800">{omr(done.amount)}</strong> ({methodLabel(method)}).
          </p>
          {done.taxAmount > 0 && <p className="text-xs text-slate-400 mt-1">Includes {omr(done.taxAmount)} VAT reversed</p>}
          {done.creditNoteNumber && <p className="text-xs text-slate-500 mt-1">Credit note {done.creditNoteNumber}</p>}
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {creditNote && (
              <button
                onClick={() => printArea("credit-note", { page: "receipt", title: done.creditNoteNumber || "Credit note" })}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium inline-flex items-center gap-2"
              >
                <LuPrinter size={16} /> Print credit note
              </button>
            )}
            {!orderNumber && (
              <button onClick={reset} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium">Another return</button>
            )}
            {orderNumber && (
              <button onClick={close} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium">Done</button>
            )}
          </div>
          {creditNote && (
            <PrintArea id="credit-note">
              <SaleDocument data={creditNote} store={store} tax={tax} layout="thermal" />
            </PrintArea>
          )}
        </div>
      ) : !order ? (
        <>
          <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="flex gap-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order / receipt number e.g. HD-261014-123456" className="flex-1 min-w-0 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-200" />
            <button className="px-5 rounded-xl bg-slate-800 text-white" aria-label="Find order">{busy ? <LuLoaderCircle className="animate-spin" /> : <LuSearch />}</button>
          </form>
          {err && <p className="text-rose-600 text-sm mt-3">{err}</p>}
          {results.length > 1 && (
            <ul className="mt-4 divide-y divide-slate-100">
              {results.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setOrder(s)} className="w-full flex justify-between py-3 px-2 hover:bg-slate-50 rounded-xl">
                    <span className="font-medium">{s.orderNumber}</span>
                    <span>{omr(s.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{order.orderNumber}</p>
              <p className="text-xs text-slate-500">
                {new Date(order.createdAt).toLocaleString("en-GB")} · {order.source} · paid {omr(order.total)}
                {(order.refundedAmount ?? 0) > 0 && ` · ${omr(order.refundedAmount ?? 0)} already refunded`}
              </p>
            </div>
            {!orderNumber && (
              <button onClick={() => { setOrder(null); setQty({}); }} className="text-sm text-slate-500 hover:text-slate-800 shrink-0">Change</button>
            )}
          </div>
          {order.paymentStatus !== "PAID" && (
            <p className="text-amber-700 bg-amber-50 rounded-xl p-3 text-sm">
              This order is {order.paymentStatus.toLowerCase()} — only paid orders can be returned. Mark it as paid first, or cancel it instead.
            </p>
          )}

          <div className="flex items-center justify-between text-sm">
            <p className="text-slate-600">Choose how many of each item is coming back — the rest of the order stays as it is.</p>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => setAll("all")} disabled={allLeft === 0} className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40">All</button>
              <button type="button" onClick={() => setAll("none")} className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">None</button>
            </div>
          </div>

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {order.items.map((it) => {
              const left = it.quantity - it.returnedQuantity;
              const n = qty[it.id] || 0;
              return (
                <li key={it.id} className={`flex items-center gap-3 px-3 py-3 ${n > 0 ? "bg-rose-50/60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">{it.nameEn}</p>
                    <p className="text-xs text-slate-500">
                      {[it.color, it.size].filter(Boolean).join(" / ") || "Standard"} · bought {it.quantity}
                      {it.returnedQuantity > 0 && ` · ${it.returnedQuantity} returned`} · refund {unitRefund(it).toFixed(3)} each
                    </p>
                    {left === 0 && <p className="text-xs text-slate-400">Fully returned</p>}
                  </div>
                  {n > 0 && <span className="text-sm font-semibold text-rose-600 tabular-nums shrink-0">{(n * unitRefund(it)).toFixed(3)}</span>}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white shrink-0">
                    <button onClick={() => setQty({ ...qty, [it.id]: Math.max(0, n - 1) })} disabled={n === 0} className="w-9 h-9 flex items-center justify-center text-slate-500 disabled:opacity-30" aria-label="One less"><LuMinus size={14} /></button>
                    <span className="w-10 text-center font-semibold tabular-nums">{n}<span className="text-slate-300 font-normal">/{left}</span></span>
                    <button onClick={() => setQty({ ...qty, [it.id]: Math.min(left, n + 1) })} disabled={n >= left} className="w-9 h-9 flex items-center justify-center text-slate-500 disabled:opacity-30" aria-label="One more"><LuPlus size={14} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Refund by</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="STORE_CREDIT">Store credit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong size, changed mind…" className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="rounded" />
            Put items back in stock (untick for damaged goods)
          </label>
          {err && <p className="text-rose-600 text-sm">{err}</p>}
          <button onClick={submit} disabled={busy || refundAmount <= 0 || order.paymentStatus !== "PAID"} className="w-full py-3.5 rounded-2xl bg-rose-500 text-white font-semibold hover:bg-rose-600 disabled:opacity-40 flex items-center justify-center gap-2">
            {busy ? <LuLoaderCircle className="animate-spin" /> : <>Return {units} item{units === 1 ? "" : "s"} · refund {omr(refundAmount)}</>}
          </button>
        </div>
      )}
    </PosModal>
  );
}
