"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  LuCircleAlert,
  LuClipboardCheck,
  LuFileText,
  LuListPlus,
  LuPackage,
  LuPackageCheck,
  LuSave,
  LuSend,
  LuTrash2,
  LuTriangleAlert,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { calculatePurchase } from "@/lib/purchaseCalc";
import Attachments, { type Attachment } from "./Attachments";
import ItemSearch, { type LookupRow } from "./ItemSearch";
import {
  BalanceText,
  Field,
  PAYMENT_METHOD_OPTIONS,
  SupplierPicker,
  api,
  fmt3,
  fmtDate,
  todayKey,
  useDocHeader,
  usePurchasingPerms,
  type SupplierOption,
} from "./shared";

export type EditorLine = {
  uid: string;
  id?: string;
  productId: string | null;
  variantId: string | null;
  nameEn: string;
  nameAr: string | null;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
  onHand: number | null;
  quantity: string;
  unitCost: string;
  discountPct: string;
  taxRate: string;
  taxCode: string | null;
  /** Hint shown under the cost ("last paid 4.200 on 2 Nov"). */
  costHint?: string | null;
};

export type EditorInitial = {
  id?: string;
  number?: string;
  supplier: SupplierOption | null;
  supplierReference: string;
  invoiceDate: string;
  orderDate: string;
  expectedDate: string;
  dueDate: string;
  pricesIncludeTax: boolean;
  discount: string;
  shippingCost: string;
  otherCharges: string;
  notes: string;
  attachments: Attachment[];
  lines: EditorLine[];
};

let uidSeq = 0;
export const newUid = () => `l${Date.now().toString(36)}${(uidSeq++).toString(36)}`;

export function emptyEditor(): EditorInitial {
  return {
    supplier: null,
    supplierReference: "",
    invoiceDate: "",
    orderDate: todayKey(),
    expectedDate: "",
    dueDate: "",
    pricesIncludeTax: false,
    discount: "",
    shippingCost: "",
    otherCharges: "",
    notes: "",
    attachments: [],
    lines: [],
  };
}

const n = (v: string) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};

