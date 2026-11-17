"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuCheck, LuLoaderCircle, LuSearch, LuTag, LuX } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { fetchJson, flattenTree, type CategoryNode, type PickerProduct } from "./shared";

type PageData = { items: PickerProduct[]; meta: { page: number; totalPages: number; total: number } };

/**
 * Choose the products a promotion covers. Filters: search, category (incl.
 * sub-categories) and "on sale only" — with a one-click "select all results"
 * so e.g. every discounted product can be put on the promotion at once.
 */
export default function ProductPickerModal({
  open,
  onClose,
  selected,
  onChange,
  categories,
  title = "Choose products",
}: {
  open: boolean;
  onClose: () => void;
  selected: PickerProduct[];
  onChange: (list: PickerProduct[]) => void;
  categories: CategoryNode[];
  title?: string;
}) {
  const [picked, setPicked] = useState<Map<string, PickerProduct>>(new Map());
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [onSale, setOnSale] = useState(false);
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [items, setItems] = useState<PickerProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const reqId = useRef(0);
  const tree = useMemo(() => flattenTree(categories), [categories]);

  // Fresh copy of the current selection each time the picker opens.
  useEffect(() => {
    if (open) {
      setPicked(new Map(selected.map((p) => [p.id, p])));
      setOnlyPicked(false);
    }
  }, [open, selected]);

  const query = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ page: String(p), pageSize: "30" });
      if (search.trim()) params.set("search", search.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (onSale) params.set("onSale", "true");
      return params;
    },
    [search, categoryId, onSale],
  );

  const load = useCallback(
    async (p: number) => {
      const id = ++reqId.current;
      setLoading(true);
      const d = await fetchJson<PageData>(`/api/promotions/products?${query(p)}`);
      if (id !== reqId.current) return;
      setLoading(false);
      if (!d.success || !d.data) return;
      setItems((prev) => (p === 1 ? d.data!.items : [...prev, ...d.data!.items]));
      setPage(d.data.meta.page);
      setTotalPages(d.data.meta.totalPages);
      setTotal(d.data.meta.total);
    },
    [query],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(1), 220);
    return () => clearTimeout(t);
  }, [open, load]);

  const toggle = (p: PickerProduct) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });

  /** Adds every product matching the current filters (not just the loaded page). */
  const selectAllResults = async () => {
    setBulkBusy(true);
    const params = query(1);
    params.set("idsOnly", "true");
    const d = await fetchJson<{ ids: string[] }>(`/api/promotions/products?${params}`);
    const ids = (d.data?.ids ?? []).filter((id) => !picked.has(id)).slice(0, 1000);
    const fetched: PickerProduct[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const r = await fetchJson<PageData>(`/api/promotions/products?ids=${chunk.join(",")}&pageSize=100`);
      fetched.push(...(r.data?.items ?? []));
    }
    setPicked((prev) => {
      const next = new Map(prev);
      fetched.forEach((p) => next.set(p.id, p));
      return next;
    });
    setBulkBusy(false);
  };

  const visible = onlyPicked ? Array.from(picked.values()) : items;
  const allVisiblePicked = visible.length > 0 && visible.every((p) => picked.has(p.id));

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      className="!max-w-3xl"
      bodyClassName="!p-0"
      footer={
        <>
          <span className="mr-auto text-sm text-slate-500">
            <strong className="text-slate-800">{picked.size}</strong> selected
          </span>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => {
              onChange(Array.from(picked.values()));
              onClose();
            }}
          >
            <LuCheck size={16} /> Use {picked.size} product{picked.size === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              autoFocus
              className="admin-input !pl-9"
              placeholder="Search name, SKU or barcode…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOnlyPicked(false);
              }}
            />
          </div>
          <select className="admin-input admin-select sm:!w-56" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {tree.map((c) => (
              <option key={c.id} value={c.id}>
                {"  ".repeat(c.depth)}
                {c.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnSale((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              onSale ? "bg-rose-600 text-white ring-rose-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            <LuTag size={13} /> On sale only
          </button>
          <button
            type="button"
            onClick={() => setOnlyPicked((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              onlyPicked ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            Show selected ({picked.size})
          </button>
          <span className="text-xs text-slate-400">{onlyPicked ? "" : `${total.toLocaleString()} match${total === 1 ? "" : "es"}`}</span>
          <div className="ml-auto flex items-center gap-2">
            {!onlyPicked && total > 0 && (
              <button type="button" onClick={selectAllResults} disabled={bulkBusy} className="admin-btn admin-btn-secondary !py-1.5 !text-xs">
                {bulkBusy ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuCheck size={14} />}
                {onSale ? `Select all on-sale (${total})` : `Select all ${total}`}
              </button>
            )}
            {picked.size > 0 && (
              <button type="button" onClick={() => setPicked(new Map())} className="admin-btn admin-btn-secondary !py-1.5 !text-xs">
                <LuX size={14} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {visible.length > 0 && (
          <label className="flex items-center gap-3 px-4 py-2 bg-slate-50/70 text-xs font-medium text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={allVisiblePicked}
              onChange={() =>
                setPicked((prev) => {
                  const next = new Map(prev);
                  if (allVisiblePicked) visible.forEach((p) => next.delete(p.id));
                  else visible.forEach((p) => next.set(p.id, p));
                  return next;
                })
              }
            />
            {allVisiblePicked ? "Unselect" : "Select"} the {visible.length} shown
          </label>
        )}
        {visible.map((p) => {
          const on = picked.has(p.id);
          return (
            <label key={p.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${on ? "bg-indigo-50/50" : "hover:bg-slate-50"}`}>
              <input type="checkbox" className="rounded" checked={on} onChange={() => toggle(p)} />
              <span className="w-10 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 truncate">{p.nameEn}</span>
                <span className="block text-xs text-slate-400 truncate" dir="rtl">
                  {p.nameAr}
                </span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {p.categoryName}
                  {!p.isActive && <span className="ml-1.5 text-amber-600">· hidden from shop</span>}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-sm font-semibold text-slate-800 tabular-nums">{p.price.toFixed(3)}</span>
                {p.onSale && (
                  <span className="flex items-center justify-end gap-1.5">
                    <span className="text-[11px] text-slate-400 line-through tabular-nums">{p.basePrice.toFixed(3)}</span>
                    <span className="rounded bg-rose-50 text-rose-600 px-1.5 text-[10px] font-semibold">SALE</span>
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {!loading && visible.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-12">{onlyPicked ? "Nothing selected yet." : "No products match these filters."}</p>
        )}
        {loading && (
          <div className="flex justify-center py-6">
            <LuLoaderCircle className="animate-spin text-slate-400" size={20} />
          </div>
        )}
        {!onlyPicked && !loading && page < totalPages && (
          <div className="p-3 text-center">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => load(page + 1)}>
              Load more
            </button>
          </div>
        )}
      </div>
    </AdminModal>
  );
}
