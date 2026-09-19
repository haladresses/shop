"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuX, LuImagePlus, LuStar, LuTrash2, LuPlus, LuChevronUp, LuChevronDown,
  LuGripVertical, LuInfo,
} from "react-icons/lu";
import {
  type CategoryAttribute,
  type ProductAttributes,
  type AttributeValue,
  fetchCategoryAttributes,
} from "@/lib/attributes";
import BarcodePreview from "./BarcodePreview";

export type ProductImageState = {
  url: string;
  isPrimary: boolean;
  altEn?: string;
  altAr?: string;
  color?: string;
};

export type ColorPartState = {
  part: string;
  color: string;
  colorHex: string;
};

export type VariantState = {
  color: string;
  colorHex: string;
  // Per-region breakdown for a variant that is itself multi-color, e.g. one
  // option = yellow sleeves + blue body. Optional — most variants are a
  // single solid color and leave this empty.
  colorParts: ColorPartState[];
  size: string;
  sku: string;
  // The code the admin already uses for this exact color/size, rendered as a
  // scannable barcode — not auto-generated.
  barcode: string;
  priceAdjustment: string;
  stock: string;
  isActive: boolean;
};

export type ProductFormValue = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  categoryId: string;
  basePrice: string;
  salePrice: string;
  sku: string;
  barcode: string;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  attributes: ProductAttributes;
  images: ProductImageState[];
  variants: VariantState[];
};

type Category = { id: string; nameEn: string };

export const emptyProductForm: ProductFormValue = {
  nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "",
  categoryId: "", basePrice: "", salePrice: "", sku: "", barcode: "",
  isActive: true, isFeatured: false, isNew: true, isBestSeller: false,
  attributes: {}, images: [], variants: [],
};

/** Build the JSON payload sent to the products API from a form value. */
export function buildProductPayload(form: ProductFormValue) {
  return {
    nameEn: form.nameEn.trim(),
    nameAr: form.nameAr.trim(),
    descriptionEn: form.descriptionEn || undefined,
    descriptionAr: form.descriptionAr || undefined,
    categoryId: form.categoryId,
    basePrice: parseFloat(form.basePrice),
    salePrice: form.salePrice ? parseFloat(form.salePrice) : null,
    sku: form.sku || undefined,
    barcode: form.barcode || undefined,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    isNew: form.isNew,
    isBestSeller: form.isBestSeller,
    attributes: form.attributes,
    images: form.images.map((img, i) => ({
      url: img.url,
      isPrimary: img.isPrimary,
      sortOrder: i,
      color: img.color || undefined,
    })),
    variants: form.variants.map((v) => ({
      color: v.color || undefined,
      colorHex: v.colorHex || undefined,
      colorParts: (v.colorParts || [])
        .filter((p) => p.part.trim() && p.color.trim())
        .map((p) => ({ part: p.part.trim(), color: p.color.trim(), colorHex: p.colorHex || undefined })),
      size: v.size || undefined,
      sku: v.sku || undefined,
      barcode: v.barcode || undefined,
      priceAdjustment: parseFloat(v.priceAdjustment) || 0,
      isActive: v.isActive,
      stock: parseInt(v.stock) || 0,
    })),
  };
}

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-sm font-medium text-slate-700 mb-1.5">
    {children} {required && <span className="text-rose-500">*</span>}
  </label>
);

const Card = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <div className="admin-card p-5 sm:p-6">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
    </div>
    {children}
  </div>
);

