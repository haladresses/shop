"use client";
import { useEffect, useRef, useState } from "react";
import { LuLoaderCircle, LuPackage, LuScanBarcode } from "react-icons/lu";
import type { RateInfo } from "@/lib/taxCalc";
import { api, fmt3 } from "./shared";

/** One sellable item (a size/colour, or a product without options) from /api/purchases/lookup. */
export type LookupRow = {
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

/**
 * Scan-or-search box. A scanner types the code and presses Enter: an exact
 * barcode/SKU match is added straight away. Typing shows matching items.
 */
export default function ItemSearch({
  supplierId,
  onPick,
  placeholder = "Scan a barcode or search a product to add it",
  requireStock = false,
  autoFocus,
}: {
  supplierId?: string | null;
  onPick: (row: LookupRow) => void;
  placeholder?: string;
  /** Only items that already have a stock record (for returns). */
  requireStock?: boolean;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const usable = (r: LookupRow) => !requireStock || (r.variantId != null && r.onHand != null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRows([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q: term });
      if (supplierId) p.set("supplierId", supplierId);
      api<LookupRow[]>(`/api/purchases/lookup?${p}`).then((d) => {
        setRows(d.data ?? []);
        setLoading(false);
        setOpen(true);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, supplierId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (r: LookupRow) => {
    if (!usable(r)) {
      setMsg(`${r.nameEn} has no stock record yet. Nothing to return.`);
      return;
    }
    onPick(r);
    setQ("");
    setRows([]);
    setOpen(false);
    setMsg("");
    inputRef.current?.focus();
  };

  // Enter = scanner: try an exact code match first.
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const p = new URLSearchParams({ barcode: term });
    if (supplierId) p.set("supplierId", supplierId);
    const d = await api<LookupRow[]>(`/api/purchases/lookup?${p}`);
    const exact = (d.data ?? []).filter((r) => r.barcode === term || r.sku === term);
    if (exact.length === 1) return pick(exact[0]);
    if (rows.length === 1) return pick(rows[0]);
    if ((d.data ?? []).length === 0 && rows.length === 0) setMsg(`Nothing found for “${term}”.`);
    else setOpen(true);
  };

  return (
    <div className="relative" ref={boxRef}>
      <form onSubmit={onSubmit} className="relative">
        <LuScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setMsg("");
          }}
          onFocus={() => rows.length && setOpen(true)}
          placeholder={placeholder}
          className="admin-input !py-2.5 !pl-10 !pr-9"
        />
        {loading && <LuLoaderCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </form>
      {msg && <p className="text-xs text-amber-700 mt-1">{msg}</p>}
      {open && q.trim() && (
        <ul className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-lg ring-1 ring-slate-200 max-h-80 overflow-y-auto admin-fade-in">
          {!loading && rows.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No matching items</li>}
          {rows.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => pick(r)}
                disabled={!usable(r)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
              >
                <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <LuPackage size={16} className="text-slate-300" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800 truncate">
                    {r.nameEn}
                    {!r.isActive && <span className="ml-1.5 text-[10px] font-semibold text-slate-400 uppercase">inactive</span>}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {[r.variantLabel || "Standard", r.barcode || r.sku].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-right shrink-0 text-xs">
                  <span className="block text-slate-600">{r.onHand == null ? "Not tracked yet" : `${r.onHand} on hand`}</span>
                  {r.lastCost != null ? (
                    <span className="block text-slate-400">Last {fmt3(r.lastCost)}</span>
                  ) : r.costPrice != null ? (
                    <span className="block text-slate-400">Cost {fmt3(r.costPrice)}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
