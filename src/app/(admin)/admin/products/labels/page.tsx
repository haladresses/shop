"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  LuChevronLeft,
  LuCircleAlert,
  LuCopy,
  LuLoaderCircle,
  LuMinus,
  LuPackagePlus,
  LuPencil,
  LuPlus,
  LuPrinter,
  LuRuler,
  LuSave,
  LuSearch,
  LuStar,
  LuTrash2,
  LuWandSparkles,
  LuX,
} from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import BarcodePreview from "@/components/admin/BarcodePreview";
import { printArea } from "@/lib/print";
import {
  BUILT_IN_TEMPLATES,
  labelsPerPage,
  newTemplateFrom,
  pageSize,
  templateProblems,
  type LabelTemplate,
} from "@/lib/labels";
import { LabelPrintJob, PagePreview, type LabelItem, type LabelOptions } from "./LabelSheet";
import TemplateEditor from "./TemplateEditor";
import { productImageUrl } from "@/lib/productImage";

type ProductHit = { id: string; nameEn: string; nameAr?: string; basePrice: number | string; salePrice?: number | string | null; barcode?: string | null; images?: { url: string }[] };

type Row = {
  key: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  variantLabel: string;
  sku: string | null;
  barcode: string | null;
  productBarcode: string | null;
  variantBarcode: string | null;
  price: number;
  basePrice: number;
  onHand: number | null;
};
type QueueRow = Row & { copies: number };
type CodeSource = "product" | "option";

const PREFS_KEY = "hala-label-prefs-v2";
const DEFAULT_OPTS: LabelOptions = {
  showName: true,
  showArabic: true,
  showVariant: true,
  showPrice: true,
  showSku: false,
  showDigits: true,
  showWasPrice: true,
  vatNote: false,
  storeName: "",
};

