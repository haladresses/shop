"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { LuChevronLeft } from "react-icons/lu";
import ProductForm, {
  buildProductPayload,
  type ProductFormValue,
} from "@/components/admin/ProductForm";
import type { ProductAttributes } from "@/lib/attributes";

type ApiVariant = {
  color: string | null;
  colorHex: string | null;
  size: string | null;
  sku: string | null;
  priceAdjustment: string | number | null;
  isActive: boolean;
  inventory?: { quantity: number } | null;
};

type ApiImage = { url: string; isPrimary: boolean; altEn?: string | null; altAr?: string | null };

type ApiProduct = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  categoryId: string;
  basePrice: string | number;
  salePrice: string | number | null;
  sku: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  attributes: ProductAttributes | null;
  images: ApiImage[];
  variants: ApiVariant[];
};

function toFormValue(p: ApiProduct): ProductFormValue {
  return {
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    descriptionEn: p.descriptionEn ?? "",
    descriptionAr: p.descriptionAr ?? "",
    categoryId: p.categoryId,
    basePrice: String(p.basePrice ?? ""),
    salePrice: p.salePrice == null ? "" : String(p.salePrice),
    sku: p.sku ?? "",
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    attributes: p.attributes ?? {},
    images: (p.images ?? []).map((i) => ({
      url: i.url,
      isPrimary: i.isPrimary,
      altEn: i.altEn ?? undefined,
      altAr: i.altAr ?? undefined,
    })),
    variants: (p.variants ?? []).map((v) => ({
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      size: v.size ?? "",
      sku: v.sku ?? "",
      priceAdjustment: v.priceAdjustment == null ? "0" : String(v.priceAdjustment),
      stock: String(v.inventory?.quantity ?? 0),
      isActive: v.isActive,
    })),
  };
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<ProductFormValue | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setInitial(toFormValue(d.data));
        else setLoadError(d.error || "Product not found");
      })
      .catch(() => setLoadError("Failed to load product"));
  }, [id]);

  const handleSubmit = async (form: ProductFormValue) => {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildProductPayload(form)),
    });
    const data = await res.json();
    return { success: !!data.success, error: data.error };
  };

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <LuChevronLeft size={16} /> Back to products
        </Link>
        <h1 className="text-xl font-semibold text-slate-800">Edit Product</h1>
        <p className="text-sm text-slate-500">Update images, specifications and variants.</p>
      </div>

      {loadError ? (
        <div className="bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl border border-rose-100">{loadError}</div>
      ) : !initial ? (
        <div className="flex justify-center py-16"><span className="spinner" /></div>
      ) : (
        <ProductForm initial={initial} productId={id} onSubmit={handleSubmit} submitLabel="Save Changes" />
      )}
    </div>
  );
}
