"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuX, LuImagePlus, LuStar, LuTrash2, LuPlus, LuChevronUp, LuChevronDown,
  LuGripVertical, LuInfo, LuSlidersHorizontal, LuCircleCheck, LuExternalLink,
  LuWandSparkles,
} from "react-icons/lu";
import {
  type CategoryAttribute,
  type CustomSpec,
  type ProductAttributes,
  type AttributeValue,
  fetchCategoryAttributes,
  isEmptyAttributeValue,
  normalizeCustomSpecs,
} from "@/lib/attributes";
import { categorySelectOptions, type FlatCategory } from "@/lib/categoryTree";
import AdminModal from "./AdminModal";
import BarcodePreview from "./BarcodePreview";
import AttributeField from "./attributes/AttributeField";
import CategoryAttributesEditor from "./attributes/CategoryAttributesEditor";
import CustomSpecsEditor from "./attributes/CustomSpecsEditor";
import ProductTaxField from "./tax/ProductTaxField";

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
  /** Set for variants that already exist — they are updated in place. */
  id?: string;
  /** Stock when the form was loaded; only the change is booked to the ledger. */
  stockBase?: string;
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
  costPrice: string;
  sku: string;
  barcode: string;
  /** VAT rate override; "" = inherit from the category. */
  taxRateId: string;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  attributes: ProductAttributes;
  /** Specifications that only this product has. */
  customSpecs: CustomSpec[];
  images: ProductImageState[];
  variants: VariantState[];
};

type Category = FlatCategory & { parentId: string | null; isActive: boolean; taxRateId?: string | null };