export default function ProductForm({
  initial,
  productId,
  onSubmit,
  submitLabel,
}: {
  initial: ProductFormValue;
  productId?: string;
  onSubmit: (value: ProductFormValue) => Promise<{ success: boolean; error?: string }>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormValue>(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attrDefs, setAttrDefs] = useState<CategoryAttribute[]>([]);
  const [attrLoading, setAttrLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/categories?all=true")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.data); });
  }, []);

  // Load attribute definitions whenever the category changes.
  const loadAttrs = useCallback(async (categoryId: string) => {
    if (!categoryId) { setAttrDefs([]); return; }
    setAttrLoading(true);
    const defs = await fetchCategoryAttributes(categoryId);
    setAttrDefs(defs);
    setAttrLoading(false);
  }, []);

  useEffect(() => { loadAttrs(form.categoryId); }, [form.categoryId, loadAttrs]);

  const set = <K extends keyof ProductFormValue>(key: K, value: ProductFormValue[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setAttr = (key: string, value: AttributeValue) =>
    setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }));

  // Distinct variant colors, offered as the per-image color tag options.
  const variantColors = useMemo(() => {
    const seen = new Set<string>();
    return form.variants
      .map((v) => v.color.trim())
      .filter((c) => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
      });
  }, [form.variants]);

  // ---- Images ----
  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const uploaded: ProductImageState[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.success) uploaded.push({ url: data.data.url, isPrimary: false });
        else setError(data.error || "Upload failed");
      }
      setForm((f) => {
        const images = [...f.images, ...uploaded];
        if (!images.some((i) => i.isPrimary) && images.length) images[0].isPrimary = true;
        return { ...f, images };
      });
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
  };

  const removeImage = (idx: number) =>
    setForm((f) => {
      const images = f.images.filter((_, i) => i !== idx);
      if (images.length && !images.some((i) => i.isPrimary)) images[0].isPrimary = true;
      return { ...f, images };
    });

  const setPrimary = (idx: number) =>
    setForm((f) => ({
      ...f,
      images: f.images.map((img, i) => ({ ...img, isPrimary: i === idx })),
    }));

  const setImageColor = (idx: number, color: string) =>
    setForm((f) => ({
      ...f,
      images: f.images.map((img, i) => (i === idx ? { ...img, color } : img)),
    }));

  const reorderImage = (from: number, to: number) =>
    setForm((f) => {
      if (to < 0 || to >= f.images.length) return f;
      const images = [...f.images];
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      return { ...f, images };
    });

  // ---- Variants ----
  const addVariant = () =>
    set("variants", [
      ...form.variants,
      { color: "", colorHex: "", colorParts: [], size: "", sku: "", barcode: "", priceAdjustment: "0", stock: "0", isActive: true },
    ]);

  const setVariant = (idx: number, patch: Partial<VariantState>) =>
    set("variants", form.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  const removeVariant = (idx: number) =>
    set("variants", form.variants.filter((_, i) => i !== idx));

  // ---- Variant color parts (e.g. yellow sleeves + blue body) ----
  const addColorPart = (variantIdx: number) =>
    setVariant(variantIdx, {
      colorParts: [...(form.variants[variantIdx].colorParts || []), { part: "", color: "", colorHex: "" }],
    });

  const setColorPart = (variantIdx: number, partIdx: number, patch: Partial<ColorPartState>) =>
    setVariant(variantIdx, {
      colorParts: (form.variants[variantIdx].colorParts || []).map((p, i) => (i === partIdx ? { ...p, ...patch } : p)),
    });

  const removeColorPart = (variantIdx: number, partIdx: number) =>
    setVariant(variantIdx, {
      colorParts: (form.variants[variantIdx].colorParts || []).filter((_, i) => i !== partIdx),
    });

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.nameEn || !form.nameAr) { setError("Both English and Arabic names are required"); return; }
    if (!form.categoryId) { setError("Please select a category"); return; }
    if (!form.basePrice || parseFloat(form.basePrice) <= 0) { setError("Base price must be greater than 0"); return; }

    // Required attribute validation
    for (const def of attrDefs) {
      if (def.isRequired) {
        const v = form.attributes[def.key];
        const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) { setError(`"${def.labelEn}" is required`); return; }
      }
    }

    setSaving(true);
    const res = await onSubmit(form);
    setSaving(false);
    if (!res.success) { setError(res.error || "Could not save product"); return; }
    // Drop the client router cache for this product so re-opening it (e.g. to
    // check the colors just saved) fetches fresh data instead of the page as
    // it looked before this save.
    router.refresh();
    router.push("/admin/products");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
      {error && (
        <div className="bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl border border-rose-100">{error}</div>
      )}

      <Card
        title="Images"
        desc={
          variantColors.length > 0
            ? "The starred image is the primary thumbnail. Drag or use arrows to reorder. Tag an image with a color so shoppers see it when they pick that color."
            : "The starred image is the primary thumbnail. Drag or use arrows to reorder. Add colors under Variants & Stock to tag images per color."
        }
      >
        <div className="flex flex-wrap gap-3">
          {form.images.map((img, idx) => (
            <div key={img.url + idx} className="w-28">
              <div
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIndex !== null) reorderImage(dragIndex, idx); setDragIndex(null); }}
                className={`relative w-28 h-28 rounded-xl overflow-hidden border-2 group ${img.isPrimary ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="product" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 bg-gradient-to-b from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white/80 cursor-grab"><LuGripVertical size={14} /></span>
                  <button type="button" onClick={() => removeImage(idx)} className="w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove image">
                    <LuX size={12} />
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-1 bg-gradient-to-t from-black/60 to-transparent">
                  <button
                    type="button"
                    onClick={() => setPrimary(idx)}
                    title={img.isPrimary ? "Primary image" : "Set as primary"}
                    className={`flex items-center gap-1 text-[10px] font-medium ${img.isPrimary ? "text-amber-300" : "text-white/80 hover:text-amber-300"}`}
                  >
                    <LuStar size={12} className={img.isPrimary ? "fill-amber-300" : ""} />
                    {img.isPrimary ? "Primary" : "Set"}
                  </button>
                  <div className="flex">
                    <button type="button" onClick={() => reorderImage(idx, idx - 1)} className="text-white/70 hover:text-white" aria-label="Move left"><LuChevronUp size={13} className="-rotate-90" /></button>
                    <button type="button" onClick={() => reorderImage(idx, idx + 1)} className="text-white/70 hover:text-white" aria-label="Move right"><LuChevronDown size={13} className="-rotate-90" /></button>
                  </div>
                </div>
              </div>
              {variantColors.length > 0 && (
                <select
                  className="admin-input admin-select !py-1 mt-1.5 text-xs"
                  value={img.color && variantColors.includes(img.color) ? img.color : ""}
                  onChange={(e) => setImageColor(idx, e.target.value)}
                  aria-label="Image color"
                >
                  <option value="">All colors</option>
                  {variantColors.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          ))}
          <label className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:border-indigo-400 hover:text-indigo-500 text-xs">
            {uploading ? <span className="spinner" /> : (<><LuImagePlus size={22} /><span className="mt-1">Upload</span></>)}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadImages(e.target.files)} disabled={uploading} />
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-2">JPG, PNG, WEBP, AVIF up to 5MB each.</p>
      </Card>

      <Card title="Basic Information">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label required>Name (English)</Label>
              <input className="admin-input" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} required />
            </div>
            <div>
              <Label required>Name (Arabic)</Label>
              <input className="admin-input" dir="rtl" value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} required />
            </div>
          </div>
          <div>
            <Label required>Category</Label>
            <select className="admin-input admin-select" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label required>Base Price (OMR)</Label>
              <input type="number" step="0.001" min="0" className="admin-input" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} required />
            </div>
            <div>
              <Label>Sale Price (OMR)</Label>
              <input type="number" step="0.001" min="0" className="admin-input" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
            </div>
            <div>
              <Label>SKU</Label>
              <input className="admin-input" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <Label>Barcode</Label>
              <div className="flex items-center gap-2">
                <input className="admin-input" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Scan or type the item's code" />
                <button
                  type="button"
                  onClick={() => set("barcode", form.sku)}
                  disabled={!form.sku}
                  className="admin-btn admin-btn-secondary whitespace-nowrap text-xs disabled:opacity-40"
                  title="Copy the SKU into the barcode field"
                >
                  Use SKU
                </button>
              </div>
              {form.variants.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">Only used if this product has no variants below — each variant has its own barcode.</p>
              )}
            </div>
            {form.barcode.trim() && (
              <div className="flex justify-start sm:justify-end">
                <BarcodePreview value={form.barcode} className="h-14" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Description (English)</Label>
              <textarea className="admin-input" rows={3} value={form.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} />
            </div>
            <div>
              <Label>Description (Arabic)</Label>
              <textarea className="admin-input" rows={3} dir="rtl" value={form.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            {[
              { key: "isActive", label: "Active" }, { key: "isFeatured", label: "Featured" },
              { key: "isNew", label: "New Arrival" }, { key: "isBestSeller", label: "Best Seller" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form[key as keyof ProductFormValue] as boolean} onChange={(e) => set(key as keyof ProductFormValue, e.target.checked as never)} className="rounded" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Specifications" desc="These fields are defined per category. Choose a category to load its specifications.">
        {!form.categoryId ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <LuInfo size={16} /> Select a category to see its specifications.
          </div>
        ) : attrLoading ? (
          <div className="flex justify-center py-6"><span className="spinner" /></div>
        ) : attrDefs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <LuInfo size={16} /> This category has no specifications defined.{" "}
            <a href="/admin/categories" className="text-indigo-600 hover:underline">Manage attributes</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {attrDefs.map((def) => (
              <AttributeField key={def.key} def={def} value={form.attributes[def.key]} onChange={(v) => setAttr(def.key, v)} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Variants & Stock" desc="Optional. Add color/size combinations with their own stock and price adjustment.">
        <div className="space-y-3">
          {form.variants.map((v, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Color</label>
                  <input className="admin-input !py-1.5 text-sm" value={v.color} onChange={(e) => setVariant(idx, { color: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hex</label>
                  <div className="flex items-center gap-1">
                    <input type="color" value={v.colorHex || "#000000"} onChange={(e) => setVariant(idx, { colorHex: e.target.value })} className="w-8 h-8 rounded border border-slate-200 p-0.5 cursor-pointer flex-shrink-0" />
                    <input className="admin-input !py-1.5 text-sm" value={v.colorHex} onChange={(e) => setVariant(idx, { colorHex: e.target.value })} placeholder="#000" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Size</label>
                  <input className="admin-input !py-1.5 text-sm" value={v.size} onChange={(e) => setVariant(idx, { size: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">SKU</label>
                  <input className="admin-input !py-1.5 text-sm" value={v.sku} onChange={(e) => setVariant(idx, { sku: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stock</label>
                  <input type="number" min="0" className="admin-input !py-1.5 text-sm" value={v.stock} onChange={(e) => setVariant(idx, { stock: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">+/- Price</label>
                    <input type="number" step="0.001" className="admin-input !py-1.5 text-sm" value={v.priceAdjustment} onChange={(e) => setVariant(idx, { priceAdjustment: e.target.value })} />
                  </div>
                  <button type="button" onClick={() => removeVariant(idx)} className="p-2 rounded text-rose-500 hover:bg-rose-50 mb-0.5" aria-label="Remove variant"><LuTrash2 size={16} /></button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs text-slate-500 mb-1">Barcode</label>
                  <div className="flex items-center gap-1.5">
                    <input className="admin-input !py-1.5 text-sm" value={v.barcode} onChange={(e) => setVariant(idx, { barcode: e.target.value })} placeholder="Scan or type this variant's code" />
                    <button
                      type="button"
                      onClick={() => setVariant(idx, { barcode: v.sku })}
                      disabled={!v.sku}
                      className="admin-btn admin-btn-secondary whitespace-nowrap text-xs !py-1.5 disabled:opacity-40"
                      title="Copy the SKU into the barcode field"
                    >
                      Use SKU
                    </button>
                  </div>
                </div>
                {v.barcode.trim() && <BarcodePreview value={v.barcode} className="h-12" />}
              </div>

              {/* Multi-color breakdown for this option, e.g. yellow sleeves + blue body */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">
                  This option&apos;s own color is one flat color (e.g. a solid-colored bag). If this item mixes colors by
                  area instead (e.g. yellow sleeves, blue body), break it down here — it&apos;ll show as this option&apos;s
                  detail and swatch.
                </p>
                <div className="space-y-2">
                  {(v.colorParts || []).map((p, pIdx) => (
                    <div key={pIdx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                      <input
                        className="admin-input !py-1.5 text-sm"
                        placeholder="Area (e.g. Sleeves)"
                        value={p.part}
                        onChange={(e) => setColorPart(idx, pIdx, { part: e.target.value })}
                      />
                      <input
                        className="admin-input !py-1.5 text-sm"
                        placeholder="Color (e.g. Yellow)"
                        value={p.color}
                        onChange={(e) => setColorPart(idx, pIdx, { color: e.target.value })}
                      />
                      <input
                        type="color"
                        value={p.colorHex || "#000000"}
                        onChange={(e) => setColorPart(idx, pIdx, { colorHex: e.target.value })}
                        className="w-8 h-8 rounded border border-slate-200 p-0.5 cursor-pointer"
                        aria-label="Area color swatch"
                      />
                      <button type="button" onClick={() => removeColorPart(idx, pIdx)} className="p-2 rounded text-rose-500 hover:bg-rose-50" aria-label="Remove color area">
                        <LuTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addColorPart(idx)} className="admin-btn admin-btn-secondary inline-flex items-center gap-1.5 text-xs mt-2 !py-1.5">
                  <LuPlus size={13} /> Add color area
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addVariant} className="admin-btn admin-btn-secondary inline-flex items-center gap-1.5 text-sm">
            <LuPlus size={15} /> Add Variant
          </button>
        </div>
      </Card>

      <div className="flex items-center gap-3 sticky bottom-0 bg-slate-50/80 backdrop-blur-sm py-3 -mx-1 px-1 rounded-xl">
        <button type="submit" disabled={saving || uploading} className="admin-btn admin-btn-primary px-8 disabled:opacity-60">
          {saving ? "Saving..." : submitLabel}
        </button>
        <button type="button" onClick={() => router.push("/admin/products")} className="admin-btn admin-btn-secondary">Cancel</button>
        {productId && <span className="text-xs text-slate-400 ml-auto">ID: {productId}</span>}
      </div>
    </form>
  );
}

/** Renders the correct input control for a single category attribute. */
function AttributeField({
  def,
  value,
  onChange,
}: {
  def: CategoryAttribute;
  value: AttributeValue;
  onChange: (v: AttributeValue) => void;
}) {
  const label = (
    <Label required={def.isRequired}>
      {def.labelEn}
      {def.labelAr && <span className="text-slate-400 font-normal text-xs mr-1" dir="rtl"> ({def.labelAr})</span>}
    </Label>
  );

  if (def.type === "BOOLEAN") {
    return (
      <div>
        {label}
        <label className="flex items-center gap-2 text-sm cursor-pointer h-[42px]">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="rounded" />
          <span className="text-slate-600">{value ? "Yes" : "No"}</span>
        </label>
      </div>
    );
  }

  if (def.type === "NUMBER") {
    return (
      <div>
        {label}
        <div className="flex items-center gap-2">
          <input type="number" className="admin-input" value={value == null ? "" : String(value)} placeholder={def.placeholder || ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
          {def.unit && <span className="text-sm text-slate-400 flex-shrink-0">{def.unit}</span>}
        </div>
      </div>
    );
  }

  if (def.type === "SELECT") {
    return (
      <div>
        {label}
        <select className="admin-input admin-select" value={(value as string) || ""} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Select...</option>
          {def.options.map((o) => <option key={o.value} value={o.value}>{o.labelEn}</option>)}
        </select>
      </div>
    );
  }

  if (def.type === "COLOR") {
    const selected = (value as string) || "";
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const active = selected === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(active ? null : o.value)}
                title={o.labelEn}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: o.hex || "#ccc" }} />
                {o.labelEn}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (def.type === "MULTISELECT") {
    const selected: string[] = Array.isArray(value) ? value : [];
    const toggle = (val: string) =>
      onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
    return (
      <div className="sm:col-span-2">
        {label}
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const active = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={`rounded-full border px-3 py-1 text-xs ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                {o.labelEn}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // TEXT
  return (
    <div>
      {label}
      <input className="admin-input" value={(value as string) || ""} placeholder={def.placeholder || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
