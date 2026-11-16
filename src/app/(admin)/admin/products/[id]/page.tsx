"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { LuChevronLeft, LuMessageSquare } from "react-icons/lu";
import ProductForm, {
  buildProductPayload,
  productToFormValue,
  type ProductFormValue,
} from "@/components/admin/ProductForm";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<ProductFormValue | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    // Force a fresh fetch — otherwise the browser/Next.js can serve a cached
    // response and the edit form loads stale data (e.g. colors saved a moment
    // ago don't show up when you come back into this page).
    fetch(`/api/products/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setInitial(productToFormValue(d.data));
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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <LuChevronLeft size={16} /> Back to products
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">Edit Product</h1>
          <p className="text-sm text-slate-500">Update images, specifications and variants.</p>
        </div>
        <Link
          href={`/admin/products/${id}/whatsapp-reviews`}
          className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
        >
          <LuMessageSquare size={16} /> WhatsApp Reviews
        </Link>
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
