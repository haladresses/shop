"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuLoaderCircle, LuMapPin, LuPackageOpen, LuScanBarcode, LuShoppingBag } from "react-icons/lu";
import { PosModal } from "@/components/pos/PosUi";

// Stock check for the till: scan or search any product and see exactly what
// is on the shelf, colour by size, including sold-out options, low-stock
// warnings, what's already in this sale and where it's kept. Tap an
// available cell to add that exact item to the sale.

export type StockLine = {
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  color: string | null;
  colorParts: { part: string; color: string }[] | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  unitPrice: number;
  stock: number | null;
  lowStockAlert?: number | null;
  location?: string | null;
  imageUrl: string | null;
};

const SIZE_ORDER: Record<string, number> = { XXS: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, "2XL": 6, "3XL": 7, "4XL": 8 };
const bySize = (a: string, b: string) =>
  (SIZE_ORDER[a.toUpperCase()] ?? 50 + (parseFloat(a) || 0)) - (SIZE_ORDER[b.toUpperCase()] ?? 50 + (parseFloat(b) || 0)) || a.localeCompare(b);
const keyOf = (l: { variantId: string | null; productId: string }) => l.variantId || l.productId;

type Level = "out" | "low" | "ok" | "untracked";
const levelOf = (l: StockLine): Level => {
  if (l.stock === null) return "untracked";
  if (l.stock <= 0) return "out";
  if (l.stock <= (l.lowStockAlert ?? 3)) return "low";
  return "ok";
};
const CELL: Record<Level, string> = {
  out: "bg-rose-50 text-rose-500 ring-rose-200",
  low: "bg-amber-50 text-amber-800 ring-amber-200",
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  untracked: "bg-slate-50 text-slate-500 ring-slate-200",
};

export default function StockCheckModal({
  open,
  onClose,
  inCart,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** Units of an item already in the current sale. */
  inCart: (key: string) => number;
  onAdd: (line: StockLine) => void;
}) {
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<StockLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Live search (sold-out options included — that's the point of a stock check).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const d = await fetch(`/api/pos/lookup?q=${encodeURIComponent(term)}`).then((r) => r.json()).catch(() => null);
      setLines(d?.success ? d.data : []);
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // A scanned barcode shows that product (all its colours and sizes).
  const onEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = q.trim();
    if (!code) return;
    setLoading(true);
    const d = await fetch(`/api/pos/lookup?barcode=${encodeURIComponent(code)}`).then((r) => r.json()).catch(() => null);
    const found: StockLine[] = d?.success ? d.data : [];
    if (found.length) {
      // Show every option of the scanned product, not just the scanned size.
      const all = await fetch(`/api/pos/lookup?q=${encodeURIComponent(found[0].nameEn)}`).then((r) => r.json()).catch(() => null);
      const sameProduct = (all?.success ? (all.data as StockLine[]) : []).filter((l) => l.productId === found[0].productId);
      setLines(sameProduct.length ? sameProduct : found);
      setQ("");
    }
    setSearched(true);
    setLoading(false);
  };

  const products = useMemo(() => {
    const map = new Map<string, StockLine[]>();
    for (const l of lines) map.set(l.productId, [...(map.get(l.productId) ?? []), l]);
    return Array.from(map.values());
  }, [lines]);

  return (
    <PosModal open={open} onClose={onClose} size="2xl" title={<span className="flex items-center gap-2"><LuPackageOpen size={18} className="text-rose-500" /> Stock check</span>}>
      <form onSubmit={onEnter} className="relative mb-4">
        <LuScanBarcode size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Scan a barcode or search a product name / SKU"
          className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-rose-300"
          autoComplete="off"
        />
        {loading && <LuLoaderCircle size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-1 bg-emerald-50 ring-emerald-200" /> In stock</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-1 bg-amber-50 ring-amber-200" /> Low (at or below its alert level)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-1 bg-rose-50 ring-rose-200" /> Sold out</span>
        <span>Tap an available cell to add it to the sale.</span>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
          <LuPackageOpen size={36} className="mb-2" />
          <p className="text-sm">{searched ? "No products found." : "Scan or search to see a product's stock."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((g) => (
            <ProductStock key={g[0].productId} lines={g} inCart={inCart} onAdd={onAdd} />
          ))}
        </div>
      )}
    </PosModal>
  );
}