export const emptyProductForm: ProductFormValue = {
  nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "",
  categoryId: "", basePrice: "", salePrice: "", costPrice: "", sku: "", barcode: "", taxRateId: "",
  isActive: true, isFeatured: false, isNew: true, isBestSeller: false,
  attributes: {}, customSpecs: [], images: [], variants: [],
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
    costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
    sku: form.sku || undefined,
    barcode: form.barcode || undefined,
    taxRateId: form.taxRateId || null,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    isNew: form.isNew,
    isBestSeller: form.isBestSeller,
    attributes: form.attributes,
    customSpecs: form.customSpecs
      .map((s) => ({
        labelEn: s.labelEn.trim(),
        labelAr: s.labelAr.trim(),
        valueEn: s.valueEn.trim(),
        valueAr: s.valueAr.trim(),
      }))
      .filter((s) => (s.labelEn || s.labelAr) && (s.valueEn || s.valueAr)),
    images: form.images.map((img, i) => ({
      url: img.url,
      isPrimary: img.isPrimary,
      sortOrder: i,
      color: img.color || undefined,
    })),
    variants: form.variants.map((v) => ({
      id: v.id || undefined,
      stockBase: v.id && v.stockBase !== undefined ? parseInt(v.stockBase) || 0 : undefined,
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

type ApiColorPart = { part: string; color: string; colorHex?: string | null };

/** The product as returned by GET /api/products/[id] (only the fields the form uses). */
export type ApiProductForForm = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  categoryId: string;
  basePrice: string | number;
  salePrice: string | number | null;
  costPrice?: string | number | null;
  sku: string | null;
  barcode?: string | null;
  taxRateId?: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  attributes: ProductAttributes | null;
  customSpecs?: unknown;
  images: { url: string; isPrimary: boolean; altEn?: string | null; altAr?: string | null; color?: string | null }[];
  variants: {
    id?: string;
    color: string | null;
    colorHex: string | null;
    colorParts?: ApiColorPart[] | null;
    size: string | null;
    sku: string | null;
    barcode?: string | null;
    priceAdjustment: string | number | null;
    isActive: boolean;
    inventory?: { quantity: number } | null;
  }[];
};

export function productToFormValue(p: ApiProductForForm): ProductFormValue {
  return {
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    descriptionEn: p.descriptionEn ?? "",
    descriptionAr: p.descriptionAr ?? "",
    categoryId: p.categoryId,
    basePrice: String(p.basePrice ?? ""),
    salePrice: p.salePrice == null ? "" : String(p.salePrice),
    costPrice: p.costPrice == null ? "" : String(p.costPrice),
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    taxRateId: p.taxRateId ?? "",
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    attributes: p.attributes ?? {},
    customSpecs: normalizeCustomSpecs(p.customSpecs),
    images: (p.images ?? []).map((i) => ({
      url: i.url,
      isPrimary: i.isPrimary,
      altEn: i.altEn ?? undefined,
      altAr: i.altAr ?? undefined,
      color: i.color ?? undefined,
    })),
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      stockBase: String(v.inventory?.quantity ?? 0),
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      colorParts: (v.colorParts ?? []).map((cp) => ({
        part: cp.part,
        color: cp.color,
        colorHex: cp.colorHex ?? "",
      })),
      size: v.size ?? "",
      sku: v.sku ?? "",
      barcode: v.barcode ?? "",
      priceAdjustment: v.priceAdjustment == null ? "0" : String(v.priceAdjustment),
      stock: String(v.inventory?.quantity ?? 0),
      isActive: v.isActive,
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
  const [attrErrors, setAttrErrors] = useState<Record<string, string>>({});
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const attrRequest = useRef(0);

  useEffect(() => {
    fetch("/api/categories?tree=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.data); });
  }, []);

  const categoryOptions = useMemo(() => categorySelectOptions(categories), [categories]);
  const selectedCategory = categoryOptions.find((c) => c.id === form.categoryId);

  // Load the category's fields (inherited + own) whenever the category changes.
  // A counter drops responses that arrive after a newer category was chosen.
  const loadAttrs = useCallback(async (categoryId: string) => {
    const req = ++attrRequest.current;
    if (!categoryId) { setAttrDefs([]); setAttrLoading(false); return; }
    setAttrLoading(true);
    const defs = await fetchCategoryAttributes(categoryId);
    if (req !== attrRequest.current) return;
    setAttrDefs(defs);
    setAttrLoading(false);
  }, []);

  useEffect(() => { loadAttrs(form.categoryId); }, [form.categoryId, loadAttrs]);

  const set = <K extends keyof ProductFormValue>(key: K, value: ProductFormValue[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setAttr = (key: string, value: AttributeValue) => {
    setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }));
    if (attrErrors[key]) {
      setAttrErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => k !== key)));
    }
  };

  const attrKeys = useMemo(() => new Set(attrDefs.map((d) => d.key)), [attrDefs]);
  // Ready-made "extra spec" suggestions skip anything the category already asks for.
  const takenForSuggestions = useMemo(
    () => new Set([...attrKeys, ...attrDefs.map((d) => d.labelEn.trim().toLowerCase())]),
    [attrKeys, attrDefs],
  );
  const answered = attrDefs.filter((d) => !isEmptyAttributeValue(form.attributes[d.key])).length;
  const requiredLeft = attrDefs.filter((d) => d.isRequired && isEmptyAttributeValue(form.attributes[d.key]));
  // Answers saved for fields this category doesn't have (e.g. after switching category).
  const leftoverKeys = !attrLoading && form.categoryId
    ? Object.keys(form.attributes).filter((k) => !attrKeys.has(k) && !isEmptyAttributeValue(form.attributes[k]))
    : [];

  const removeLeftovers = () =>
    setForm((f) => ({
      ...f,
      attributes: Object.fromEntries(Object.entries(f.attributes).filter(([k]) => attrKeys.has(k))),
    }));

  const closeFields = () => {
    if (fieldsDirty && !window.confirm("Discard your unsaved changes to the category fields?")) return;
    setFieldsOpen(false);
    setFieldsDirty(false);
  };

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

  // Fresh, unique barcodes from the server (13-digit in-store EAN codes).
  const [barcodeBusy, setBarcodeBusy] = useState<string | null>(null);
  const reserveBarcodes = async (count: number, busyKey: string): Promise<string[] | null> => {
    setBarcodeBusy(busyKey);
    const d = await fetch("/api/products/barcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserve: count }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBarcodeBusy(null);
    if (!d?.success) {
      setError(d?.error || "Could not generate a barcode");
      return null;
    }
    return d.data.codes as string[];
  };
  const generateProductBarcode = async () => {
    const codes = await reserveBarcodes(1, "product");
    if (codes) set("barcode", codes[0]);
  };
  const generateVariantBarcode = async (idx: number) => {
    const codes = await reserveBarcodes(1, `variant-${idx}`);
    if (codes) setVariant(idx, { barcode: codes[0] });
  };
  const variantsWithoutBarcode = form.variants.filter((v) => !v.barcode.trim()).length;
  const generateMissingVariantBarcodes = async () => {
    const codes = await reserveBarcodes(variantsWithoutBarcode, "variants");
    if (!codes) return;
    let i = 0;
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.barcode.trim() ? v : { ...v, barcode: codes[i++] ?? "" })) }));
  };

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

    if (requiredLeft.length) {
      setAttrErrors(Object.fromEntries(requiredLeft.map((d) => [d.key, "This field is required."])));
      setError(`Please answer the required specifications: ${requiredLeft.map((d) => d.labelEn || d.labelAr).join(", ")}`);
      document.getElementById("product-specs")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
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
    <form onSubmit={handleSubmit} className="space-y-5 w-full">
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
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 bg-black/50 opacity-0 group-hover:opacity-100">
                  <span className="text-white/80 cursor-grab"><LuGripVertical size={14} /></span>
                  <button type="button" onClick={() => removeImage(idx)} className="w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove image">
                    <LuX size={12} />
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-1 bg-black/55">
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
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}{c.isActive ? "" : " (hidden)"}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">The category decides which specification fields this product has.</p>
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
        </div>
      </Card>

      <Card title="Price">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Purchase Price (OMR)</Label>
              <input type="number" step="0.001" min="0" className="admin-input" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="What you paid per unit" />
            </div>
            <div>
              <Label required>Selling Price (OMR)</Label>
              <input type="number" step="0.001" min="0" className="admin-input" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} required />
            </div>
            <div>
              <Label>Sale Price (OMR)</Label>
              <input type="number" step="0.001" min="0" className="admin-input" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} placeholder="Discounted price (optional)" />
            </div>
          </div>
          <MarginPreview cost={form.costPrice} price={form.salePrice || form.basePrice} />
          <ProductTaxField
            value={form.taxRateId}
            onChange={(v) => set("taxRateId", v)}
            categoryId={form.categoryId}
            categories={categories}
            price={form.salePrice || form.basePrice}
          />
        </div>
      </Card>

      <Card title="SKU & Barcode">
        <div className="space-y-4">
          <div>
            <Label>SKU</Label>
            <input className="admin-input" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <Label>Barcode</Label>
              <div className="flex items-center gap-2">
                <input className="admin-input" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Scan, type, generate or leave empty" />
                <button
                  type="button"
                  onClick={generateProductBarcode}
                  disabled={!!form.barcode.trim() || barcodeBusy === "product"}
                  className="admin-btn admin-btn-secondary whitespace-nowrap text-xs disabled:opacity-40"
                  title="Create a new unique barcode for this item"
                >
                  <LuWandSparkles size={13} /> Generate
                </button>
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
                <p className="text-xs text-slate-400 mt-1">
                  The product&apos;s barcode: the same code on labels, at the POS and in every search, for all its sizes and colours. Leave it empty and one is created automatically when you save.
                </p>
              )}
            </div>
            {form.barcode.trim() && (
              <div className="flex justify-start sm:justify-end">
                <BarcodePreview value={form.barcode} className="h-14" />
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Shop Visibility" desc="Active products are shown in the shop. The other options add the product to those sections.">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
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
      </Card>

      <div id="product-specs" className="admin-card p-5 sm:p-6 scroll-mt-4">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-800">Specifications</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedCategory
                ? <>Fields from <span className="font-medium text-slate-700">{selectedCategory.label}</span>, shown in the Specifications tab of the product page.</>
                : "Choose a category to load its fields."}
            </p>
          </div>
          {form.categoryId && (
            <button type="button" onClick={() => setFieldsOpen(true)} className="admin-btn admin-btn-secondary text-sm">
              <LuSlidersHorizontal size={15} /> Edit fields
            </button>
          )}
        </div>

        {attrDefs.length > 0 && !attrLoading && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">
              <strong className="font-semibold text-slate-800 tabular-nums">{answered} of {attrDefs.length}</strong> details filled
            </span>
            {requiredLeft.length > 0 ? (
              <span className="text-rose-600 font-medium">{requiredLeft.length} required still empty</span>
            ) : (
              <span className="text-emerald-700 inline-flex items-center gap-1"><LuCircleCheck size={14} /> All required details filled</span>
            )}
          </div>
        )}

        {!form.categoryId ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <LuInfo size={16} /> Select a category to see its fields.
          </div>
        ) : attrLoading ? (
          <div className="flex justify-center py-6"><span className="spinner" /></div>
        ) : attrDefs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-700">This category has no fields yet</p>
            <p className="text-xs text-slate-500 mt-1">Add fields like fabric or length once, and every product in the category gets them.</p>
            <button type="button" onClick={() => setFieldsOpen(true)} className="admin-btn admin-btn-primary mt-3 text-sm">
              <LuPlus size={15} /> Set up fields
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
            {attrDefs.map((def) => (
              <AttributeField
                key={def.key}
                def={def}
                value={form.attributes[def.key]}
                onChange={(v) => setAttr(def.key, v)}
                error={attrErrors[def.key]}
                showSource
              />
            ))}
          </div>
        )}

        {leftoverKeys.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <LuInfo size={14} className="flex-shrink-0" />
            <span className="flex-1 min-w-[200px]">
              This product still has {leftoverKeys.length} answer{leftoverKeys.length === 1 ? "" : "s"} for fields this category doesn&apos;t use
              ({leftoverKeys.join(", ")}). They aren&apos;t shown to shoppers.
            </span>
            <button type="button" onClick={removeLeftovers} className="font-medium underline hover:no-underline">Remove them</button>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100">
          <h4 className="text-sm font-semibold text-slate-700">
            Extra specifications <span className="font-normal text-slate-400">· this product only</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            For details other products in the category don&apos;t need. They appear after the category fields.
          </p>
          <CustomSpecsEditor specs={form.customSpecs} onChange={(s) => set("customSpecs", s)} takenKeys={takenForSuggestions} />
        </div>
      </div>

      <Card title="Variants & Stock" desc="Optional. Add color/size combinations with their own stock and price adjustment.">
        {variantsWithoutBarcode > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <span>
              {variantsWithoutBarcode} option{variantsWithoutBarcode === 1 ? " uses" : "s use"} the product&apos;s barcode. Give {variantsWithoutBarcode === 1 ? "it its" : "them their"} own only if each size / colour should scan separately.
            </span>
            <button
              type="button"
              onClick={generateMissingVariantBarcodes}
              disabled={barcodeBusy === "variants"}
              className="admin-btn admin-btn-secondary !py-1.5 text-xs disabled:opacity-40"
            >
              <LuWandSparkles size={13} /> Generate {variantsWithoutBarcode === 1 ? "it" : `all ${variantsWithoutBarcode}`}
            </button>
          </div>
        )}
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
                  <label className="block text-xs text-slate-500 mb-1" title="Only needed if this exact size / colour should scan on its own; otherwise the product's barcode is used.">
                    Own barcode <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input className="admin-input !py-1.5 text-sm" value={v.barcode} onChange={(e) => setVariant(idx, { barcode: e.target.value })} placeholder="Uses the product's barcode if empty" />
                    <button
                      type="button"
                      onClick={() => generateVariantBarcode(idx)}
                      disabled={!!v.barcode.trim() || barcodeBusy === `variant-${idx}`}
                      className="admin-btn admin-btn-secondary whitespace-nowrap text-xs !py-1.5 disabled:opacity-40"
                      title="Create a new unique barcode for this option"
                    >
                      <LuWandSparkles size={13} /> Generate
                    </button>
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
                  area instead (e.g. yellow sleeves, blue body), break it down here. It&apos;ll show as this option&apos;s
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

      <div className="admin-savebar">
        <button type="submit" disabled={saving || uploading} className="admin-btn admin-btn-primary px-8 disabled:opacity-60">
          {saving ? "Saving..." : submitLabel}
        </button>
        <button type="button" onClick={() => router.push("/admin/products")} className="admin-btn admin-btn-secondary">Cancel</button>
        {productId && <span className="text-xs text-slate-400 ml-auto">ID: {productId}</span>}
      </div>

      <AdminModal
        open={fieldsOpen}
        onClose={closeFields}
        className="!max-w-3xl"
        title={selectedCategory ? `Fields for ${selectedCategory.label}` : "Category fields"}
      >
        {fieldsOpen && form.categoryId && (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Changes apply to every product in this category. Your product&apos;s answers are kept.{" "}
              <a
                href={`/admin/categories/${form.categoryId}/attributes`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
              >
                Open the full page with live preview <LuExternalLink size={12} />
              </a>
            </p>
            <CategoryAttributesEditor
              categoryId={form.categoryId}
              layout="modal"
              onDirtyChange={setFieldsDirty}
              onSaved={() => {
                setFieldsDirty(false);
                setFieldsOpen(false);
                loadAttrs(form.categoryId);
              }}
            />
          </>
        )}
      </AdminModal>
    </form>
  );
}

/** Live profit-per-unit preview from the purchase and selling price. */
function MarginPreview({ cost, price }: { cost: string; price: string }) {
  const c = parseFloat(cost);
  const p = parseFloat(price);
  if (!(p > 0)) return null;
  if (!(c >= 0) || cost === "") {
    return (
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        Add a purchase price to track profit &amp; loss and stock value for this product.
      </p>
    );
  }
  const profit = p - c;
  const margin = (profit / p) * 100;
  const markup = c > 0 ? (profit / c) * 100 : null;
  const good = profit > 0;
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-1 text-sm rounded-lg px-3 py-2 border ${good ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"}`}>
      <span>Profit / unit: <strong>{profit.toFixed(3)} OMR</strong></span>
      <span>Margin: <strong>{margin.toFixed(1)}%</strong></span>
      {markup !== null && <span>Markup: <strong>{markup.toFixed(1)}%</strong></span>}
      {!good && <span className="font-medium">Selling below cost: this product loses money.</span>}
    </div>
  );
}
