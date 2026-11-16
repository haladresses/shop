"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { LuArrowLeft, LuCheck, LuClipboardList, LuLoaderCircle, LuPackageMinus, LuPrinter, LuScanBarcode, LuTrash2 } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import SettlementPicker from "@/components/admin/purchasing/SettlementPicker";
import { DebitNoteDoc, type PrintableReturn } from "@/components/admin/purchasing/PrintDocs";
import { Field, StatusBadge, SupplierPicker, api, fmt3, fmtDate, todayKey, useDocHeader, usePurchasingPerms, type SupplierOption } from "@/components/admin/purchasing/shared";

type PoRow = { id: string; number: string; status: string; orderDate: string | null; supplierReference: string | null; unitsReceived: number; total: number };
type PoLine = { id: string; nameEn: string; variantLabel: string | null; productId: string | null; quantity: number; receivedQty: number; returnedQty: number; netAmount: number; taxAmount: number; onHand: number | null };
type LookupRow = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
  onHand: number | null;
  costPrice: number | null;
  lastCost: number | null;
  tax: { rate: number; code: string };
};
type StockLine = { variantId: string; nameEn: string; variantLabel: string | null; onHand: number; quantity: string; unitCost: string; taxRate: string };

const n = (v: string) => parseFloat(v) || 0;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function Page() {
  const sp = useSearchParams();
  const perms = usePurchasingPerms();
  const header = useDocHeader();
  const [supplier, setSupplier] = useState<SupplierOption | null>(null);
  const [mode, setMode] = useState<"po" | "stock">(sp.get("mode") === "stock" ? "stock" : "po");
  const [pos, setPos] = useState<PoRow[]>([]);
  const [poId, setPoId] = useState<string>(sp.get("purchaseOrderId") || "");
  const [poLines, setPoLines] = useState<PoLine[]>([]);
  const [poQty, setPoQty] = useState<Record<string, string>>({});
  const [stock, setStock] = useState<StockLine[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LookupRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [reason, setReason] = useState("");
  const [returnedAt, setReturnedAt] = useState(todayKey());
  const [settlement, setSettlement] = useState<"CREDIT" | "REFUND">("CREDIT");
  const [refundMethod, setRefundMethod] = useState("BANK_TRANSFER");
  const [refundReference, setRefundReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<(PrintableReturn & { id: string; supplierDetails: PrintableReturn["supplier"] }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ enabled: boolean }>("/api/tax/settings").then((d) => setVatEnabled(!!d.data?.enabled));
    const sid = sp.get("supplierId");
    if (sid) {
      api<{ supplier: SupplierOption; balance: { balance: number } }>(`/api/suppliers/${sid}`).then((d) => d.data && setSupplier({ ...d.data.supplier, balance: d.data.balance.balance }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The supplier's orders with received goods.
  useEffect(() => {
    if (!supplier) return setPos([]);
    Promise.all([
      api<{ items: PoRow[] }>(`/api/purchases?supplierId=${supplier.id}&status=RECEIVED&pageSize=100`),
      api<{ items: PoRow[] }>(`/api/purchases?supplierId=${supplier.id}&status=PARTIALLY_RECEIVED&pageSize=100`),
    ]).then(([a, b]) => setPos([...(b.data?.items ?? []), ...(a.data?.items ?? [])].sort((x, y) => (y.orderDate ?? "").localeCompare(x.orderDate ?? ""))));
  }, [supplier]);

  useEffect(() => {
    if (!poId) return setPoLines([]);
    api<{ items: PoLine[]; supplier: { id: string } }>(`/api/purchases/${poId}`).then((d) => {
      setPoLines(d.data?.items ?? []);
      setPoQty({});
    });
  }, [poId]);

  useEffect(() => {
    const term = q.trim();
    if (!term) return setResults([]);
    setSearching(true);
    const t = setTimeout(() => {
      api<LookupRow[]>(`/api/purchases/lookup?q=${encodeURIComponent(term)}`).then((d) => {
        setResults((d.data ?? []).filter((r) => r.variantId && (r.onHand ?? 0) > 0));
        setSearching(false);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const addStock = (r: LookupRow) => {
    if (!r.variantId) return;
    setStock((prev) => {
      const ex = prev.find((l) => l.variantId === r.variantId);
      if (ex) return prev.map((l) => (l === ex ? { ...l, quantity: String(Math.min(r.onHand ?? 0, n(l.quantity) + 1)) } : l));
      return [
        ...prev,
        {
          variantId: r.variantId!,
          nameEn: r.nameEn,
          variantLabel: r.variantLabel,
          onHand: r.onHand ?? 0,
          quantity: "1",
          unitCost: String(r.costPrice ?? r.lastCost ?? 0),
          taxRate: vatEnabled ? String(r.tax?.rate ?? 0) : "0",
        },
      ];
    });
    setQ("");
    setResults([]);
    inputRef.current?.focus();
  };

  const onScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    if (results.length === 1) return addStock(results[0]);
    const d = await api<LookupRow[]>(`/api/purchases/lookup?barcode=${encodeURIComponent(term)}`);
    const rows = (d.data ?? []).filter((r) => r.variantId);
    if (rows.length === 1) {
      if ((rows[0].onHand ?? 0) <= 0) return toast.error(`${rows[0].nameEn} has no stock to return`);
      addStock(rows[0]);
    } else if (!rows.length) toast.error(`Nothing found for “${term}”`);
  };

  const returnable = useMemo(() => poLines.map((l) => ({ ...l, can: Math.max(0, l.receivedQty - l.returnedQty) })).filter((l) => l.can > 0), [poLines]);
  const poValue = returnable.reduce((s, l) => s + (l.quantity ? ((l.netAmount + l.taxAmount) / l.quantity) * (parseInt(poQty[l.id] || "0") || 0) : 0), 0);
  const stockValue = stock.reduce((s, l) => {
    const net = r3(n(l.unitCost) * Math.floor(n(l.quantity)));
    return s + net + r3((net * n(l.taxRate)) / 100);
  }, 0);
  const value = r3(mode === "po" ? poValue : stockValue);

  const submit = async () => {
    if (!supplier) return setErr("Choose the supplier.");
    let body: Record<string, unknown> = { supplierId: supplier.id, reason: reason || null, returnedAt, settlement, refundMethod, refundReference: refundReference || null };
    if (mode === "po") {
      if (!poId) return setErr("Choose the purchase order.");
      const lines = returnable.map((l) => ({ itemId: l.id, quantity: parseInt(poQty[l.id] || "0") || 0 })).filter((l) => l.quantity > 0);
      if (!lines.length) return setErr("Enter how many of each item is going back.");
      for (const l of returnable) if ((parseInt(poQty[l.id] || "0") || 0) > l.can) return setErr(`Only ${l.can} of ${l.nameEn} can be returned.`);
      body = { ...body, purchaseOrderId: poId, lines };
    } else {
      const stockLines = stock.map((l) => ({ variantId: l.variantId, quantity: Math.floor(n(l.quantity)), unitCost: n(l.unitCost), taxRate: n(l.taxRate) })).filter((l) => l.quantity > 0);
      if (!stockLines.length) return setErr("Add the items that are going back.");
      for (const l of stock) if (Math.floor(n(l.quantity)) > l.onHand) return setErr(`Only ${l.onHand} of ${l.nameEn} in stock.`);
      body = { ...body, stockLines };
    }
    setSaving(true);
    setErr("");
    const d = await api<{ id: string; number: string; total: number }>("/api/supplier-returns", { body });
    if (!d.success || !d.data) {
      setSaving(false);
      return setErr(d.error || "Could not record the return.");
    }
    toast.success(`${d.data.number} recorded`);
    const det = await api<PrintableReturn & { id: string; supplierDetails: PrintableReturn["supplier"] }>(`/api/supplier-returns/${d.data.id}`);
    setSaving(false);
    if (det.data) setDone(det.data);
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><LuCheck size={30} /></div>
        <div>
          <p className="text-lg font-semibold text-slate-800">{done.number} recorded</p>
          <p className="text-slate-500 mt-1">
            {fmt3(done.total)} OMR {done.settlement === "REFUND" ? "refunded by" : "credited to your account with"} {done.supplierDetails.nameEn}. Stock is updated.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => printArea("debit-note-new", { page: "a4", title: done.number })} className="admin-btn admin-btn-primary"><LuPrinter size={15} /> Print debit note</button>
          <Link href="/admin/supplier-returns" className="admin-btn admin-btn-secondary">All returns</Link>
          <button
            onClick={() => {
              setDone(null);
              setPoQty({});
              setStock([]);
              setReason("");
              if (poId) api<{ items: PoLine[] }>(`/api/purchases/${poId}`).then((d) => setPoLines(d.data?.items ?? []));
            }}
            className="admin-btn admin-btn-secondary"
          >
            Another return
          </button>
        </div>
        <PrintArea id="debit-note-new">
          <DebitNoteDoc ret={{ ...done, supplier: done.supplierDetails }} header={header} />
        </PrintArea>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Link href="/admin/supplier-returns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><LuArrowLeft size={15} /> Returns to suppliers</Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">Return goods to a supplier</h1>
      </div>

      <div className="admin-card !overflow-visible p-5 space-y-4">
        <Field label="Supplier">
          <SupplierPicker value={supplier} onChange={(s) => { setSupplier(s); setPoId(""); }} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-2">
          {([
            ["po", "From a purchase order", "Goods you received on one of this supplier's orders."],
            ["stock", "Stock not on an order", "Items bought before you used purchase orders, or from elsewhere."],
          ] as const).map(([k, title, hint]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`text-left rounded-xl px-4 py-3 ring-1 transition ${mode === k ? "ring-indigo-400 bg-indigo-50/60" : "ring-slate-200 hover:ring-slate-300"}`}>
              <span className="block font-medium text-slate-800">{title}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      {supplier && mode === "po" && (
        <div className="admin-card">
          <div className="p-4 border-b border-slate-100">
            <Field label="Purchase order">
              <select className="admin-input admin-select" value={poId} onChange={(e) => setPoId(e.target.value)}>
                <option value="">Choose an order with received goods…</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} · {fmtDate(p.orderDate)} · {p.unitsReceived} units received{p.supplierReference ? ` · inv ${p.supplierReference}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {pos.length === 0 && (
              <p className="text-sm text-slate-500 mt-2">
                No received orders from this supplier. <button className="text-indigo-600 hover:underline" onClick={() => setMode("stock")}>Return stock not on an order</button> instead.
              </p>
            )}
          </div>
          {poId && (
            returnable.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">Everything received on this order has already been returned.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr><th>Item</th><th className="text-right">Received</th><th className="text-right">Returned</th><th className="text-right">In stock</th><th className="text-right">Unit (incl. VAT)</th><th className="text-right w-32">Return now</th></tr>
                  </thead>
                  <tbody>
                    {returnable.map((l) => (
                      <tr key={l.id}>
                        <td><p className="font-medium text-slate-800">{l.nameEn}</p><p className="text-xs text-slate-500">{l.productId ? l.variantLabel || "Standard" : "Non-stock item"}</p></td>
                        <td className="text-right tabular-nums">{l.receivedQty}</td>
                        <td className="text-right tabular-nums text-slate-500">{l.returnedQty || "—"}</td>
                        <td className="text-right tabular-nums text-slate-500">{l.onHand ?? "—"}</td>
                        <td className="text-right tabular-nums">{fmt3(l.quantity ? (l.netAmount + l.taxAmount) / l.quantity : 0)}</td>
                        <td className="text-right">
                          <input type="number" min="0" max={l.can} placeholder="0" value={poQty[l.id] ?? ""} onChange={(e) => setPoQty({ ...poQty, [l.id]: e.target.value })} className="admin-input !py-1 text-right !w-24" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {supplier && mode === "stock" && (
        <div className="admin-card !overflow-visible">
          <form onSubmit={onScan} className="relative p-4 border-b border-slate-100">
            <LuScanBarcode size={18} className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scan or search the items going back" className="admin-input !py-2.5 !pl-10" />
            {searching && <LuLoaderCircle size={16} className="absolute right-7 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
            {results.length > 0 && (
              <ul className="absolute z-30 left-4 right-4 mt-1 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 max-h-72 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => addStock(r)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-800 truncate">{r.nameEn}</span>
                        <span className="block text-xs text-slate-500">{[r.variantLabel || "Standard", r.barcode].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{r.onHand} in stock</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
          {stock.length === 0 ? (
            <p className="px-4 py-10 text-sm text-slate-400 text-center">Scan or search the items you&apos;re sending back.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr><th>Item</th><th className="text-right">In stock</th><th className="text-right w-24">Qty</th><th className="text-right w-32">Unit cost</th><th className="text-right w-20">VAT %</th><th className="text-right">Total</th><th /></tr>
                </thead>
                <tbody>
                  {stock.map((l) => {
                    const net = r3(n(l.unitCost) * Math.floor(n(l.quantity)));
                    return (
                      <tr key={l.variantId}>
                        <td><p className="font-medium text-slate-800">{l.nameEn}</p><p className="text-xs text-slate-500">{l.variantLabel || "Standard"}</p></td>
                        <td className="text-right tabular-nums text-slate-500">{l.onHand}</td>
                        <td className="text-right"><input type="number" min="1" max={l.onHand} value={l.quantity} onChange={(e) => setStock(stock.map((x) => (x === l ? { ...x, quantity: e.target.value } : x)))} className="admin-input !py-1 text-right !w-20" /></td>
                        <td className="text-right"><input type="number" min="0" step="0.001" value={l.unitCost} onChange={(e) => setStock(stock.map((x) => (x === l ? { ...x, unitCost: e.target.value } : x)))} className="admin-input !py-1 text-right !w-28" /></td>
                        <td className="text-right"><input type="number" min="0" max="100" step="0.01" value={l.taxRate} onChange={(e) => setStock(stock.map((x) => (x === l ? { ...x, taxRate: e.target.value } : x)))} className="admin-input !py-1 text-right !w-16" /></td>
                        <td className="text-right tabular-nums">{fmt3(net + r3((net * n(l.taxRate)) / 100))}</td>
                        <td><button onClick={() => setStock(stock.filter((x) => x !== l))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove"><LuTrash2 size={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {supplier && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 admin-card p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Reason"><input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong size, faulty stitching…" /></Field>
              <Field label="Date"><input type="date" className="admin-input" value={returnedAt} max={todayKey()} onChange={(e) => setReturnedAt(e.target.value)} /></Field>
            </div>
            <SettlementPicker value={settlement} onChange={setSettlement} canRefund={perms.pay} method={refundMethod} onMethod={setRefundMethod} reference={refundReference} onReference={setRefundReference} />
          </div>
          <div className="admin-card p-5 h-fit space-y-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><LuPackageMinus size={18} /> Debit note</h3>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Supplier</span><span className="font-medium text-right">{supplier.nameEn}</span></div>
            {mode === "po" && poId && <div className="flex justify-between text-sm"><span className="text-slate-500">Order</span><span className="font-medium inline-flex items-center gap-1"><LuClipboardList size={13} />{pos.find((p) => p.id === poId)?.number}<StatusBadge status={pos.find((p) => p.id === poId)?.status ?? ""} /></span></div>}
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-800">Value (incl. VAT)</span>
              <span className="text-xl font-bold tabular-nums">{fmt3(value)}</span>
            </div>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button onClick={submit} disabled={saving || value <= 0 || !perms.receive} className="admin-btn admin-btn-danger w-full justify-center disabled:opacity-40">
              {saving ? "Saving…" : settlement === "REFUND" ? `Return & record ${fmt3(value)} refund` : `Return ${fmt3(value)} OMR`}
            </button>
            <p className="text-xs text-slate-400">Stock goes down straight away. {settlement === "REFUND" ? "The refund is recorded as money received from the supplier." : "What you owe this supplier goes down by the same amount."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewSupplierReturnPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spinner" /></div>}>
      <Page />
    </Suspense>
  );
}