/** New purchase order, or full edit of a draft / placed order with nothing received yet. */
export default function PoEditor({ initial, onCancel }: { initial: EditorInitial; onCancel?: () => void }) {
  const router = useRouter();
  const perms = usePurchasingPerms();
  const header = useDocHeader();
  const vatOn = !!header?.vatEnabled;
  const editing = !!initial.id;

  const [supplier, setSupplier] = useState<SupplierOption | null>(initial.supplier);
  const [f, setF] = useState(() => ({
    supplierReference: initial.supplierReference,
    invoiceDate: initial.invoiceDate,
    orderDate: initial.orderDate,
    expectedDate: initial.expectedDate,
    dueDate: initial.dueDate,
    pricesIncludeTax: initial.pricesIncludeTax,
    discount: initial.discount,
    shippingCost: initial.shippingCost,
    otherCharges: initial.otherCharges,
    notes: initial.notes,
  }));
  const [attachments, setAttachments] = useState<Attachment[]>(initial.attachments);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines);
  const [saving, setSaving] = useState<null | "draft" | "order" | "receive" | "save">(null);
  const [err, setErr] = useState("");
  const [reorderOpen, setReorderOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payRef, setPayRef] = useState("");
  const [defaultRate, setDefaultRate] = useState(0);

  useEffect(() => {
    api<{ defaultRate?: { rate: number } }>("/api/tax/settings").then((d) => setDefaultRate(Number(d.data?.defaultRate?.rate ?? 0)));
  }, []);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const setLine = (uid: string, patch: Partial<EditorLine>) => setLines((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));

  const calc = useMemo(
    () =>
      calculatePurchase({
        lines: lines.map((l) => ({ quantity: Math.max(0, Math.floor(n(l.quantity))), unitCost: n(l.unitCost), discountPct: n(l.discountPct), taxRate: n(l.taxRate) })),
        pricesIncludeTax: f.pricesIncludeTax,
        discount: n(f.discount),
        shippingCost: n(f.shippingCost),
        otherCharges: n(f.otherCharges),
        reclaimTax: vatOn,
      }),
    [lines, f.pricesIncludeTax, f.discount, f.shippingCost, f.otherCharges, vatOn],
  );
  const units = lines.reduce((s, l) => s + Math.max(0, Math.floor(n(l.quantity))), 0);

  // Pay-now defaults to the whole order.
  useEffect(() => {
    if (payNow) setPayAmount(calc.total > 0 ? calc.total.toFixed(3) : "");
  }, [payNow, calc.total]);

  const addRow = (r: LookupRow, qty = 1) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === r.productId && (l.variantId ?? null) === (r.variantId ?? null));
      if (existing) return ls.map((l) => (l.uid === existing.uid ? { ...l, quantity: String(Math.floor(n(l.quantity)) + qty) } : l));
      const cost = r.lastCost ?? r.costPrice;
      const hint =
        r.lastCost != null
          ? `Last paid ${fmt3(r.lastCost)}${r.lastCostDate ? ` · ${fmtDate(r.lastCostDate)}` : ""}${r.lastSupplier && r.lastSupplier.id !== supplier?.id ? ` (${r.lastSupplier.nameEn})` : ""}`
          : r.costPrice != null
            ? `Current cost ${fmt3(r.costPrice)}`
            : null;
      return [
        ...ls,
        {
          uid: newUid(),
          productId: r.productId,
          variantId: r.variantId,
          nameEn: r.nameEn,
          nameAr: r.nameAr,
          variantLabel: r.variantLabel,
          sku: r.sku,
          barcode: r.barcode,
          imageUrl: r.imageUrl,
          onHand: r.onHand,
          quantity: String(qty),
          unitCost: cost != null ? String(cost) : "",
          discountPct: "",
          taxRate: vatOn && r.tax.rate > 0 ? String(r.tax.rate) : "0",
          taxCode: vatOn && r.tax.code ? r.tax.code : null,
          costHint: hint,
        },
      ];
    });
  };

  const addCustom = () =>
    setLines((ls) => [
      ...ls,
      {
        uid: newUid(),
        productId: null,
        variantId: null,
        nameEn: "",
        nameAr: null,
        variantLabel: null,
        sku: null,
        barcode: null,
        imageUrl: null,
        onHand: null,
        quantity: "1",
        unitCost: "",
        discountPct: "",
        taxRate: vatOn ? String(defaultRate) : "0",
        taxCode: null,
      },
    ]);

  const validate = (): string | null => {
    if (!supplier) return "Choose a supplier.";
    if (!f.orderDate) return "Enter the order date.";
    if (lines.length === 0) return "Add at least one item.";
    for (const [i, l] of lines.entries()) {
      if (!l.productId && !l.nameEn.trim()) return `Line ${i + 1}: enter a description.`;
      if (!(Math.floor(n(l.quantity)) >= 1)) return `Line ${i + 1}: quantity must be at least 1.`;
      if (l.unitCost === "" || n(l.unitCost) < 0) return `Line ${i + 1}: enter the unit cost.`;
      if (n(l.discountPct) < 0 || n(l.discountPct) > 100) return `Line ${i + 1}: discount must be 0–100%.`;
    }
    if (n(f.discount) > calc.lines.reduce((s, l) => s + l.base, 0) + 0.0005) return "The order discount is larger than the order.";
    return null;
  };

  const payload = () => ({
    supplierId: supplier!.id,
    supplierReference: f.supplierReference || null,
    invoiceDate: f.invoiceDate || null,
    orderDate: f.orderDate,
    expectedDate: f.expectedDate || null,
    dueDate: f.dueDate || null,
    pricesIncludeTax: f.pricesIncludeTax,
    discount: n(f.discount),
    shippingCost: n(f.shippingCost),
    otherCharges: n(f.otherCharges),
    notes: f.notes || null,
    attachments,
    items: lines.map((l) => ({
      ...(l.id ? { id: l.id } : {}),
      productId: l.productId,
      variantId: l.variantId,
      nameEn: l.productId ? l.nameEn : l.nameEn.trim(),
      nameAr: l.nameAr,
      variantLabel: l.variantLabel,
      sku: l.sku,
      barcode: l.barcode,
      quantity: Math.floor(n(l.quantity)),
      unitCost: n(l.unitCost),
      discountPct: n(l.discountPct),
      taxRate: n(l.taxRate),
      taxCode: l.taxCode,
    })),
  });

  const save = async (mode: "draft" | "order" | "receive" | "save") => {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setErr("");
    setSaving(mode);
    if (mode === "save") {
      const d = await api<{ id: string }>(`/api/purchases/${initial.id}`, { method: "PATCH", body: payload() });
      setSaving(null);
      if (!d.success) return setErr(d.error || "Could not save the order.");
      toast.success("Order updated");
      router.push(`/admin/purchases/${initial.id}`);
      router.refresh();
      onCancel?.();
      return;
    }
    const pay = payNow && mode !== "draft" && perms.pay && n(payAmount) > 0 ? { amount: n(payAmount), method: payMethod, reference: payRef || null } : null;
    const d = await api<{ id: string; number: string; receiptNumber: string | null; paymentNumber: string | null }>("/api/purchases", {
      body: { ...payload(), mode, payment: pay },
    });
    setSaving(null);
    if (!d.success || !d.data) return setErr(d.error || "Could not create the order.");
    const what = mode === "draft" ? "saved as draft" : mode === "order" ? "placed" : `received into stock (${d.data.receiptNumber})`;
    toast.success(`${d.data.number} ${what}${d.data.paymentNumber ? ` · payment ${d.data.paymentNumber}` : ""}`);
    router.push(`/admin/purchases/${d.data.id}${mode === "receive" ? "?received=1" : ""}`);
  };

  const termsHint = supplier
    ? supplier.paymentTermsDays
      ? `Leave empty: due ${supplier.paymentTermsDays} days after delivery`
      : "Leave empty: due on delivery (cash terms)"
    : undefined;

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        {/* Supplier & dates */}
        <div className="admin-card p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Supplier">
              <SupplierPicker value={supplier} onChange={setSupplier} />
            </Field>
            {supplier && (
              <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm flex items-center justify-between gap-3 self-end">
                <span className="text-slate-500">
                  {supplier.paymentTermsDays ? `Net ${supplier.paymentTermsDays} days` : "Cash on delivery"}
                  {supplier.vatNumber ? ` · VAT ${supplier.vatNumber}` : vatOn ? " · no VAT number" : ""}
                </span>
                <span className="text-right">
                  <span className="block text-[11px] text-slate-400">Balance</span>
                  <BalanceText value={supplier.balance} />
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Order date">
              <input type="date" className="admin-input" value={f.orderDate} onChange={(e) => set("orderDate", e.target.value)} />
            </Field>
            <Field label="Expected delivery">
              <input type="date" className="admin-input" value={f.expectedDate} onChange={(e) => set("expectedDate", e.target.value)} />
            </Field>
            <Field label="Payment due" hint={f.dueDate ? undefined : termsHint}>
              <input type="date" className="admin-input" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </Field>
            <Field label="Supplier invoice no.">
              <input className="admin-input" value={f.supplierReference} onChange={(e) => set("supplierReference", e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Invoice date" hint="Used for the VAT return">
              <input type="date" className="admin-input" value={f.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} />
            </Field>
          </div>
          {vatOn && supplier && !supplier.vatNumber && lines.some((l) => n(l.taxRate) > 0) && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <LuTriangleAlert size={14} /> This supplier has no VAT number on file. Input VAT on their invoices can&apos;t be reclaimed until you add it.
            </p>
          )}
        </div>

        {/* Lines */}
        <div className="admin-card">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1 min-w-0">
              <ItemSearch supplierId={supplier?.id} onPick={(r) => addRow(r)} autoFocus={!editing} />
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setReorderOpen(true)} className="admin-btn admin-btn-secondary" title="Items at or below their low-stock alert">
                <LuListPlus size={15} /> Low stock
              </button>
              <button type="button" onClick={addCustom} className="admin-btn admin-btn-secondary" title="Packaging, services … (no stock)">
                <LuFileText size={15} /> Other line
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 border-b border-slate-100 bg-slate-50/60">
            <input type="checkbox" className="rounded" checked={f.pricesIncludeTax} onChange={(e) => set("pricesIncludeTax", e.target.checked)} />
            Unit costs include VAT (as printed on the supplier&apos;s invoice)
          </label>
          {lines.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-slate-400 text-center px-6">
              <LuPackage size={32} className="mb-2 text-slate-300" />
              <p className="font-medium text-slate-500">No items yet</p>
              <p className="text-sm mt-1">Scan or search products, pick from low-stock suggestions, or add another line.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right w-20">On hand</th>
                    <th className="text-right w-24">Qty</th>
                    <th className="text-right w-32">Unit cost{f.pricesIncludeTax ? " (incl.)" : ""}</th>
                    <th className="text-right w-20">Disc %</th>
                    <th className="text-right w-20">VAT %</th>
                    <th className="text-right">Net</th>
                    <th className="text-right" title="Per-unit cost into stock: net of discounts plus share of freight/charges">Landed / unit</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const c = calc.lines[i];
                    return (
                      <tr key={l.uid}>
                        <td className="min-w-[220px]">
                          {l.productId ? (
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                {l.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={l.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <LuPackage size={15} className="text-slate-300" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate">{l.nameEn}</p>
                                <p className="text-xs text-slate-500 truncate">{[l.variantLabel || "Standard", l.barcode || l.sku].filter(Boolean).join(" · ")}</p>
                                {l.costHint && <p className="text-[11px] text-slate-400 truncate">{l.costHint}</p>}
                              </div>
                            </div>
                          ) : (
                            <input
                              className="admin-input !py-1.5"
                              value={l.nameEn}
                              onChange={(e) => setLine(l.uid, { nameEn: e.target.value })}
                              placeholder="Description (no stock)"
                            />
                          )}
                        </td>
                        <td className="text-right tabular-nums text-slate-500">{l.productId ? (l.onHand ?? "-") : "-"}</td>
                        <td className="text-right">
                          <input type="number" min="1" step="1" inputMode="numeric" className="admin-input !py-1.5 text-right" value={l.quantity} onChange={(e) => setLine(l.uid, { quantity: e.target.value })} />
                        </td>
                        <td className="text-right">
                          <input type="number" min="0" step="0.001" inputMode="decimal" className="admin-input !py-1.5 text-right" value={l.unitCost} placeholder="0.000" onChange={(e) => setLine(l.uid, { unitCost: e.target.value })} />
                        </td>
                        <td className="text-right">
                          <input type="number" min="0" max="100" step="0.01" inputMode="decimal" className="admin-input !py-1.5 text-right" value={l.discountPct} placeholder="0" onChange={(e) => setLine(l.uid, { discountPct: e.target.value })} />
                        </td>
                        <td className="text-right">
                          <input type="number" min="0" max="100" step="0.01" inputMode="decimal" className="admin-input !py-1.5 text-right" value={l.taxRate} onChange={(e) => setLine(l.uid, { taxRate: e.target.value, taxCode: null })} />
                        </td>
                        <td className="text-right tabular-nums">
                          {fmt3(c?.net ?? 0)}
                          {(c?.tax ?? 0) > 0 && <span className="block text-[11px] text-slate-400">+{fmt3(c.tax)} VAT</span>}
                        </td>
                        <td className="text-right tabular-nums text-slate-600">{l.productId ? fmt3(c?.landedUnitCost ?? 0) : "-"}</td>
                        <td>
                          <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.uid !== l.uid))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove line">
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

        <div className="admin-card p-5 grid md:grid-cols-2 gap-5">
          <Field label="Notes" hint="Printed on the purchase order">
            <textarea className="admin-input min-h-[96px]" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Delivery instructions, terms …" />
          </Field>
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">Attachments</span>
            <Attachments value={attachments} onChange={setAttachments} canEdit />
          </div>
        </div>
      </div>

      {/* Totals & actions */}
      <div className="space-y-4 xl:sticky xl:top-4">
        <div className="admin-card p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <LuClipboardCheck size={18} /> {editing ? `Edit ${initial.number}` : "Order summary"}
          </h3>
          <dl className="text-sm space-y-2">
            <Row label={`Items · ${lines.length} lines · ${units} units`} value={fmt3(calc.subtotal)} />
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Order discount</dt>
              <input type="number" min="0" step="0.001" className="admin-input !py-1 !w-28 text-right" value={f.discount} placeholder="0.000" onChange={(e) => set("discount", e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Freight / shipping</dt>
              <input type="number" min="0" step="0.001" className="admin-input !py-1 !w-28 text-right" value={f.shippingCost} placeholder="0.000" onChange={(e) => set("shippingCost", e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Customs / other charges</dt>
              <input type="number" min="0" step="0.001" className="admin-input !py-1 !w-28 text-right" value={f.otherCharges} placeholder="0.000" onChange={(e) => set("otherCharges", e.target.value)} />
            </div>
            <div className="border-t border-slate-100 pt-2 space-y-2">
              <Row label="Net (excl. VAT)" value={fmt3(calc.netTotal)} />
              <Row label="VAT" value={fmt3(calc.taxTotal)} />
              {calc.shippingCost + calc.otherCharges > 0 && <Row label="Freight & charges" value={fmt3(calc.shippingCost + calc.otherCharges)} />}
            </div>
            <div className="flex justify-between items-baseline border-t border-slate-200 pt-2">
              <dt className="font-semibold text-slate-800">Total</dt>
              <dd className="text-xl font-bold text-slate-900 tabular-nums">{fmt3(calc.total)} OMR</dd>
            </div>
          </dl>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Freight and charges are spread over the items into their landed cost{vatOn ? "; VAT is reclaimable and not part of stock cost" : "; VAT is included in stock cost because VAT is switched off"}.
          </p>
        </div>

        <div className="admin-card p-5 space-y-3">
          {err && (
            <p className="text-sm text-rose-600 flex items-start gap-1.5">
              <LuCircleAlert size={16} className="mt-0.5 shrink-0" /> {err}
            </p>
          )}
          {editing ? (
            <>
              <button onClick={() => save("save")} disabled={!!saving} className="admin-btn admin-btn-primary w-full !py-2.5">
                <LuSave size={16} /> {saving ? "Saving…" : "Save changes"}
              </button>
              <button onClick={onCancel ?? (() => router.back())} disabled={!!saving} className="admin-btn admin-btn-secondary w-full">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => save("order")} disabled={!!saving} className="admin-btn admin-btn-primary w-full !py-2.5">
                <LuSend size={16} /> {saving === "order" ? "Placing…" : "Place order with supplier"}
              </button>
              <button onClick={() => setReceiveOpen(true)} disabled={!!saving} className="admin-btn admin-btn-secondary w-full !py-2.5">
                <LuPackageCheck size={16} /> Bought &amp; received now
              </button>
              <button onClick={() => save("draft")} disabled={!!saving} className="admin-btn admin-btn-secondary w-full">
                <LuSave size={16} /> {saving === "draft" ? "Saving…" : "Save as draft"}
              </button>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                A placed order counts as money owed to the supplier. Stock goes up when goods are received, all at once or in several deliveries.
              </p>
            </>
          )}
        </div>
      </div>

      <ReorderModal
        open={reorderOpen}
        supplierId={supplier?.id ?? null}
        onClose={() => setReorderOpen(false)}
        onAdd={(rows) => {
          rows.forEach(({ row, qty }) => addRow(row, qty));
          setReorderOpen(false);
          toast.success(`${rows.length} item${rows.length === 1 ? "" : "s"} added`);
        }}
      />

      <AdminModal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title="Bought & received now"
        className="!max-w-lg"
        footer={
          <>
            <button onClick={() => setReceiveOpen(false)} className="admin-btn admin-btn-secondary">Cancel</button>
            <button
              onClick={() => {
                setReceiveOpen(false);
                save("receive");
              }}
              className="admin-btn admin-btn-primary"
            >
              <LuPackageCheck size={15} /> Receive {units} unit{units === 1 ? "" : "s"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">
            The order is placed and every line is received into stock straight away, for goods bought on the spot. Stock goes up by {units} unit{units === 1 ? "" : "s"} and each product&apos;s cost moves to the weighted-average landed cost.
          </p>
          {perms.pay ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <label className="flex items-center gap-2 font-medium text-slate-700">
                <input type="checkbox" className="rounded" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} /> Paid now
              </label>
              {payNow && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount">
                    <input type="number" min="0" step="0.001" className="admin-input text-right" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </Field>
                  <Field label="Method">
                    <select className="admin-input admin-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {PAYMENT_METHOD_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>{m.en}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Reference" className="col-span-2">
                    <input className="admin-input" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Optional" />
                  </Field>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Payments are recorded by staff with the supplier-payments permission.</p>
          )}
        </div>
      </AdminModal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-800">{value}</dd>
    </div>
  );
}

/** Low-stock reorder suggestions — items last bought from this supplier first. */
function ReorderModal({
  open,
  supplierId,
  onClose,
  onAdd,
}: {
  open: boolean;
  supplierId: string | null;
  onClose: () => void;
  onAdd: (rows: { row: LookupRow; qty: number }[]) => void;
}) {
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [onlyThis, setOnlyThis] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPicked({});
    const p = new URLSearchParams({ lowStock: "true" });
    if (supplierId) p.set("supplierId", supplierId);
    api<LookupRow[]>(`/api/purchases/lookup?${p}`).then((d) => {
      setRows(d.data ?? []);
      setLoading(false);
    });
  }, [open, supplierId]);

  const shown = onlyThis && supplierId ? rows.filter((r) => r.lastSupplier?.id === supplierId) : rows;
  const chosen = Object.entries(picked).filter(([, q]) => parseInt(q) > 0);

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Low-stock reorder suggestions"
      className="!max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Close</button>
          <button
            disabled={chosen.length === 0}
            onClick={() => onAdd(chosen.map(([key, q]) => ({ row: rows.find((r) => r.key === key)!, qty: parseInt(q) })).filter((x) => x.row))}
            className="admin-btn admin-btn-primary disabled:opacity-40"
          >
            Add {chosen.length} item{chosen.length === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-slate-500 py-10">Nothing is at or below its low-stock alert. 🎉</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {supplierId ? (
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="rounded" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} /> Only items last bought from this supplier
              </label>
            ) : (
              <span className="text-slate-500">Choose a supplier first to see what you last bought from them.</span>
            )}
            <button
              type="button"
              onClick={() => setPicked(Object.fromEntries(shown.map((r) => [r.key, String(r.suggestedQty)])))}
              className="text-indigo-600 hover:underline text-sm"
            >
              Select all suggested
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">On hand</th>
                  <th className="text-right">Alert at</th>
                  <th>Last bought</th>
                  <th className="text-right w-28">Order qty</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <p className="font-medium text-slate-800">{r.nameEn}</p>
                      <p className="text-xs text-slate-500">{r.variantLabel || "Standard"}</p>
                    </td>
                    <td className={`text-right tabular-nums font-semibold ${(r.onHand ?? 0) <= 0 ? "text-rose-600" : "text-amber-600"}`}>{r.onHand ?? 0}</td>
                    <td className="text-right tabular-nums text-slate-500">{r.lowStockAlert ?? "-"}</td>
                    <td className="text-xs text-slate-500">
                      {r.lastCost != null ? (
                        <>
                          {fmt3(r.lastCost)} · {fmtDate(r.lastCostDate)}
                          {r.lastSupplier && <span className="block">{r.lastSupplier.nameEn}</span>}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        min="0"
                        className="admin-input !py-1 text-right"
                        value={picked[r.key] ?? ""}
                        placeholder={String(r.suggestedQty)}
                        onChange={(e) => setPicked((p) => ({ ...p, [r.key]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminModal>
  );
}
