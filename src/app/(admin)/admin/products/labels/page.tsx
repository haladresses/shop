"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  LuChevronLeft,
  LuCircleAlert,
  LuLoaderCircle,
  LuMinus,
  LuPackagePlus,
  LuPlus,
  LuPrinter,
  LuSearch,
  LuTrash2,
} from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import { LABEL_LAYOUTS, Label, LabelSheet, type LabelItem, type LabelLayoutId, type LabelOptions } from "./LabelSheet";

type ProductHit = { id: string; nameEn: string; nameAr?: string; basePrice: number | string; salePrice?: number | string | null; images?: { url: string }[] };

type Row = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  variantLabel: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  basePrice: number;
  onHand: number | null;
};

type QueueRow = Row & { copies: number };

const PREFS_KEY = "hala-label-prefs-v1";

function readPrefs(): { layout: LabelLayoutId; opts: Partial<LabelOptions>; useSku: boolean } | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function BarcodeLabelsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><span className="spinner" /></div>}>
      <LabelsView />
    </Suspense>
  );
}

function LabelsView() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<LabelLayoutId>("a4-21");
  const [useSku, setUseSku] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [opts, setOpts] = useState<LabelOptions>({
    showName: true,
    showArabic: true,
    showVariant: true,
    showPrice: true,
    showSku: false,
    showWasPrice: true,
    vatNote: false,
    storeName: "",
  });

  // Remembered printer setup (per browser).
  useEffect(() => {
    const p = readPrefs();
    if (p) {
      if (LABEL_LAYOUTS.some((l) => l.id === p.layout)) setLayoutId(p.layout);
      setOpts((o) => ({ ...o, ...p.opts }));
      setUseSku(!!p.useSku);
    }
    fetch("/api/settings?group=general")
      .then((r) => r.json())
      .then((d) => d.success && setOpts((o) => (o.storeName ? o : { ...o, storeName: d.data.store_name_en || "" })))
      .catch(() => {});
    fetch("/api/tax/settings")
      .then((r) => r.json())
      .then((d) => d.success && setVatEnabled(!!d.data.enabled && !!d.data.pricesIncludeTax))
      .catch(() => {});
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ layout: layoutId, opts, useSku }));
    } catch {
      /* storage blocked — fine */
    }
  }, [layoutId, opts, useSku]);

  const addRows = useCallback((rows: Row[], copiesFor?: (r: Row) => number) => {
    setQueue((prev) => {
      const next = [...prev];
      for (const r of rows) {
        const copies = Math.max(1, copiesFor ? copiesFor(r) : 1);
        const i = next.findIndex((q) => q.key === r.key);
        if (i >= 0) next[i] = { ...next[i], copies: next[i].copies + copies };
        else next.push({ ...r, copies });
      }
      return next;
    });
  }, []);

  const fetchRows = useCallback(async (query: string): Promise<Row[]> => {
    const d = await fetch(`/api/products/labels?${query}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!d?.success) {
      toast.error(d?.error || "Could not load the items");
      return [];
    }
    return d.data as Row[];
  }, []);

  // Prefill: ?items=<variantId>:<qty>,…  (e.g. from a goods receipt) or ?products=<id>,…
  useEffect(() => {
    const items = searchParams.get("items");
    const products = searchParams.get("products");
    if (!items && !products) return;
    (async () => {
      const qty = new Map<string, number>();
      for (const part of (items || "").split(",")) {
        const [id, n] = part.split(":");
        if (id) qty.set(id.trim(), Math.max(1, parseInt(n) || 1));
      }
      const params = new URLSearchParams();
      if (qty.size) params.set("variantIds", Array.from(qty.keys()).join(","));
      if (products) params.set("productIds", products);
      const rows = await fetchRows(params.toString());
      setQueue([]);
      addRows(rows, (r) => qty.get(r.variantId ?? r.productId) ?? 1);
      if (rows.length) toast.success(`${rows.length} item${rows.length === 1 ? "" : "s"} added`);
    })();
  }, [searchParams, fetchRows, addRows]);

  // Product search (debounced).
  useEffect(() => {
    const t = setTimeout(async () => {
      setSearching(true);
      const params = new URLSearchParams({ page: "1", pageSize: "30", search });
      const d = await fetch(`/api/products?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      setHits(d?.success ? d.data : []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const addProduct = async (id: string) => {
    setAdding(id);
    const rows = await fetchRows(`productIds=${id}`);
    addRows(rows);
    setAdding(null);
    if (rows.length === 0) toast.error("Nothing to label for this product");
  };

  const setCopies = (key: string, n: number) =>
    setQueue((q) => q.map((r) => (r.key === key ? { ...r, copies: Math.max(1, Math.min(999, n)) } : r)));

  const layout = LABEL_LAYOUTS.find((l) => l.id === layoutId)!;
  const codeOf = useCallback((r: Row) => r.barcode || (useSku ? r.sku : null), [useSku]);
  const printable = useMemo(() => queue.filter((r) => codeOf(r)), [queue, codeOf]);
  const missing = queue.filter((r) => !codeOf(r));
  const effectiveOpts = { ...opts, vatNote: opts.vatNote && vatEnabled };

  const items: LabelItem[] = useMemo(
    () =>
      printable.flatMap((r) =>
        Array.from({ length: r.copies }, () => ({
          key: r.key,
          nameEn: r.nameEn,
          nameAr: r.nameAr,
          variantLabel: r.variantLabel,
          sku: r.sku,
          barcode: codeOf(r)!,
          price: r.price,
          basePrice: r.basePrice,
        })),
      ),
    [printable, codeOf],
  );

  const print = () => {
    if (items.length === 0) return toast.error("Add items with a barcode first");
    printArea("barcode-labels", { page: layout.page, title: `Labels (${items.length})` });
  };

  const toggle = (k: keyof LabelOptions) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <LuChevronLeft size={16} /> Back to products
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">Barcode Labels</h1>
          <p className="text-sm text-slate-500">Add products, choose how many labels each needs, pick your label stock and print.</p>
        </div>
        <button onClick={print} disabled={items.length === 0} className="admin-btn admin-btn-primary !py-2.5 disabled:opacity-40">
          <LuPrinter size={16} /> Print {items.length} label{items.length === 1 ? "" : "s"}
        </button>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* Queue */}
          <div className="admin-card">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
              <p className="font-semibold text-slate-700">To print ({queue.length})</p>
              {queue.length > 0 && (
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setQueue((q) => q.map((r) => ({ ...r, copies: Math.max(1, r.onHand ?? 1) })))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                    title="One label for every unit on hand"
                  >
                    1 per unit in stock
                  </button>
                  <button onClick={() => setQueue((q) => q.map((r) => ({ ...r, copies: 1 })))} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                    1 each
                  </button>
                  <button onClick={() => setQueue([])} className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">Clear</button>
                </div>
              )}
            </div>
            {queue.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-slate-400 text-sm">
                <LuPackagePlus size={30} className="mb-2" />
                Search for products below and add them here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Barcode</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">In stock</th>
                      <th className="text-center w-36">Copies</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((r) => {
                      const code = codeOf(r);
                      return (
                        <tr key={r.key} className={code ? "" : "bg-amber-50/50"}>
                          <td>
                            <p className="font-medium text-slate-800">{r.nameEn}</p>
                            <p className="text-xs text-slate-500">{r.variantLabel || "Standard"}</p>
                          </td>
                          <td className="font-mono text-xs">
                            {code ? (
                              <>
                                {code}
                                {!r.barcode && <span className="ml-1 text-[10px] text-slate-400">(SKU)</span>}
                              </>
                            ) : (
                              <Link href={`/admin/products/${r.productId}`} className="text-amber-700 hover:underline inline-flex items-center gap-1">
                                <LuCircleAlert size={12} /> No barcode — set one
                              </Link>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{r.price.toFixed(3)}</td>
                          <td className="text-right tabular-nums text-slate-500">{r.onHand ?? "—"}</td>
                          <td>
                            <div className="flex items-center justify-center rounded-lg border border-slate-200 w-fit mx-auto">
                              <button onClick={() => setCopies(r.key, r.copies - 1)} className="w-7 h-7 flex items-center justify-center text-slate-500" aria-label="Fewer"><LuMinus size={13} /></button>
                              <input
                                value={r.copies}
                                onChange={(e) => setCopies(r.key, parseInt(e.target.value) || 1)}
                                inputMode="numeric"
                                className="w-10 text-center text-sm font-semibold bg-transparent focus:outline-none"
                                aria-label="Copies"
                              />
                              <button onClick={() => setCopies(r.key, r.copies + 1)} className="w-7 h-7 flex items-center justify-center text-slate-500" aria-label="More"><LuPlus size={13} /></button>
                            </div>
                          </td>
                          <td>
                            <button onClick={() => setQueue((q) => q.filter((x) => x.key !== r.key))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove">
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
            {missing.length > 0 && (
              <p className="px-4 py-2.5 text-xs text-amber-800 bg-amber-50 border-t border-amber-100">
                {missing.length} item{missing.length === 1 ? " has" : "s have"} no barcode and will be skipped
                {!useSku && " — or switch on “Use SKU when there is no barcode”"}.
              </p>
            )}
          </div>

          {/* Product search */}
          <div className="admin-card">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input className="admin-input pl-9" placeholder="Search products by name, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            {searching && hits.length === 0 ? (
              <div className="flex justify-center py-10"><span className="spinner" /></div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {hits.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.images?.[0]?.url && <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-700 truncate">{p.nameEn}</p>
                      <p className="text-xs text-slate-400">{Number(p.salePrice ?? p.basePrice).toFixed(3)} OMR</p>
                    </div>
                    <button onClick={() => addProduct(p.id)} disabled={adding === p.id} className="admin-btn admin-btn-secondary !py-1.5 text-xs">
                      {adding === p.id ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuPlus size={14} />} Add all options
                    </button>
                  </div>
                ))}
                {hits.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">No products found</p>}
              </div>
            )}
          </div>
        </div>

        {/* Settings + preview */}
        <div className="space-y-4 xl:sticky xl:top-4">
          <div className="admin-card p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Label stock</label>
              <select className="admin-input admin-select" value={layoutId} onChange={(e) => setLayoutId(e.target.value as LabelLayoutId)}>
                {LABEL_LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">{layout.hint}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ["showName", "Name"],
                  ["showArabic", "Arabic name"],
                  ["showVariant", "Colour / size"],
                  ["showPrice", "Price"],
                  ["showWasPrice", "Was-price on sale"],
                  ["showSku", "SKU"],
                ] as [keyof LabelOptions, string][]
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-slate-700">
                  <input type="checkbox" checked={!!opts[k]} onChange={() => toggle(k)} className="rounded" /> {label}
                </label>
              ))}
              {vatEnabled && (
                <label className="flex items-center gap-2 text-slate-700">
                  <input type="checkbox" checked={opts.vatNote} onChange={() => toggle("vatNote")} className="rounded" /> “incl. VAT”
                </label>
              )}
              <label className="flex items-center gap-2 text-slate-700 col-span-2">
                <input type="checkbox" checked={useSku} onChange={() => setUseSku((v) => !v)} className="rounded" /> Use SKU when there is no barcode
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Store name on label</label>
              <input className="admin-input" value={opts.storeName} onChange={(e) => setOpts((o) => ({ ...o, storeName: e.target.value }))} placeholder="Leave empty to hide" />
            </div>
          </div>

          <div className="admin-card p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Preview</p>
            {printable[0] ? (
              <div className="flex justify-center bg-slate-100 rounded-xl p-4">
                <div className="shadow-sm ring-1 ring-slate-200">
                  <Label item={{ ...printable[0], barcode: codeOf(printable[0])! }} layout={layout} opts={effectiveOpts} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">Add an item with a barcode to see a preview.</p>
            )}
            <p className="text-xs text-slate-400 mt-3">
              In the print dialog choose your label printer (or A4 printer), set scale to 100% / “Actual size” and turn margins off for label rolls.
            </p>
          </div>
        </div>
      </div>

      <PrintArea id="barcode-labels">
        <LabelSheet items={items} layout={layout} opts={effectiveOpts} />
      </PrintArea>
    </div>
  );
}
