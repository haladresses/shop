"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { LuCircleCheck, LuChevronLeft, LuClipboardList, LuPackage, LuPrinter, LuTrash2, LuUndo2 } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import ItemSearch, { type LookupRow } from "@/components/admin/purchasing/ItemSearch";
import { SettlementPicker } from "@/components/admin/purchasing/PoDialogs";
import { DebitNoteDoc, type PrintableReturn } from "@/components/admin/purchasing/PrintDocs";
import { BalanceText, Field, StatusBadge, SupplierPicker, api, fmt3, fmtDate, todayKey, useDocHeader, usePurchasingPerms, type SupplierOption } from "@/components/admin/purchasing/shared";
import type { PoDetailData, PoRow } from "@/components/admin/purchasing/types";

type StockLine = {
  variantId: string;
  nameEn: string;
  variantLabel: string | null;
  sku: string | null;
  onHand: number;
  quantity: string;
  unitCost: string;
  taxRate: string;
  costHint: string | null;
};

type Done = { id: string; number: string; total: number; units: number; refund: { number: string } | null };

const n = (v: string) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export default function NewSupplierReturnPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><span className="spinner" /></div>}>
      <NewSupplierReturn />
    </Suspense>
  );
}

/**
 * Return goods to a supplier — either items received on one of their purchase
 * orders, or stock that isn't on any order (e.g. bought before the system was
 * in use). Stock goes down; the value is credited to our account with them or
 * refunded.
 */