function ProductStock({ lines, inCart, onAdd }: { lines: StockLine[]; inCart: (key: string) => number; onAdd: (l: StockLine) => void }) {
  const p = lines[0];
  const tracked = lines.some((l) => l.stock !== null);
  const total = lines.reduce((n, l) => n + Math.max(0, l.stock ?? 0), 0);
  const inSale = lines.reduce((n, l) => n + inCart(keyOf(l)), 0);
  const colours = Array.from(new Set(lines.map((l) => l.color || "")));
  const sizes = Array.from(new Set(lines.map((l) => l.size || ""))).sort(bySize);
  const prices = lines.map((l) => l.unitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const locations = Array.from(new Set(lines.map((l) => l.location).filter(Boolean))) as string[];
  const cell = (colour: string, size: string) => lines.find((l) => (l.color || "") === colour && (l.size || "") === size);

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <LuShoppingBag size={20} className="text-slate-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 truncate">{p.nameEn}</p>
          {p.nameAr && <p dir="rtl" className="text-sm text-slate-500 truncate text-left">{p.nameAr}</p>}
          <p className="text-xs text-slate-500 mt-0.5">
            {min === max ? `${min.toFixed(3)} OMR` : `${min.toFixed(3)} to ${max.toFixed(3)} OMR`} · {lines.length} option{lines.length === 1 ? "" : "s"}
            {locations.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1"><LuMapPin size={11} /> {locations.join(", ")}</span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${!tracked ? "text-slate-400" : total === 0 ? "text-rose-600" : "text-slate-900"}`}>{tracked ? total : "-"}</p>
          <p className="text-[11px] text-slate-500">{tracked ? "in stock" : "not stock-tracked"}{inSale > 0 && ` · ${inSale} in this sale`}</p>
        </div>
      </div>

      {tracked && (
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: "4px" }}>
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium text-slate-400 pr-2">Colour \ Size</th>
                {sizes.map((s) => (
                  <th key={s} className="text-center text-xs font-semibold text-slate-600 min-w-[56px]">{s || "One size"}</th>
                ))}
                <th className="text-right text-[11px] font-medium text-slate-400 pl-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {colours.map((c) => {
                const rowTotal = lines.filter((l) => (l.color || "") === c).reduce((n, l) => n + Math.max(0, l.stock ?? 0), 0);
                return (
                  <tr key={c || "none"}>
                    <td className="text-sm font-medium text-slate-700 pr-2 whitespace-nowrap">{c || "Standard"}</td>
                    {sizes.map((s) => {
                      const l = cell(c, s);
                      if (!l) return <td key={s} className="text-center text-slate-300 text-sm">·</td>;
                      const lvl = levelOf(l);
                      const sale = inCart(keyOf(l));
                      const left = l.stock === null ? Infinity : l.stock - sale;
                      return (
                        <td key={s}>
                          <button
                            type="button"
                            onClick={() => left > 0 && onAdd(l)}
                            disabled={left <= 0}
                            title={`${l.sku ? `SKU ${l.sku} · ` : ""}${l.barcode ? `${l.barcode} · ` : ""}${l.unitPrice.toFixed(3)} OMR${l.location ? ` · ${l.location}` : ""}`}
                            className={`w-full rounded-xl px-2 py-2 ring-1 text-center ${CELL[lvl]} ${left > 0 ? "hover:ring-2 hover:ring-rose-300" : "cursor-default"}`}
                          >
                            <span className="block text-lg font-bold leading-none tabular-nums">{l.stock}</span>
                            <span className="block text-[10px] mt-0.5 leading-none">
                              {lvl === "out" ? "sold out" : sale > 0 ? `${sale} in sale` : lvl === "low" ? "low" : " "}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-right text-sm font-semibold tabular-nums text-slate-700 pl-2">{rowTotal}</td>
                  </tr>
                );
              })}
              {colours.length > 1 && (
                <tr>
                  <td className="text-[11px] font-medium text-slate-400 pr-2">Total</td>
                  {sizes.map((s) => (
                    <td key={s} className="text-center text-sm font-semibold tabular-nums text-slate-700">
                      {lines.filter((l) => (l.size || "") === s).reduce((n, l) => n + Math.max(0, l.stock ?? 0), 0)}
                    </td>
                  ))}
                  <td className="text-right text-sm font-bold tabular-nums text-slate-900 pl-2">{total}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
