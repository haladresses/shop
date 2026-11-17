"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LuBoxes,
  LuCircleAlert,
  LuFilePlus2,
  LuImagePlus,
  LuLoaderCircle,
  LuPackageCheck,
  LuPaperclip,
  LuScanBarcode,
  LuSend,
  LuSparkles,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { calculatePurchase } from "@/lib/purchaseCalc";
import { Field, PAYMENT_METHOD_OPTIONS, SupplierPicker, api, fmt3, fmtDate, todayKey, usePurchasingPerms, type SupplierOption } from "./shared";

type RateInfo = { id: string | null; code: string; nameEn: string; rate: number; type: string };

type LookupRow = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  variantLabel: string | null;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
  isActive: boolean;
  onHand: number | null;
  lowStockAlert: number | null;
  costPrice: number | null;
  sellPrice: number;
  lastCost: number | null;
  lastCostDate: string | null;
  lastSupplier: { id: string; nameEn: string } | null;
  suggestedQty: number;
  tax: RateInfo;
};

export type EditorLine = {
  key: string;
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
  sellPrice: number | null;
  quantity: string;
  unitCost: string;
  discountPct: string;
  taxRate: string;
  taxCode: string | null;
};

export type EditorInitial = {
  id?: string;
  supplier: SupplierOption | null;
  orderDate: string;
  expectedDate: string;
  dueDate: string;
  supplierReference: string;
  invoiceDate: string;
  pricesIncludeTax: boolean;
  discount: string;
  shippingCost: string;
  otherCharges: string;
  notes: string;
  attachments: { url: string; name: string }[];
  lines: EditorLine[];
};

export const EMPTY_EDITOR: EditorInitial = {
  supplier: null,
  orderDate: "",
  expectedDate: "",
  dueDate: "",
  supplierReference: "",
  invoiceDate: "",
  pricesIncludeTax: false,
  discount: "",
  shippingCost: "",
  otherCharges: "",
  notes: "",
  attachments: [],
  lines: [],
};

type PoForEditor = {
  id: string;
  orderDate: string | null;
  expectedDate: string | null;
  dueDate: string | null;
  supplierReference: string | null;
  invoiceDate: string | null;
  pricesIncludeTax: boolean;
  discount: number;
  shippingCost: number;
  otherCharges: number;
  notes: string | null;
  attachments: { url: string; name: string }[];
  supplier: { id: string; code: string; nameEn: string; nameAr: string | null; paymentTermsDays: number; balance: number; isActive: boolean };
  items: {
    id: string;
    productId: string | null;
    variantId: string | null;
    nameEn: string;
    nameAr: string | null;
    variantLabel: string | null;
    sku: string | null;
    barcode: string | null;
    imageUrl: string | null;
    onHand: number | null;
    quantity: number;
    unitCost: number;
    discountPct: number;
    taxRate: number;
    taxCode: string | null;
  }[];
};

/** Editor state from a saved order — to edit it, or (duplicate) to start a new one like it. */
export function editorFromPo(po: PoForEditor, duplicate: boolean): EditorInitial {
  const s = (v: number) => (v ? String(v) : "");
  return {
    id: duplicate ? undefined : po.id,
    supplier: po.supplier.isActive || !duplicate ? po.supplier : null,
    orderDate: duplicate ? "" : po.orderDate ?? "",
    expectedDate: duplicate ? "" : po.expectedDate ?? "",
    dueDate: duplicate ? "" : po.dueDate ?? "",
    supplierReference: duplicate ? "" : po.supplierReference ?? "",
    invoiceDate: duplicate ? "" : po.invoiceDate ?? "",
    pricesIncludeTax: po.pricesIncludeTax,
    discount: duplicate ? "" : s(po.discount),
    shippingCost: duplicate ? "" : s(po.shippingCost),
    otherCharges: duplicate ? "" : s(po.otherCharges),
    notes: duplicate ? "" : po.notes ?? "",
    attachments: duplicate ? [] : po.attachments,
    lines: po.items
      .filter((i) => i.quantity > 0)
      .map((i) => ({
        key: `${duplicate ? "d" : "e"}${i.id}`,
        id: duplicate ? undefined : i.id,
        productId: i.productId,
        variantId: i.variantId,
        nameEn: i.nameEn,
        nameAr: i.nameAr,
        variantLabel: i.variantLabel,
        sku: i.sku,
        barcode: i.barcode,
        imageUrl: i.imageUrl,
        onHand: i.onHand,
        sellPrice: null,
        quantity: String(i.quantity),
        unitCost: String(i.unitCost),
        discountPct: s(i.discountPct),
        taxRate: String(i.taxRate),
        taxCode: i.taxCode,
      })),
  };
}

