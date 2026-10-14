"use client";
import { useState } from "react";
import { LuLoaderCircle, LuMinus, LuPlus, LuRotateCcw, LuSearch } from "react-icons/lu";
import { PosModal, methodLabel, omr } from "@/components/pos/PosUi";

// Shared by the POS terminal and the admin Returns screen.

type SaleItem = {
  id: string;
  nameEn: string;
  color: string | null;
  size: string | null;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
};

type Sale = {
  id: string;
  orderNumber: string;
  source: string;
  paymentStatus: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  total: number;
  items: SaleItem[];
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

async function postJson<T = unknown>(url: string, body: unknown): Promise<{ success: boolean; data?: T; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

export default function ReturnModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Sale[]>([]);
  const [order, setOrder] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const reset = () => {
    setQ(""); setResults([]); setOrder(null); setQty({}); setMethod("CASH"); setReason(""); setRestock(true); setErr(""); setDone(null);
  };

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr("");
    const d = await fetch(`/api/pos/orders?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).catch(() => null);
    setBusy(false);
    const list: Sale[] = d?.success ? d.data : [];
    setResults(list);
    if (list.length === 1) setOrder(list[0]);
    if (list.length === 0) setErr("No order found with that number.");
  };

  const discountRatio = order && order.subtotal > 0 ? order.discount / order.subtotal : 0;
  const refundAmount = order
    ? r3(order.items.reduce((s, it) => s + (qty[it.id] || 0) * it.unitPrice * (1 - discountRatio), 0))
    : 0;

  const submit = async () => {
    if (!order) return;
    const items = Object.entries(qty).filter(([, n]) => n > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) return setErr("Choose how many of each item is coming back.");
    setBusy(true);
    setErr("");
    const d = await postJson<{ amount: number }>("/api/pos/returns", { orderId: order.id, items, method, reason: reason || undefined, restock }).catch(() => null);
    setBusy(false);
    if (!d?.success) return setErr(d?.error || "Return failed.");
    setDone(d.data!.amount);
    onDone();
  };

  return (
    <PosModal open={open} onClose={() => { reset(); onClose(); }} title="Return / refund" size="lg">
      {done !== null ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3"><LuRotateCcw size={28} /></div>
          <p className="text-lg font-semibold text-slate-800">Return recorded</p>
          <p className="text-slate-500 mt-1">Give the customer <strong className="text-slate-800">{omr(done)}</strong> ({methodLabel(method)}).</p>
          <button onClick={reset} className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium">Another return</button>
        </div>
      ) : !order ? (
        <>
          <form onSubmit={search} className="flex gap-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order / receipt number e.g. HD-261014-123456" className="flex-1 min-w-0 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-200" />
            <button className="px-5 rounded-xl bg-slate-800 text-white">{busy ? <LuLoaderCircle className="animate-spin" /> : <LuSearch />}</button>
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
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-800">{order.orderNumber}</p>
              <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("en-GB")} · {order.source} · paid {omr(order.total)}</p>
            </div>
            <button onClick={() => { setOrder(null); setQty({}); }} className="text-sm text-slate-500 hover:text-slate-800">Change</button>
          </div>
          {order.paymentStatus !== "PAID" && <p className="text-amber-700 bg-amber-50 rounded-xl p-3 text-sm">This order is {order.paymentStatus.toLowerCase()} — it can’t be returned here.</p>}
          <ul className="divide-y divide-slate-100">
            {order.items.map((it) => {
              const left = it.quantity - it.returnedQuantity;
              const n = qty[it.id] || 0;
              return (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">{it.nameEn}</p>
                    <p className="text-xs text-slate-500">
                      {[it.color, it.size].filter(Boolean).join(" / ")} · {it.unitPrice.toFixed(3)} · bought {it.quantity}
                      {it.returnedQuantity > 0 && ` · ${it.returnedQuantity} already returned`}
                    </p>
                  </div>
                  <div className="flex items-center rounded-xl border border-slate-200">
                    <button onClick={() => setQty({ ...qty, [it.id]: Math.max(0, n - 1) })} className="w-9 h-9 flex items-center justify-center text-slate-500"><LuMinus size={14} /></button>
                    <span className="w-8 text-center font-semibold">{n}</span>
                    <button onClick={() => setQty({ ...qty, [it.id]: Math.min(left, n + 1) })} disabled={n >= left} className="w-9 h-9 flex items-center justify-center text-slate-500 disabled:opacity-30"><LuPlus size={14} /></button>
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
            {busy ? <LuLoaderCircle className="animate-spin" /> : <>Refund {omr(refundAmount)}</>}
          </button>
        </div>
      )}
    </PosModal>
  );
}
