"use client";
import Link from "next/link";
import { LuChevronLeft } from "react-icons/lu";
import ProductForm, {
  emptyProductForm,
  buildProductPayload,
  type ProductFormValue,
} from "@/components/admin/ProductForm";

export default function NewProductPage() {
  const handleSubmit = async (form: ProductFormValue) => {
    const res = await fetch("/api/products", {
      method: "POST",
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
        <h1 className="text-xl font-semibold text-slate-800">Add Product</h1>
        <p className="text-sm text-slate-500">Create a new product with images, specifications and variants.</p>
      </div>
      <ProductForm initial={emptyProductForm} onSubmit={handleSubmit} submitLabel="Create Product" />
    </div>
  );
}