function NewSupplierReturn() {
  const sp = useSearchParams();
  const perms = usePurchasingPerms();
  const header = useDocHeader();
  const vatOn = !!header?.vatEnabled;

  const [supplier, setSupplier] = useState<SupplierOption | null>(null);
  const [mode, setMode] = useState<"po" | "stock">("po");
  const [orders, setOrders] = useState<PoRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [poId, setPoId] = useState<string>(sp.get("purchaseOrderId") || "");
  const [po, setPo] = useState<PoDetailData | null>(null);
  const [poQty, setPoQty] = useState<Record<string, string>>({});
  const [stock, setStock] = useState<StockLine[]>([]);
  const [reason, setReason] = useState("");
  const [returnedAt, setReturnedAt] = useState(todayKey());
  const [settlement, setSettlement] = useState<"CREDIT" | "REFUND">("CREDIT");
  const [refundMethod, setRefundMethod] = useState("BANK_TRANSFER");
  const [refundReference, setRefundReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [doc, setDoc] = useState<PrintableReturn | null>(null);

  // Prefill the supplier from ?supplierId= (or from the chosen order).
  useEffect(() => {
    const id = sp.get("supplierId");
    if (!id) return;
    api<{ supplier: SupplierOption; balance: { balance: number } }>(`/api/suppliers/${id}`).then((d) => {
      if (d.success && d.data) setSupplier({ ...d.data.supplier, balance: d.data.balance.balance });
    });
  }, [sp]);

  // The supplier's orders with goods received.
  useEffect(() => {
    if (!supplier) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    api<{ items: PoRow[] }>(`/api/purchases?supplierId=${supplier.id}&status=received&pageSize=100`).then((d) => {
      setOrders(d.data?.items ?? []);
      setLoadingOrders(false);
    });
  }, [supplier]);

  useEffect(() => {
    if (!poId) {
      setPo(null);
      return;
    }
    api<PoDetailData>(`/api/purchases/${poId}`).then((d) => {
      if (d.success && d.data) {
        setPo(d.data);
        setPoQty({});
        if (!supplier) {
          setSupplier({
            id: d.data.supplier.id,
            code: d.data.supplier.code,
            nameEn: d.data.supplier.nameEn,
            nameAr: d.data.supplier.nameAr,
            paymentTermsDays: d.data.supplier.paymentTermsDays,
            balance: d.data.supplier.balance,
            isActive: d.data.supplier.isActive,
          });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  const pickSupplier = (s: SupplierOption | null) => {
    setSupplier(s);
    setPoId("");
    setPo(null);
    setStock([]);
  };

  const returnable = useMemo(() => (po ? po.items.filter((i) => i.receivedQty - i.returnedQty > 0) : []), [po]);

  const addStock = (r: LookupRow) => {
    if (!r.variantId || r.onHand == null) return;
    setStock((ls) => {
      const ex = ls.find((l) => l.variantId === r.variantId);
      if (ex) return ls.map((l) => (l.variantId === r.variantId ? { ...l, quantity: String(Math.floor(n(l.quantity)) + 1) } : l));
      const cost = r.lastSupplier?.id === supplier?.id && r.lastCost != null ? r.lastCost : (r.costPrice ?? r.lastCost);
      return [
        ...ls,
        {
          variantId: r.variantId!,
          nameEn: r.nameEn,
          variantLabel: r.variantLabel,
          sku: r.sku,
          onHand: r.onHand ?? 0,
          quantity: "1",
          unitCost: cost != null ? String(cost) : "",
          taxRate: vatOn && r.tax.rate > 0 ? String(r.tax.rate) : "0",
          costHint:
            r.lastCost != null
              ? `Last bought at ${fmt3(r.lastCost)}${r.lastSupplier ? ` from ${r.lastSupplier.nameEn}` : ""}`
              : r.costPrice != null
                ? `Current cost ${fmt3(r.costPrice)}`
                : null,
        },
      ];
    });
  };

  const totals = useMemo(() => {
    if (mode === "po") {
      let units = 0;
      let total = 0;
      for (const i of returnable) {
        const q = Math.floor(n(poQty[i.id] ?? ""));
        if (q <= 0 || i.quantity <= 0) continue;
        units += q;
        total += ((i.netAmount + i.taxAmount) / i.quantity) * q;
      }
      return { units, net: 0, tax: 0, total: r3(total) };
    }
    let units = 0;
    let net = 0;
    let tax = 0;
    for (const l of stock) {
      const q = Math.floor(n(l.quantity));
      if (q <= 0) continue;
      units += q;
      const lineNet = r3(n(l.unitCost) * q);
      net += lineNet;
      tax += r3((lineNet * n(l.taxRate)) / 100);
    }
    return { units, net: r3(net), tax: r3(tax), total: r3(net + tax) };
  }, [mode, returnable, poQty, stock]);

  const submit = async () => {
    if (!supplier) return setErr("Choose a supplier.");
    let body: Record<string, unknown>;
    if (mode === "po") {
      if (!po) return setErr("Choose the purchase order the goods came on.");
      const lines = returnable.map((i) => ({ itemId: i.id, quantity: Math.floor(n(poQty[i.id] ?? "")) })).filter((l) => l.quantity > 0);
      if (lines.length === 0) return setErr("Enter how many of each item is going back.");
      for (const l of lines) {
        const it = po.items.find((i) => i.id === l.itemId)!;
        const max = it.receivedQty - it.returnedQty;
        if (l.quantity > max) return setErr(`Only ${max} of ${it.nameEn} can be returned.`);
        if (it.variantId && it.onHand != null && l.quantity > it.onHand) return setErr(`Only ${it.onHand} of ${it.nameEn} are in stock.`);
      }
      body = { supplierId: supplier.id, purchaseOrderId: po.id, lines };
    } else {
      const stockLines = stock.map((l) => ({ variantId: l.variantId, quantity: Math.floor(n(l.quantity)), unitCost: n(l.unitCost), taxRate: n(l.taxRate) })).filter((l) => l.quantity > 0);
      if (stockLines.length === 0) return setErr("Add the items that are going back.");
      for (const l of stock) {
        if (Math.floor(n(l.quantity)) > l.onHand) return setErr(`Only ${l.onHand} of ${l.nameEn} are in stock.`);
        if (l.unitCost === "") return setErr(`Enter the unit cost of ${l.nameEn}.`);
      }
      body = { supplierId: supplier.id, purchaseOrderId: null, stockLines };
    }
    setSaving(true);
    setErr("");
    const d = await api<Done>("/api/supplier-returns", {
      body: { ...body, reason: reason || null, returnedAt, settlement, refundMethod, refundReference: refundReference || null },
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not record the return.");
    toast.success(`${d.data.number} recorded`);
    setDone(d.data);
  };

  const printDone = async () => {
    if (!done) return;
    const d = await api<PrintableReturn & { supplierDetails: PrintableReturn["supplier"] }>(`/api/supplier-returns/${done.id}`);
    if (!d.success || !d.data) return void toast.error("Could not load the debit note");
    setDoc({ ...d.data, supplier: d.data.supplierDetails });
    setTimeout(() => printArea("new-return-dn", { page: "a4", title: done.number }), 60);
  };

  if (perms.ready && !perms.receive) {
    return <div className="admin-card p-10 text-center text-slate-600">You don&apos;t have permission to return goods to suppliers.</div>;
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto admin-card p-8 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><LuCircleCheck size={28} /></div>
        <h1 className="text-xl font-semibold text-slate-800">Return {done.number} recorded</h1>
        <p className="text-slate-600">
          {done.units} unit{done.units === 1 ? "" : "s"} taken out of stock · <strong>{fmt3(done.total)} OMR</strong>{" "}
          {done.refund ? `refunded by ${supplier?.nameEn} (${done.refund.number})` : `credited to your account with ${supplier?.nameEn}`}.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button onClick={printDone} className="admin-btn admin-btn-primary"><LuPrinter size={15} /> Print debit note</button>
          {supplier && <Link href={`/admin/suppliers/${supplier.id}?tab=returns`} className="admin-btn admin-btn-secondary">Supplier account</Link>}
          <Link href="/admin/supplier-returns" className="admin-btn admin-btn-secondary">All returns</Link>
          <button
            onClick={() => {
              setDone(null);
              setPoQty({});
              setStock([]);
              setReason("");
              setPoId("");
            }}
            className="admin-btn admin-btn-secondary"
          >
            Another return
          </button>
        </div>
        {doc && (
          <PrintArea id="new-return-dn">
            <DebitNoteDoc ret={doc} header={header} />
          </PrintArea>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/supplier-returns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
          <LuChevronLeft size={16} /> Supplier returns
        </Link>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <div className="admin-card p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Supplier">
                <SupplierPicker value={supplier} onChange={pickSupplier} />
              </Field>
              {supplier && (
                <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm flex items-center justify-between self-end">
                  <span className="text-slate-500">{supplier.code}</span>
                  <span className="text-right">
                    <span className="block text-[11px] text-slate-400">Balance</span>
                    <BalanceText value={supplier.balance} />
                  </span>
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {(
                [
                  ["po", "From a purchase order", "Items received on one of their orders, valued at what you paid for them.", LuClipboardList],
                  ["stock", "Stock not on an order", "E.g. bought before the system was used. You enter the cost.", LuPackage],
                ] as const
              ).map(([id, title, hint, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`text-left rounded-xl border p-3 flex gap-3 ${mode === id ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <Icon size={18} className="text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!supplier ? (
            <div className="admin-card p-10 text-center text-slate-400 text-sm">Choose the supplier the goods are going back to.</div>
          ) : mode === "po" ? (
            <div className="admin-card">
              <div className="p-4 border-b border-slate-100">
                <Field label="Purchase order">
                  <select className="admin-input admin-select" value={poId} onChange={(e) => setPoId(e.target.value)}>
                    <option value="">{loadingOrders ? "Loading…" : orders.length ? "Choose an order with received goods…" : "No received orders from this supplier"}</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.number} · {fmtDate(o.orderDate)} · {o.unitsReceived} units received{o.supplierReference ? ` · invoice ${o.supplierReference}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {po && (
                <>
                  <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm border-b border-slate-100 bg-slate-50/60">
                    <StatusBadge status={po.status} />
                    <Link href={`/admin/purchases/${po.id}`} className="text-indigo-600 hover:underline">{po.number}</Link>
                    <span className="text-slate-500">· total {fmt3(po.total)} · {po.pricesIncludeTax ? "costs incl. VAT" : "costs excl. VAT"}</span>
                  </div>
                  {returnable.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">Everything received on this order has already been returned.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="admin-table min-w-[720px]">
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
                                <td className="text-right tabular-nums text-slate-500">{i.returnedQty || "-"}</td>
                                <td className="text-right tabular-nums text-slate-500">{i.onHand ?? "-"}</td>
                                <td className="text-right tabular-nums">{i.quantity > 0 ? fmt3((i.netAmount + i.taxAmount) / i.quantity) : "-"}</td>
                                <td className="text-right">
                                  <input type="number" min="0" max={max} placeholder={`max ${max}`} className="admin-input !py-1 text-right" value={poQty[i.id] ?? ""} onChange={(e) => setPoQty({ ...poQty, [i.id]: e.target.value })} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="admin-card">
              <div className="p-4 border-b border-slate-100">
                <ItemSearch supplierId={supplier.id} onPick={addStock} requireStock placeholder="Scan or search the items going back" autoFocus />
              </div>
              {stock.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-400 text-sm">
                  <LuUndo2 size={28} className="mb-2 text-slate-300" />
                  Scan or search the items being returned.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table min-w-[720px]">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-right">In stock</th>
                        <th className="text-right w-24">Quantity</th>
                        <th className="text-right w-32">Unit cost (excl. VAT)</th>
                        <th className="text-right w-20">VAT %</th>
                        <th className="text-right">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map((l) => {
                        const q = Math.floor(n(l.quantity));
                        const net = r3(n(l.unitCost) * q);
                        const total = r3(net + (net * n(l.taxRate)) / 100);
                        const set = (patch: Partial<StockLine>) => setStock((ls) => ls.map((x) => (x.variantId === l.variantId ? { ...x, ...patch } : x)));
                        return (
                          <tr key={l.variantId} className={q > l.onHand ? "bg-rose-50" : ""}>
                            <td>
                              <p className="font-medium text-slate-800">{l.nameEn}</p>
                              <p className="text-xs text-slate-500">{[l.variantLabel || "Standard", l.sku].filter(Boolean).join(" · ")}</p>
                              {l.costHint && <p className="text-[11px] text-slate-400">{l.costHint}</p>}
                            </td>
                            <td className="text-right tabular-nums text-slate-500">{l.onHand}</td>
                            <td className="text-right">
                              <input type="number" min="1" max={l.onHand} className="admin-input !py-1 text-right" value={l.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                            </td>
                            <td className="text-right">
                              <input type="number" min="0" step="0.001" className="admin-input !py-1 text-right" value={l.unitCost} onChange={(e) => set({ unitCost: e.target.value })} />
                            </td>
                            <td className="text-right">
                              <input type="number" min="0" max="100" step="0.01" className="admin-input !py-1 text-right" value={l.taxRate} onChange={(e) => set({ taxRate: e.target.value })} />
                            </td>
                            <td className="text-right tabular-nums font-medium">{fmt3(total)}</td>
                            <td>
                              <button onClick={() => setStock((ls) => ls.filter((x) => x.variantId !== l.variantId))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove">
                                <LuTrash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-4">
          <div className="admin-card p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><LuUndo2 size={18} /> Debit note</h3>
            <Field label="Returned on">
              <input type="date" className="admin-input" value={returnedAt} max={todayKey()} onChange={(e) => setReturnedAt(e.target.value)} />
            </Field>
            <Field label="Reason">
              <textarea className="admin-input min-h-[70px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Faulty, wrong size, not as ordered …" />
            </Field>
            <SettlementPicker
              value={settlement}
              onChange={setSettlement}
              canRefund={perms.pay}
              method={refundMethod}
              onMethod={setRefundMethod}
              reference={refundReference}
              onReference={setRefundReference}
            />
            <dl className="text-sm space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex justify-between"><dt className="text-slate-500">Units</dt><dd className="tabular-nums">{totals.units}</dd></div>
              {mode === "stock" && (
                <>
                  <div className="flex justify-between"><dt className="text-slate-500">Net</dt><dd className="tabular-nums">{fmt3(totals.net)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">VAT</dt><dd className="tabular-nums">{fmt3(totals.tax)}</dd></div>
                </>
              )}
              <div className="flex justify-between items-baseline border-t border-slate-100 pt-2">
                <dt className="font-semibold text-slate-800">Total</dt>
                <dd className="text-lg font-bold tabular-nums">{fmt3(totals.total)} OMR</dd>
              </div>
            </dl>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button onClick={submit} disabled={saving || totals.units === 0 || !supplier} className="admin-btn admin-btn-danger w-full !py-2.5 disabled:opacity-40">
              <LuUndo2 size={16} /> {saving ? "Saving…" : `Return ${totals.units} unit${totals.units === 1 ? "" : "s"}`}
            </button>
            <p className="text-[11px] text-slate-400">Stock goes down straight away. The goods must still be on hand.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