type Prefs = { templateId?: string; opts?: Partial<LabelOptions>; useSku?: boolean; codeSource?: CodeSource };
function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as Prefs;
  } catch {
    return {};
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
  const [opts, setOpts] = useState<LabelOptions>(DEFAULT_OPTS);
  const [useSku, setUseSku] = useState(false);
  const [codeSource, setCodeSource] = useState<CodeSource>("product");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [catalogMissing, setCatalogMissing] = useState(0);
  // Templates
  const [custom, setCustom] = useState<LabelTemplate[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>("roll-50x30");
  const [draft, setDraft] = useState<LabelTemplate | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);
  // Print run
  const [startAt, setStartAt] = useState(1);
  const [outlines, setOutlines] = useState(false);
  const [modules, setModules] = useState<number | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // ── load settings ──
  useEffect(() => {
    const p = readPrefs();
    if (p.opts) setOpts((o) => ({ ...o, ...p.opts }));
    if (p.useSku) setUseSku(true);
    if (p.codeSource) setCodeSource(p.codeSource);
    fetch("/api/products/labels/templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: LabelTemplate[] = d.success ? d.data.templates : [];
        const def: string | null = d.success ? d.data.defaultId ?? null : null;
        setCustom(list);
        setDefaultId(def);
        const all = [...list, ...BUILT_IN_TEMPLATES];
        const wanted = [p.templateId, def].find((id) => id && all.some((t) => t.id === id));
        if (wanted) setTemplateId(wanted);
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true));
    fetch("/api/settings?group=general")
      .then((r) => r.json())
      .then((d) => d.success && setOpts((o) => (o.storeName || p.opts?.storeName !== undefined ? o : { ...o, storeName: d.data.store_name_en || "" })))
      .catch(() => {});
    fetch("/api/tax/settings")
      .then((r) => r.json())
      .then((d) => d.success && setVatEnabled(!!d.data.enabled && !!d.data.pricesIncludeTax))
      .catch(() => {});
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const ok = !!d.data?.permissions?.includes("admin.products.manage");
        setCanManage(ok);
        if (ok) {
          fetch("/api/products/barcodes", { cache: "no-store" })
            .then((r) => r.json())
            .then((x) => x.success && setCatalogMissing(x.data.missing))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ templateId, opts, useSku, codeSource }));
    } catch {
      /* storage blocked — fine */
    }
  }, [prefsLoaded, templateId, opts, useSku, codeSource]);

  const templates = useMemo(() => [...custom, ...BUILT_IN_TEMPLATES], [custom]);
  const selected = templates.find((t) => t.id === templateId) ?? BUILT_IN_TEMPLATES[0];
  const t = draft ?? selected;

  // ── queue ──
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

  // Prefill: ?items=<variantId>:<qty>,… (e.g. from a goods receipt) or ?products=<id>,…
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

  // Product search — name, SKU or barcode (scan straight into the box).
  useEffect(() => {
    const timer = setTimeout(async () => {
      setSearching(true);
      const params = new URLSearchParams({ page: "1", pageSize: "30", search });
      const d = await fetch(`/api/products?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      setHits(d?.success ? d.data : []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const addProduct = async (id: string) => {
    setAdding(id);
    const rows = await fetchRows(`productIds=${id}`);
    addRows(rows);
    setAdding(null);
    if (rows.length === 0) toast.error("Nothing to label for this product");
  };

  // A scanner sends the code + Enter: add that product straight away.
  const onSearchEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const code = search.trim();
    const exact = hits.find((h) => h.barcode === code) ?? (hits.length === 1 ? hits[0] : null);
    if (exact) {
      addProduct(exact.id);
      setSearch("");
    }
  };

  const setCopies = (key: string, n: number) =>
    setQueue((q) => q.map((r) => (r.key === key ? { ...r, copies: Math.max(1, Math.min(999, n)) } : r)));

  /** The code printed for a row — the product's barcode by default (same everywhere). */
  const codeOf = useCallback(
    (r: Row) =>
      (codeSource === "product" ? r.productBarcode : r.variantBarcode || r.productBarcode) || (useSku ? r.sku : null),
    [codeSource, useSku],
  );
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

  // ── barcode generation (saved on the product) ──
  const applyAssigned = (assigned: { productId: string; variantId: string | null; barcode: string }[]) => {
    const byProduct = new Map(assigned.filter((a) => !a.variantId).map((a) => [a.productId, a.barcode]));
    setQueue((q) =>
      q.map((r) =>
        byProduct.has(r.productId) && !r.productBarcode
          ? { ...r, productBarcode: byProduct.get(r.productId)!, barcode: byProduct.get(r.productId)! }
          : r,
      ),
    );
  };
  const generateFor = async (body: Record<string, unknown>, busyKey: string) => {
    setGenerating(busyKey);
    const d = await fetch("/api/products/barcodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .catch(() => null);
    setGenerating(null);
    if (!d?.success) {
      toast.error(d?.error || "Could not generate barcodes");
      return 0;
    }
    const assigned = d.data.assigned as { productId: string; variantId: string | null; barcode: string }[];
    applyAssigned(assigned);
    const products = assigned.filter((a) => !a.variantId).length;
    setCatalogMissing((n) => Math.max(0, n - products));
    toast.success(products ? `${products} product barcode${products === 1 ? "" : "s"} created and saved` : "Every product already has a barcode");
    return products;
  };
  const generateForRows = (rows: QueueRow[], busyKey: string) =>
    generateFor({ productIds: Array.from(new Set(rows.map((r) => r.productId))) }, busyKey);

  // ── templates ──
  const persistTemplates = async (list: LabelTemplate[], def: string | null) => {
    setSavingTpl(true);
    const d = await fetch("/api/products/labels/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates: list.map(({ builtIn: _b, ...rest }) => (void _b, rest)), defaultId: def }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSavingTpl(false);
    if (!d?.success) {
      toast.error(d?.error || "Could not save the template");
      return false;
    }
    setCustom(d.data.templates);
    setDefaultId(d.data.defaultId ?? null);
    return true;
  };
  const startEditing = () => setDraft(selected.builtIn ? newTemplateFrom(selected, `${selected.name.split(" (")[0]} (custom)`) : { ...selected });
  const saveDraft = async () => {
    if (!draft) return;
    const exists = custom.some((c) => c.id === draft.id);
    const list = exists ? custom.map((c) => (c.id === draft.id ? draft : c)) : [draft, ...custom];
    if (await persistTemplates(list, defaultId)) {
      setTemplateId(draft.id);
      setDraft(null);
      toast.success("Template saved for everyone");
    }
  };
  const deleteTemplate = async () => {
    if (selected.builtIn || !confirm(`Delete the template “${selected.name}”?`)) return;
    if (await persistTemplates(custom.filter((c) => c.id !== selected.id), defaultId === selected.id ? null : defaultId)) {
      setTemplateId(BUILT_IN_TEMPLATES[0].id);
      toast.success("Template deleted");
    }
  };
  const makeDefault = async () => {
    if (await persistTemplates(custom, selected.id)) toast.success("Default template for everyone");
  };

  // ── checks & printing ──
  const problems = templateProblems(t);
  const per = labelsPerPage(t);
  const pages = items.length ? Math.ceil(((t.mode === "sheet" ? startAt - 1 : 0) + items.length) / per) : 0;
  const barsWidthMm = t.labelW - 2 * t.padding - 2 * t.quietZone;
  const moduleMm = modules ? barsWidthMm / modules : null;
  const { w: pageW, h: pageH } = pageSize(t);

  const printJob = (id: string, title: string) => printArea(id, { page: { size: `${pageW}mm ${pageH}mm`, margin: "0" }, title });
  const print = () => {
    if (items.length === 0) return toast.error("Add items with a barcode first");
    printJob("barcode-labels", `Labels (${items.length})`);
  };

  const toggle = (k: keyof LabelOptions) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  const onModules = useCallback((n: number) => setModules(n), []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <LuChevronLeft size={16} /> Back to products
          </Link>
          <p className="text-sm text-slate-500">Add products, set how many stickers each needs, pick your sticker size and print.</p>
        </div>
        <button onClick={print} disabled={items.length === 0} className="admin-btn admin-btn-primary !py-2.5 disabled:opacity-40">
          <LuPrinter size={16} /> Print {items.length} label{items.length === 1 ? "" : "s"}
          {pages > 0 && <span className="opacity-80">· {pages} page{pages === 1 ? "" : "s"}</span>}
        </button>
      </div>

      {canManage && catalogMissing > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            <strong>{catalogMissing}</strong> product{catalogMissing === 1 ? " has" : "s have"} no barcode yet. Every product should have one. It&apos;s used on labels,
            at the POS, in stock and purchase screens and in every search.
          </p>
          <button onClick={() => generateFor({ allMissing: true }, "catalog")} disabled={!!generating} className="admin-btn admin-btn-primary !py-2 text-xs shrink-0">
            {generating === "catalog" ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuWandSparkles size={14} />}
            Generate for all {catalogMissing}
          </button>
        </div>
      )}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
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
                    title="One sticker for every unit on hand"
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
                Search or scan products below and add them here.
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
                          <td className="font-mono text-xs whitespace-nowrap">
                            {code ? (
                              <>
                                {code}
                                {code === r.sku && code !== r.productBarcode && code !== r.variantBarcode && <span className="ml-1 text-[10px] text-slate-400">(SKU)</span>}
                              </>
                            ) : canManage ? (
                              <button
                                onClick={() => generateForRows([r], r.key)}
                                disabled={!!generating}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 font-sans text-[11px] font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                                title="Create this product's barcode and save it"
                              >
                                {generating === r.key ? <LuLoaderCircle size={12} className="animate-spin" /> : <LuWandSparkles size={12} />} Generate
                              </button>
                            ) : (
                              <Link href={`/admin/products/${r.productId}`} className="text-amber-700 hover:underline inline-flex items-center gap-1 font-sans">
                                <LuCircleAlert size={12} /> No barcode
                              </Link>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{r.price.toFixed(3)}</td>
                          <td className="text-right tabular-nums text-slate-500">{r.onHand ?? "-"}</td>
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
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-amber-900 bg-amber-50 border-t border-amber-100">
                <p>
                  {missing.length} item{missing.length === 1 ? "'s product has" : "s' products have"} no barcode yet, so {missing.length === 1 ? "it" : "they"} can&apos;t be printed.
                  {canManage ? " Generate them: each product gets its own code, saved for good." : " Ask someone who manages products to add barcodes."}
                </p>
                {canManage && (
                  <button onClick={() => generateForRows(missing, "all")} disabled={!!generating} className="admin-btn admin-btn-primary !py-2 text-xs shrink-0 disabled:opacity-50">
                    {generating === "all" ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuWandSparkles size={14} />}
                    Generate barcodes
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Product search */}
          <div className="admin-card">
            <form onSubmit={onSearchEnter} className="p-4 border-b border-slate-100">
              <div className="relative">
                <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input className="admin-input !pl-9" placeholder="Search or scan: name, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </form>
            {searching && hits.length === 0 ? (
              <div className="flex justify-center py-10"><span className="spinner" /></div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {hits.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={productImageUrl(p.images)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-700 truncate">{p.nameEn}</p>
                      <p className="text-xs text-slate-400">
                        {Number(p.salePrice ?? p.basePrice).toFixed(3)} OMR
                        <span className="ml-2 font-mono">{p.barcode || "no barcode"}</span>
                      </p>
                    </div>
                    <button onClick={() => addProduct(p.id)} disabled={adding === p.id} className="admin-btn admin-btn-secondary !py-1.5 text-xs">
                      {adding === p.id ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuPlus size={14} />} Add
                    </button>
                  </div>
                ))}
                {hits.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">No products found</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right column: sticker template, content, preview */}
        <div className="space-y-4 xl:sticky xl:top-4">
          <div className="admin-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><LuRuler size={15} /> Sticker size</p>
              {!draft && (
                <div className="flex gap-1">
                  <button onClick={startEditing} className="admin-btn admin-btn-secondary !px-2.5 !py-1.5 text-xs" title={selected.builtIn ? "Make your own copy of this size" : "Edit this template"}>
                    {selected.builtIn ? <LuCopy size={13} /> : <LuPencil size={13} />} {selected.builtIn ? "Customize" : "Edit"}
                  </button>
                  {canManage && !selected.builtIn && defaultId !== selected.id && (
                    <button onClick={makeDefault} disabled={savingTpl} className="admin-btn admin-btn-secondary !px-2.5 !py-1.5 text-xs" title="Use this template by default for everyone">
                      <LuStar size={13} />
                    </button>
                  )}
                  {canManage && !selected.builtIn && (
                    <button onClick={deleteTemplate} disabled={savingTpl} className="admin-btn admin-btn-danger !px-2.5 !py-1.5 text-xs" title="Delete template">
                      <LuTrash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {!draft ? (
              <>
                <select className="admin-input admin-select !py-2 text-sm" value={selected.id} onChange={(e) => setTemplateId(e.target.value)}>
                  {custom.length > 0 && (
                    <optgroup label="Your templates">
                      {custom.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.id === defaultId ? " (default)" : ""}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Standard sizes">
                    {BUILT_IN_TEMPLATES.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-xs text-slate-500">
                  {t.labelW} × {t.labelH} mm
                  {t.mode === "sheet" ? ` · ${t.cols} × ${t.rows} on ${t.pageW} × ${t.pageH} mm` : " · one per page"}
                  {(t.offsetX || t.offsetY) ? ` · calibrated ${t.offsetX >= 0 ? "+" : ""}${t.offsetX}/${t.offsetY >= 0 ? "+" : ""}${t.offsetY} mm` : ""}
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <TemplateEditor t={draft} onChange={setDraft} />
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {canManage && (
                    <button onClick={saveDraft} disabled={savingTpl} className="admin-btn admin-btn-primary !py-2 text-xs">
                      {savingTpl ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuSave size={14} />} Save template
                    </button>
                  )}
                  <button onClick={() => setDraft(null)} className="admin-btn admin-btn-secondary !py-2 text-xs">
                    <LuX size={14} /> {canManage ? "Cancel" : "Back to saved sizes"}
                  </button>
                </div>
                {!canManage && <p className="text-[11px] text-slate-400">Your changes apply to this print only. Saving templates needs product-management access.</p>}
              </div>
            )}
          </div>

          <div className="admin-card p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">On the sticker</p>
            <label className="block">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Barcode printed</span>
              <select className="admin-input admin-select !py-1.5 text-sm" value={codeSource} onChange={(e) => setCodeSource(e.target.value as CodeSource)}>
                <option value="product">Product barcode: the same for every size / colour</option>
                <option value="option">Size / colour barcode when it has its own</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ["showName", "Name"],
                  ["showArabic", "Arabic name"],
                  ["showVariant", "Colour / size"],
                  ["showDigits", "Code digits"],
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
            <label className="block">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Store name</span>
              <input className="admin-input !py-1.5 text-sm" value={opts.storeName} onChange={(e) => setOpts((o) => ({ ...o, storeName: e.target.value }))} placeholder="Leave empty to hide" />
            </label>
          </div>

          <div className="admin-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Preview <span className="font-normal text-slate-400">· to scale{t.mode === "sheet" ? ", page 1" : ""}</span></p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <PagePreview items={items} t={t} opts={effectiveOpts} startAt={startAt} widthPx={340} />
            </div>

            {problems.map((p) => (
              <p key={p} className="flex gap-1.5 text-xs text-rose-700"><LuCircleAlert size={14} className="shrink-0 mt-0.5" /> {p}</p>
            ))}
            {moduleMm != null && moduleMm < 0.19 && (
              <p className="flex gap-1.5 text-xs text-amber-700">
                <LuCircleAlert size={14} className="shrink-0 mt-0.5" />
                Bars are very thin ({moduleMm.toFixed(2)} mm). A 203-dpi label printer may blur them. Use a wider sticker, less padding / quiet zone, or EAN-13 codes.
              </p>
            )}
            {printable[0] && (
              <div className="hidden" aria-hidden>
                <BarcodePreview value={codeOf(printable[0])!} format={t.barcodeFormat} stretch onModules={onModules} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              {t.mode === "sheet" && (
                <label className="block">
                  <span className="block text-[11px] font-medium text-slate-500 mb-1">Start at sticker #</span>
                  <input
                    type="number"
                    min={1}
                    max={per}
                    value={startAt}
                    onChange={(e) => setStartAt(Math.min(per, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="admin-input !py-1.5 text-sm"
                    title="Reuse a partly used sheet: the first sticker prints at this position"
                  />
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700 self-end pb-2">
                <input type="checkbox" checked={outlines} onChange={() => setOutlines((v) => !v)} className="rounded" /> Print outlines
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={print} disabled={items.length === 0} className="admin-btn admin-btn-primary !py-2 text-xs disabled:opacity-40">
                <LuPrinter size={14} /> Print {items.length}
              </button>
              <button onClick={() => printJob("barcode-labels-test", "Alignment test")} className="admin-btn admin-btn-secondary !py-2 text-xs" title="Numbered outlines only: print on plain paper and hold it against your stickers">
                <LuRuler size={14} /> Alignment test
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              For exact sizes, in the print dialog choose your label printer, set the paper size to{" "}
              <strong className="font-medium text-slate-500">{pageW} × {pageH} mm</strong>, Scale <strong className="font-medium text-slate-500">100% / Actual size</strong>,
              Margins <strong className="font-medium text-slate-500">None</strong>, and turn off headers &amp; footers.
            </p>
          </div>
        </div>
      </div>

      <PrintArea id="barcode-labels">
        <LabelPrintJob items={items} t={t} opts={effectiveOpts} startAt={startAt} outlines={outlines} />
      </PrintArea>
      <PrintArea id="barcode-labels-test">
        <LabelPrintJob items={[]} t={t} opts={effectiveOpts} testPage />
      </PrintArea>
    </div>
  );
}
