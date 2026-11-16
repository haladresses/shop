"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { LuArrowDown, LuChevronLeft, LuChevronRight, LuFolder, LuInfo, LuSearch } from "react-icons/lu";
import { rateLabel, type RateInfo } from "@/lib/taxCalc";
import { fetchJson, money, sendJson, useTaxRates } from "./shared";

type CategoryRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  parentId: string | null;
  taxRateId: string | null;
  productCount: number;
  effective: RateInfo;
  inherited: boolean;
};

type ProductRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  sku: string | null;
  price: number;
  categoryName: string;
  imageUrl: string | null;
  taxRateId: string | null;
  effective: RateInfo | null;
};

type Meta = { page: number; pageSize: number; total: number; totalPages: number };

function RateChip({ rate, inherited }: { rate: RateInfo | null; inherited?: boolean }) {
  if (!rate) return <span className="text-xs text-slate-400">-</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
        inherited ? "bg-slate-100 text-slate-500" : "bg-teal-50 text-teal-700"
      }`}
      title={inherited ? "Inherited" : "Set here"}
    >
      {inherited && <LuArrowDown size={10} />}
      {rate.code ? `${rate.code} · ` : ""}
      {rateLabel(rate)}
    </span>
  );
}

export default function TaxAssignmentTab({ canManage }: { canManage: boolean }) {
  const { rates } = useTaxRates(true);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [defaultRate, setDefaultRate] = useState<RateInfo | null>(null);
  const [resetProducts, setResetProducts] = useState(false);
  const [busyCat, setBusyCat] = useState<string | null>(null);

  const loadCats = useCallback(async () => {
    const d = await fetchJson<{ defaultRate: RateInfo; categories: CategoryRow[] }>("/api/tax/assign");
    if (d.success && d.data) {
      setCats(d.data.categories);
      setDefaultRate(d.data.defaultRate);
    }
  }, []);
  useEffect(() => {
    loadCats();
  }, [loadCats]);

  // Depth-first order with indentation.
  const tree = useMemo(() => {
    const children = new Map<string | null, CategoryRow[]>();
    for (const c of cats) {
      const k = c.parentId && cats.some((x) => x.id === c.parentId) ? c.parentId : null;
      children.set(k, [...(children.get(k) ?? []), c]);
    }
    const out: (CategoryRow & { depth: number })[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const c of children.get(parent) ?? []) {
        out.push({ ...c, depth });
        if (depth < 20) walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [cats]);

  const assignCategory = async (c: CategoryRow, taxRateId: string) => {
    setBusyCat(c.id);
    const d = await sendJson<{ categories: number; productsReset: number }>("/api/tax/assign", "POST", {
      target: "categories",
      ids: [c.id],
      taxRateId: taxRateId || null,
      resetProducts,
    });
    setBusyCat(null);
    if (!d.success) return toast.error(d.error || "Could not update");
    toast.success(
      `${c.nameEn}: ${taxRateId ? "rate set" : "now inherits"}${d.data?.productsReset ? ` · ${d.data.productsReset} product override(s) cleared` : ""}`,
    );
    loadCats();
    loadProducts();
  };

  // ── Products ──
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [rateFilter, setRateFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRate, setBulkRate] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const q = new URLSearchParams({ products: "1", page: String(page), pageSize: "50", search, categoryId, rate: rateFilter });
    const d = await fetchJson<{ items: ProductRow[]; meta: Meta }>(`/api/tax/assign?${q}`);
    if (d.success && d.data) {
      setProducts(d.data.items);
      setMeta(d.data.meta);
    }
    setLoadingProducts(false);
  }, [page, search, categoryId, rateFilter]);

  useEffect(() => {
    const t = setTimeout(loadProducts, 200);
    return () => clearTimeout(t);
  }, [loadProducts]);

  const allOnPage = products.length > 0 && products.every((p) => selected.has(p.id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) products.forEach((p) => next.delete(p.id));
      else products.forEach((p) => next.add(p.id));
      return next;
    });
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (taxRateId: string | null) => {
    if (selected.size === 0) return;
    const d = await sendJson<{ products: number }>("/api/tax/assign", "POST", { target: "products", ids: Array.from(selected), taxRateId });
    if (!d.success) return toast.error(d.error || "Could not update");
    toast.success(`${d.data?.products ?? 0} product(s) ${taxRateId ? "updated" : "now follow their category"}`);
    setSelected(new Set());
    loadProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl bg-indigo-50/60 border border-indigo-100 px-4 py-3 text-sm text-indigo-900">
        <LuInfo size={17} className="mt-0.5 shrink-0" />
        <p>
          Which rate applies: <strong>the product&apos;s own rate</strong> → its <strong>category</strong> → <strong>parent categories</strong> →{" "}
          <strong>store default</strong>
          {defaultRate ? ` (${defaultRate.nameEn}, ${rateLabel(defaultRate)})` : ""}. Set rates on categories for most of the catalogue and only
          override individual products when they differ. Changes apply to new sales only.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-800">Categories</h3>
          {canManage && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="rounded" checked={resetProducts} onChange={(e) => setResetProducts(e.target.checked)} />
              When I change a category, also clear its products&apos; own rates
            </label>
          )}
        </div>
        <div className="admin-card overflow-x-auto">
          <table className="admin-table min-w-[620px]">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Products</th>
                <th>Applies now</th>
                <th className="w-64">Rate</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="flex items-center gap-2" style={{ paddingLeft: c.depth * 20 }}>
                      <LuFolder size={15} className="text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800">{c.nameEn}</span>
                      <span className="text-xs text-slate-400 hidden sm:inline" dir="rtl">
                        {c.nameAr}
                      </span>
                    </span>
                  </td>
                  <td className="text-right tabular-nums text-slate-500">{c.productCount}</td>
                  <td>
                    <RateChip rate={c.effective} inherited={c.inherited} />
                  </td>
                  <td>
                    <select
                      className="admin-input admin-select !py-1.5 text-sm"
                      value={c.taxRateId ?? ""}
                      disabled={!canManage || busyCat === c.id}
                      onChange={(e) => assignCategory(c, e.target.value)}
                      aria-label={`VAT rate for ${c.nameEn}`}
                    >
                      <option value="">Inherit ({c.parentId ? "parent category" : "store default"})</option>
                      {rates.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nameEn} · {rateLabel(r)}
                        </option>
                      ))}
                      {c.taxRateId && !rates.some((r) => r.id === c.taxRateId) && <option value={c.taxRateId}>Inactive rate</option>}
                    </select>
                  </td>
                </tr>
              ))}
              {tree.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-8">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-slate-800">Products</h3>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="admin-input !pl-9"
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="admin-input admin-select !w-auto"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {tree.map((c) => (
              <option key={c.id} value={c.id}>
                {"-".repeat(c.depth)}
                {c.nameEn}
              </option>
            ))}
          </select>
          <select
            className="admin-input admin-select !w-auto"
            value={rateFilter}
            onChange={(e) => {
              setRateFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Rate filter"
          >
            <option value="">Any rate</option>
            <option value="own">Own rate set</option>
            <option value="inherited">Inheriting</option>
            {rates.map((r) => (
              <option key={r.id} value={r.id}>
                Own: {r.nameEn}
              </option>
            ))}
          </select>
        </div>

        {canManage && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 admin-fade-in">
            <span className="text-sm font-medium mr-2">{selected.size} selected</span>
            <select
              className="admin-input admin-select !w-auto !py-1.5 text-sm text-slate-800"
              value={bulkRate}
              onChange={(e) => setBulkRate(e.target.value)}
              aria-label="Rate to apply"
            >
              <option value="">Choose a rate…</option>
              {rates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameEn} · {rateLabel(r)}
                </option>
              ))}
            </select>
            <button disabled={!bulkRate} onClick={() => bulk(bulkRate)} className="admin-btn admin-btn-primary !py-1.5 disabled:opacity-40">
              Apply
            </button>
            <button onClick={() => bulk(null)} className="admin-btn !py-1.5 bg-white/10 hover:bg-white/20 text-white">
              Follow category
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-slate-300 hover:text-white">
              Clear selection
            </button>
          </div>
        )}

        <div className="admin-card overflow-x-auto">
          <table className="admin-table min-w-[680px]">
            <thead>
              <tr>
                {canManage && (
                  <th className="w-10">
                    <input type="checkbox" className="rounded" checked={allOnPage} onChange={togglePage} aria-label="Select page" />
                  </th>
                )}
                <th>Product</th>
                <th>Category</th>
                <th className="text-right">Price</th>
                <th>Own rate</th>
                <th>Applies now</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts && products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10">
                    <div className="flex justify-center">
                      <span className="spinner" />
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const own = p.taxRateId ? rates.find((r) => r.id === p.taxRateId) : undefined;
                  return (
                    <tr key={p.id} className={selected.has(p.id) ? "bg-indigo-50/40" : ""}>
                      {canManage && (
                        <td>
                          <input type="checkbox" className="rounded" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.nameEn}`} />
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{p.nameEn}</p>
                            {p.sku && <p className="text-xs text-slate-400 font-mono">{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-500">{p.categoryName}</td>
                      <td className="text-right tabular-nums">{money(p.price)}</td>
                      <td>{p.taxRateId ? own ? <RateChip rate={{ ...own, id: own.id }} /> : <span className="text-xs text-rose-600">Inactive rate</span> : <span className="text-xs text-slate-400">Inherits</span>}</td>
                      <td>
                        <RateChip rate={p.effective} inherited={!p.taxRateId} />
                      </td>
                    </tr>
                  );
                })
              )}
              {!loadingProducts && products.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-8">
                    No products match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {meta.total.toLocaleString()} products · page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="admin-btn admin-btn-secondary !px-2.5 disabled:opacity-40" aria-label="Previous page">
                <LuChevronLeft size={16} />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="admin-btn admin-btn-secondary !px-2.5 disabled:opacity-40"
                aria-label="Next page"
              >
                <LuChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