let keySeq = 0;
const newKey = () => `l${Date.now().toString(36)}${(keySeq++).toString(36)}`;
const n = (v: string) => parseFloat(v) || 0;

type TaxSettings = { enabled: boolean; defaultRate?: RateInfo };

export default function PurchaseOrderForm({ initial }: { initial: EditorInitial }) {
  const router = useRouter();
  const perms = usePurchasingPerms();
  const editing = !!initial.id;

  const [supplier, setSupplier] = useState<SupplierOption | null>(initial.supplier);
  const [orderDate, setOrderDate] = useState(initial.orderDate || todayKey());
  const [expectedDate, setExpectedDate] = useState(initial.expectedDate);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [supplierReference, setSupplierReference] = useState(initial.supplierReference);
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(initial.pricesIncludeTax);
  const [discount, setDiscount] = useState(initial.discount);
  const [shippingCost, setShippingCost] = useState(initial.shippingCost);
  const [otherCharges, setOtherCharges] = useState(initial.otherCharges);
  const [notes, setNotes] = useState(initial.notes);
  const [attachments, setAttachments] = useState(initial.attachments);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines);
  const [tax, setTax] = useState<TaxSettings>({ enabled: false });

  const [q, setQ] = useState("");
  const [results, setResults] = useState<LookupRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [saving, setSaving] = useState<null | "draft" | "order" | "receive" | "save">(null);
  const [err, setErr] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payRef, setPayRef] = useState("");
  const [uploading, setUploading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<TaxSettings>("/api/tax/settings").then((d) => d.data && setTax(d.data));
  }, []);

  // Live search (debounced).
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api<LookupRow[]>(`/api/purchases/lookup?q=${encodeURIComponent(term)}${supplier ? `&supplierId=${supplier.id}` : ""}`).then((d) => {
        setResults(d.data ?? []);
        setSearching(false);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q, supplier]);

  const defaultCost = (r: LookupRow) => r.lastCost ?? r.costPrice ?? 0;

  const addRow = (r: LookupRow, qty = 1) => {
    setLines((prev) => {
      const ex = prev.find((l) => (l.variantId ?? l.productId) === (r.variantId ?? r.productId) && l.productId === r.productId);
      if (ex) return prev.map((l) => (l === ex ? { ...l, quantity: String(n(l.quantity) + qty) } : l));
      return [
        ...prev,
        {
          key: newKey(),
          productId: r.productId,
          variantId: r.variantId,
          nameEn: r.nameEn,
          nameAr: r.nameAr,
          variantLabel: r.variantLabel,
          sku: r.sku,
          barcode: r.barcode,
          imageUrl: r.imageUrl,
          onHand: r.onHand,
          sellPrice: r.sellPrice,
          quantity: String(qty),
          unitCost: String(defaultCost(r)),
          discountPct: "",
          taxRate: tax.enabled ? String(r.tax?.rate ?? 0) : "0",
          taxCode: tax.enabled ? r.tax?.code || null : null,
        },
      ];
    });
    setQ("");
    setResults([]);
    searchRef.current?.focus();
  };

  // A scanner types the code + Enter: add the exact match straight away.
  const onScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const exact = results.filter((r) => r.barcode === term || r.sku === term);
    if (exact.length === 1) return addRow(exact[0]);
    if (results.length === 1) return addRow(results[0]);
    const d = await api<LookupRow[]>(`/api/purchases/lookup?barcode=${encodeURIComponent(term)}${supplier ? `&supplierId=${supplier.id}` : ""}`);
    const rows = d.data ?? [];
    if (rows.length === 1) addRow(rows[0]);
    else if (rows.length === 0) toast.error(`Nothing found for “${term}”`);
    else setResults(rows);
  };

  const addFreeLine = () =>
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        productId: null,
        variantId: null,
        nameEn: "",
        nameAr: null,
        variantLabel: null,
        sku: null,
        barcode: null,
        imageUrl: null,
        onHand: null,
        sellPrice: null,
        quantity: "1",
        unitCost: "",
        discountPct: "",
        taxRate: tax.enabled ? String(tax.defaultRate?.rate ?? 0) : "0",
        taxCode: tax.enabled ? tax.defaultRate?.code || null : null,
      },
    ]);

  const setLine = (key: string, patch: Partial<EditorLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const calc = useMemo(
    () =>
      calculatePurchase({
        lines: lines.map((l) => ({ quantity: Math.max(0, Math.floor(n(l.quantity))), unitCost: n(l.unitCost), discountPct: n(l.discountPct), taxRate: n(l.taxRate) })),
        pricesIncludeTax,
        discount: n(discount),
        shippingCost: n(shippingCost),
        otherCharges: n(otherCharges),
        reclaimTax: tax.enabled,
      }),
    [lines, pricesIncludeTax, discount, shippingCost, otherCharges, tax.enabled],
  );
  const units = lines.reduce((s, l) => s + Math.max(0, Math.floor(n(l.quantity))), 0);

  useEffect(() => {
    if (payNow && !payAmount) setPayAmount(String(calc.total));
  }, [payNow, payAmount, calc.total]);

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!d.success) toast.error(d.error || "Upload failed");
      else setAttachments((a) => [...a, { url: d.data.url, name: file.name }]);
    } catch {
      toast.error("Upload failed");
    }
    setUploading(false);
  };

  const validate = (): string | null => {
    if (!supplier) return "Choose a supplier.";
    if (lines.length === 0) return "Add at least one item.";
    for (const [i, l] of lines.entries()) {
      if (!l.nameEn.trim()) return `Line ${i + 1} needs a description.`;
      if (Math.floor(n(l.quantity)) < 1) return `Line ${i + 1}: quantity must be at least 1.`;
      if (n(l.unitCost) < 0) return `Line ${i + 1}: unit cost can't be negative.`;
    }
    return null;
  };

  const body = () => ({
    supplierId: supplier!.id,
    supplierReference: supplierReference || null,
    invoiceDate: invoiceDate || null,
    orderDate,
    expectedDate: expectedDate || null,
    dueDate: dueDate || null,
    pricesIncludeTax,
    discount: n(discount),
    shippingCost: n(shippingCost),
    otherCharges: n(otherCharges),
    notes: notes || null,
    attachments,
    items: lines.map((l) => ({
      ...(l.id ? { id: l.id } : {}),
      productId: l.productId,
      variantId: l.variantId,
      nameEn: l.nameEn.trim(),
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
    if (v) return setErr(v);
    setErr("");
    setSaving(mode);
    if (editing) {
      const d = await api(`/api/purchases/${initial.id}`, { method: "PATCH", body: body() });
      setSaving(null);
      if (!d.success) return setErr(d.error || "Could not save the order.");
      toast.success("Purchase order saved");
      router.push(`/admin/purchases/${initial.id}`);
      return;
    }
    const d = await api<{ id: string; number: string; receiptNumber: string | null; paymentNumber: string | null }>("/api/purchases", {
      body: {
        ...body(),
        mode,
        payment: mode !== "draft" && payNow && n(payAmount) > 0 ? { amount: n(payAmount), method: payMethod, reference: payRef || null } : null,
      },
    });
    setSaving(null);
    if (!d.success || !d.data) return setErr(d.error || "Could not create the order.");
    const msg =
      mode === "receive"
        ? `${d.data.number} received into stock${d.data.paymentNumber ? " and paid" : ""}`
        : mode === "order"
          ? `${d.data.number} placed with the supplier`
          : `Draft ${d.data.number} saved`;
    toast.success(msg);
    router.push(`/admin/purchases/${d.data.id}${mode === "receive" ? "?received=1" : ""}`);
  };

  const canPay = perms.pay;

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Header */}
        <div className="lg:col-span-2 admin-card p-5 space-y-4 !overflow-visible">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Supplier">
              <SupplierPicker value={supplier} onChange={setSupplier} />
              {supplier && (
                <span className="block text-xs text-slate-500 mt-1">
                  {supplier.paymentTermsDays ? `Net ${supplier.paymentTermsDays} days` : "Cash on delivery"}
                  {" · "}
                  {supplier.balance > 0.0005 ? <span className="text-rose-600">you owe {fmt3(supplier.balance)} OMR</span> : supplier.balance < -0.0005 ? <span className="text-emerald-600">credit {fmt3(-supplier.balance)} OMR</span> : "settled"}
                </span>
              )}
            </Field>
            <Field label="Order date">
              <input type="date" className="admin-input" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </Field>
            <Field label="Expected delivery">
              <input type="date" className="admin-input" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </Field>
            <Field label="Payment due" hint="Leave empty: it's set from the supplier's terms when the goods arrive">
              <input type="date" className="admin-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Supplier invoice no.">
              <input className="admin-input" value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} placeholder="Their bill / invoice number" />
            </Field>
            <Field label="Supplier invoice date" hint="Used for the VAT return (input VAT)">
              <input type="date" className="admin-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={pricesIncludeTax} onChange={(e) => setPricesIncludeTax(e.target.checked)} className="rounded mt-0.5" />
            <span>
              Unit costs include VAT
              <span className="block text-xs text-slate-400">Tick when the supplier&apos;s prices already have VAT in them.</span>
            </span>
          </label>
        </div>

        {/* Attachments & notes */}
        <div className="admin-card p-5 space-y-3">
          <Field label="Notes">
            <textarea className="admin-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, colours to check…" />
          </Field>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5"><LuPaperclip size={14} /> Invoice / delivery note photos</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={a.url} className="relative group">
                  <a href={a.url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  </a>
                  <button type="button" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow ring-1 ring-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600" aria-label="Remove">
                    <LuX size={12} />
                  </button>
                </div>
              ))}
              <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-slate-300 hover:text-slate-600 cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? <LuLoaderCircle className="animate-spin" /> : <LuImagePlus size={20} />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="admin-card !overflow-visible">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100">
          <form onSubmit={onScan} className="relative flex-1 min-w-[240px]">
            <LuScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Scan a barcode or search products to add"
              className="admin-input !py-2.5 !pl-10"
            />
            {searching && <LuLoaderCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
            {results.length > 0 && (
              <ul className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-lg ring-1 ring-slate-200 max-h-80 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => addRow(r)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                      <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.imageUrl && <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-800 truncate">{r.nameEn}{!r.isActive && <span className="ml-2 text-[11px] text-amber-600">inactive</span>}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          {[r.variantLabel || "Standard", r.barcode, r.lastCost != null ? `last ${fmt3(r.lastCost)}${r.lastSupplier ? ` from ${r.lastSupplier.nameEn}` : ""}` : r.costPrice != null ? `cost ${fmt3(r.costPrice)}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{r.onHand == null ? "not tracked" : `${r.onHand} on hand`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
          <button type="button" onClick={() => setReorderOpen(true)} className="admin-btn admin-btn-secondary"><LuSparkles size={15} /> Low-stock suggestions</button>
          <button type="button" onClick={addFreeLine} className="admin-btn admin-btn-secondary"><LuFilePlus2 size={15} /> Non-stock line</button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-slate-400">
            <LuBoxes size={32} className="mb-2" />
            <p>Scan or search items to add them to the order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">On hand</th>
                  <th className="text-right w-24">Quantity</th>
                  <th className="text-right w-32">Unit cost{pricesIncludeTax ? " (incl.)" : ""}</th>
                  <th className="text-right w-20">Disc %</th>
                  <th className="text-right w-20">VAT %</th>
                  <th className="text-right">Net</th>
                  <th className="text-right" title="Net cost per unit incl. share of freight/charges: goes into stock value">Landed / unit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const c = calc.lines[i];
                  const margin = l.sellPrice && c?.landedUnitCost ? ((l.sellPrice - c.landedUnitCost) / l.sellPrice) * 100 : null;
                  return (
                    <tr key={l.key}>
                      <td className="min-w-[220px]">
                        {l.productId ? (
                          <div className="flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {l.imageUrl && <img src={l.imageUrl} alt="" className="w-full h-full object-cover" />}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{l.nameEn}</p>
                              <p className="text-xs text-slate-500 truncate">{[l.variantLabel || "Standard", l.sku].filter(Boolean).join(" · ")}</p>
                            </div>
                          </div>
                        ) : (
                          <input className="admin-input !py-1.5" value={l.nameEn} onChange={(e) => setLine(l.key, { nameEn: e.target.value })} placeholder="Description (e.g. gift boxes)" />
                        )}
                      </td>
                      <td className="text-right tabular-nums text-slate-500 text-sm">
                        {l.productId ? (l.onHand == null ? <span className="text-[11px] text-sky-600" title="This product's stock starts being tracked when this delivery arrives">new</span> : l.onHand) : "-"}
                      </td>
                      <td className="text-right">
                        <input type="number" min="1" inputMode="numeric" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} className="admin-input !py-1 text-right !w-20" />
                      </td>
                      <td className="text-right">
                        <input type="number" min="0" step="0.001" inputMode="decimal" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} className="admin-input !py-1 text-right !w-28" />
                      </td>
                      <td className="text-right">
                        <input type="number" min="0" max="100" step="0.01" value={l.discountPct} placeholder="0" onChange={(e) => setLine(l.key, { discountPct: e.target.value })} className="admin-input !py-1 text-right !w-16" />
                      </td>
                      <td className="text-right">
                        <input type="number" min="0" max="100" step="0.01" value={l.taxRate} onChange={(e) => setLine(l.key, { taxRate: e.target.value })} className="admin-input !py-1 text-right !w-16" />
                      </td>
                      <td className="text-right tabular-nums">{fmt3(c?.net ?? 0)}</td>
                      <td className="text-right tabular-nums text-sm">
                        {fmt3(c?.landedUnitCost ?? 0)}
                        {margin != null && <span className={`block text-[11px] ${margin < 20 ? "text-amber-600" : "text-slate-400"}`}>{margin.toFixed(0)}% margin</span>}
                      </td>
                      <td>
                        <button type="button" onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove line">
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

      {/* Totals & actions */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {!tax.enabled && lines.some((l) => n(l.taxRate) > 0) && (
            <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
              <LuCircleAlert size={16} className="mt-0.5 shrink-0" />
              VAT is switched off for your store, so the VAT on this purchase can&apos;t be reclaimed. It&apos;s added to the products&apos; cost instead.
            </p>
          )}
        </div>
        <div className="admin-card p-5 space-y-2.5 text-sm">
          <Row label={`Subtotal · ${units} unit${units === 1 ? "" : "s"}`} value={fmt3(calc.subtotal)} />
          <MoneyRow label="Order discount" value={discount} onChange={setDiscount} hint={pricesIncludeTax ? "incl. VAT" : "excl. VAT"} />
          <MoneyRow label="Freight" value={shippingCost} onChange={setShippingCost} hint="added to stock cost" />
          <MoneyRow label="Other charges" value={otherCharges} onChange={setOtherCharges} hint="customs, clearance…" />
          <Row label="VAT" value={fmt3(calc.taxTotal)} />
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-800">Total</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">{fmt3(calc.total)} OMR</span>
          </div>

          {!editing && canPay && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="rounded" />
                Paid now (with “Place” or “Receive”)
              </label>
              {payNow && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min="0" step="0.001" className="admin-input text-right" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  <select className="admin-input admin-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAYMENT_METHOD_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.en}</option>
                    ))}
                  </select>
                  <input className="admin-input col-span-2" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Reference (optional)" />
                </div>
              )}
            </div>
          )}

          {err && <p className="text-sm text-rose-600 pt-1">{err}</p>}
          <div className="pt-2 space-y-2">
            {editing ? (
              <>
                <button onClick={() => save("save")} disabled={!!saving} className="admin-btn admin-btn-primary w-full justify-center">{saving ? "Saving…" : "Save changes"}</button>
                <Link href={`/admin/purchases/${initial.id}`} className="admin-btn admin-btn-secondary w-full justify-center">Cancel</Link>
              </>
            ) : (
              <>
                <button onClick={() => save("order")} disabled={!!saving} className="admin-btn admin-btn-primary w-full justify-center">
                  <LuSend size={15} /> {saving === "order" ? "Placing…" : "Place order"}
                </button>
                {perms.receive && (
                  <button onClick={() => save("receive")} disabled={!!saving} className="admin-btn w-full justify-center bg-emerald-600 text-white hover:bg-emerald-700" title="For goods bought and collected right away">
                    <LuPackageCheck size={15} /> {saving === "receive" ? "Receiving…" : "Place & receive now"}
                  </button>
                )}
                <button onClick={() => save("draft")} disabled={!!saving} className="admin-btn admin-btn-secondary w-full justify-center">{saving === "draft" ? "Saving…" : "Save as draft"}</button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">Stock only goes up when goods are received. Each product&apos;s purchase price then moves to the weighted-average landed cost.</p>
        </div>
      </div>

      <ReorderModal
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        supplier={supplier}
        onAdd={(rows) => {
          rows.forEach(({ row, qty }) => addRow(row, qty));
          setReorderOpen(false);
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums font-medium text-slate-800">{value}</span>
    </div>
  );
}

function MoneyRow({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-slate-500">
        {label}
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </span>
      <input type="number" min="0" step="0.001" inputMode="decimal" value={value} placeholder="0.000" onChange={(e) => onChange(e.target.value)} className="admin-input !py-1 text-right !w-28" />
    </div>
  );
}

/** Low/out-of-stock items, with what was last paid — pick and add in one go. */
function ReorderModal({
  open,
  onClose,
  supplier,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  supplier: SupplierOption | null;
  onAdd: (rows: { row: LookupRow; qty: number }[]) => void;
}) {
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyThis, setOnlyThis] = useState(true);
  const [picked, setPicked] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPicked({});
    api<LookupRow[]>(`/api/purchases/lookup?lowStock=true${supplier ? `&supplierId=${supplier.id}` : ""}`).then((d) => {
      setRows(d.data ?? []);
      setLoading(false);
    });
  }, [open, supplier]);

  const visible = supplier && onlyThis ? rows.filter((r) => r.lastSupplier?.id === supplier.id) : rows;
  const count = Object.values(picked).filter((v) => n(v) > 0).length;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Low-stock suggestions"
      className="!max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button
            disabled={count === 0}
            onClick={() =>
              onAdd(
                rows
                  .filter((r) => n(picked[r.key] ?? "") > 0)
                  .map((r) => ({ row: r, qty: Math.floor(n(picked[r.key])) })),
              )
            }
            className="admin-btn admin-btn-primary disabled:opacity-40"
          >
            Add {count} item{count === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      {supplier && (
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
          <input type="checkbox" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} className="rounded" />
          Only items last bought from {supplier.nameEn}
        </label>
      )}
      {loading ? (
        <div className="flex justify-center py-10"><span className="spinner" /></div>
      ) : visible.length === 0 ? (
        <p className="text-center text-slate-400 py-10">{rows.length && onlyThis ? "Nothing low in stock from this supplier. Untick the filter to see everything." : "Nothing is low in stock."}</p>
      ) : (
        <div className="flex justify-end mb-2">
          <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setPicked(Object.fromEntries(visible.map((r) => [r.key, String(r.suggestedQty)])))}>
            Select all with suggested quantities
          </button>
        </div>
      )}
      {!loading && visible.length > 0 && (
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
            {visible.map((r) => (
              <tr key={r.key}>
                <td>
                  <p className="font-medium text-slate-800">{r.nameEn}</p>
                  <p className="text-xs text-slate-500">{r.variantLabel || "Standard"}</p>
                </td>
                <td className={`text-right tabular-nums font-semibold ${(r.onHand ?? 0) <= 0 ? "text-rose-600" : "text-amber-600"}`}>{r.onHand}</td>
                <td className="text-right tabular-nums text-slate-500">{r.lowStockAlert}</td>
                <td className="text-xs text-slate-500">
                  {r.lastCost != null ? `${fmt3(r.lastCost)} · ${fmtDate(r.lastCostDate)}` : "-"}
                  {r.lastSupplier && <span className="block">{r.lastSupplier.nameEn}</span>}
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    min="0"
                    placeholder={String(r.suggestedQty)}
                    value={picked[r.key] ?? ""}
                    onChange={(e) => setPicked({ ...picked, [r.key]: e.target.value })}
                    className="admin-input !py-1 text-right !w-24"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminModal>
  );
}
