"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LuChevronLeft, LuLoaderCircle, LuPrinter, LuSearch } from "react-icons/lu";
import BarcodePreview from "@/components/admin/BarcodePreview";
import { formatVariantLabel } from "@/lib/utils";

type Product = {
  id: string;
  nameEn: string;
  basePrice: number;
  salePrice?: number | null;
};

type FullVariant = {
  id: string;
  color: string | null;
  colorParts?: { part: string; color: string }[] | null;
  size: string | null;
  barcode: string | null;
  priceAdjustment: number | string;
  isActive: boolean;
};

type FullProduct = {
  id: string;
  nameEn: string;
  basePrice: number | string;
  salePrice: number | string | null;
  barcode: string | null;
  variants: FullVariant[];
};

type LabelEntry = {
  key: string;
  name: string;
  variant: string;
  price: number;
  barcode: string;
};

export default function BarcodeLabelsPage() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<LabelEntry[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", pageSize: "50", search });
    const res = await fetch(`/api/products?${params}`, { cache: "no-store" });
    const data = await res.json();
    if (data.success) setProducts(data.data);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateLabels = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    setLabels(null);
    try {
      const results = await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/products/${id}`, { cache: "no-store" }).then((r) => r.json())
        )
      );

      const entries: LabelEntry[] = [];
      let skipped = 0;
      for (const res of results) {
        if (!res.success) continue;
        const p = res.data as FullProduct;
        const activeVariants = (p.variants || []).filter((v) => v.isActive);

        if (activeVariants.length === 0) {
          if (p.barcode) {
            entries.push({ key: p.id, name: p.nameEn, variant: "", price: Number(p.salePrice ?? p.basePrice), barcode: p.barcode });
          } else {
            skipped += 1;
          }
          continue;
        }

        for (const v of activeVariants) {
          if (!v.barcode) { skipped += 1; continue; }
          entries.push({
            key: v.id,
            name: p.nameEn,
            variant: formatVariantLabel(v),
            price: Number(p.salePrice ?? p.basePrice) + Number(v.priceAdjustment),
            barcode: v.barcode,
          });
        }
      }

      setLabels(entries);
      setSkippedCount(skipped);
    } finally {
      setGenerating(false);
    }
  };

  if (labels) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <button onClick={() => setLabels(null)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <LuChevronLeft size={16} /> Back to selection
            </button>
            <h1 className="text-xl font-semibold text-slate-800">Barcode Labels</h1>
            <p className="text-sm text-slate-500">
              {labels.length} label{labels.length === 1 ? "" : "s"} ready.
              {skippedCount > 0 && ` ${skippedCount} item(s) skipped — no barcode set.`}
            </p>
          </div>
          <button onClick={() => window.print()} className="admin-btn admin-btn-primary inline-flex items-center gap-2">
            <LuPrinter size={16} /> Print
          </button>
        </div>

        {labels.length === 0 ? (
          <p className="text-slate-400 text-sm">
            None of the selected items have a barcode set yet. Add one from each product&apos;s edit page first.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-3">
            {labels.map((l) => (
              <div key={l.key} className="border border-slate-200 rounded-lg p-2 flex flex-col items-center text-center break-inside-avoid">
                <p className="text-xs font-medium text-slate-800 truncate w-full">{l.name}</p>
                {l.variant && <p className="text-[10px] text-slate-400 truncate w-full">{l.variant}</p>}
                <BarcodePreview value={l.barcode} height={36} />
                <p className="text-xs font-semibold text-slate-700">{l.price.toFixed(3)} OMR</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <LuChevronLeft size={16} /> Back to products
        </Link>
        <h1 className="text-xl font-semibold text-slate-800">Barcode Labels</h1>
        <p className="text-sm text-slate-500">Pick products to print a sheet of scannable labels for the shop floor.</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="admin-input pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={generateLabels}
          disabled={selected.size === 0 || generating}
          className="admin-btn admin-btn-primary inline-flex items-center gap-2 disabled:opacity-40"
        >
          {generating ? <LuLoaderCircle size={16} className="animate-spin" /> : <LuPrinter size={16} />}
          Generate ({selected.size})
        </button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><span className="spinner" /></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="rounded" />
                <span className="font-medium text-slate-700">{p.nameEn}</span>
                <span className="text-sm text-slate-400 ml-auto">{Number(p.salePrice ?? p.basePrice).toFixed(3)} OMR</span>
              </label>
            ))}
            {products.length === 0 && (
              <p className="text-center py-8 text-slate-400 text-sm">No products found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
