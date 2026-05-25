"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Product = {
  id: string;
  nameEn: string;
  nameAr: string;
  sku?: string;
  basePrice: number;
  salePrice?: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  createdAt: string;
  category: { nameEn: string };
  images: { url: string }[];
  _count: { variants: number; reviews: number };
};

type Category = { id: string; nameEn: string };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "",
    categoryId: "", basePrice: "", salePrice: "", sku: "",
    isActive: true, isFeatured: false, isNew: true, isBestSeller: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search, ...(categoryFilter && { categoryId: categoryFilter }) });
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    if (data.success) { setProducts(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, search, categoryFilter]);

  useEffect(() => {
    fetch("/api/categories?all=true").then(r => r.json()).then(d => { if (d.success) setCategories(d.data); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleField = async (id: string, field: string, value: boolean) => {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !value }),
    });
    load();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) alert(data.error);
    else load();
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        basePrice: parseFloat(form.basePrice),
        salePrice: form.salePrice ? parseFloat(form.salePrice) : null,
      }),
    });
    const data = await res.json();
    if (!data.success) { setError(data.error); } else {
      setShowModal(false);
      load();
    }
    setSaving(false);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 flex-wrap">
          <input className="admin-input w-56" placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="admin-input admin-select w-44" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
          </select>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => { setError(""); setShowModal(true); }}>
          + Add Product
        </button>
      </div>

      <div className="admin-card">
        {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Variants</th>
                  <th>Flags</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.images[0] ? (
                        <img src={p.images[0].url} alt={p.nameEn} className="w-12 h-12 object-cover rounded-lg" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-xl">👗</div>
                      )}
                    </td>
                    <td>
                      <div className="font-medium text-slate-800">{p.nameEn}</div>
                      <div className="text-xs text-slate-400 dir-rtl" dir="rtl">{p.nameAr}</div>
                      {p.sku && <div className="text-xs text-slate-400">SKU: {p.sku}</div>}
                    </td>
                    <td className="text-slate-600">{p.category.nameEn}</td>
                    <td>
                      <div className="font-medium">{Number(p.basePrice).toFixed(3)}</div>
                      {p.salePrice && <div className="text-xs text-green-600">{Number(p.salePrice).toFixed(3)}</div>}
                    </td>
                    <td className="text-center">{p._count.variants}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {p.isFeatured && <span className="badge badge-confirmed">Featured</span>}
                        {p.isNew && <span className="badge badge-processing">New</span>}
                        {p.isBestSeller && <span className="badge badge-delivered">Best Seller</span>}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleField(p.id, "isActive", p.isActive)}
                        className={`badge cursor-pointer ${p.isActive ? "badge-delivered" : "badge-cancelled"}`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link href={`/admin/products/${p.id}`} className="admin-btn admin-btn-secondary text-xs py-1">Edit</Link>
                        <button onClick={() => deleteProduct(p.id)} className="admin-btn admin-btn-danger text-xs py-1">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">No products found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Total: {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">← Prev</button>
              <span className="text-sm self-center">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">Add Product</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form onSubmit={createProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (EN) *</label>
                  <input className="admin-input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (AR) *</label>
                  <input className="admin-input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                <select className="admin-input admin-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Base Price (OMR) *</label>
                  <input type="number" step="0.001" min="0" className="admin-input" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sale Price (OMR)</label>
                  <input type="number" step="0.001" min="0" className="admin-input" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                  <input className="admin-input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (EN)</label>
                <textarea className="admin-input" rows={2} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (AR)</label>
                <textarea className="admin-input" rows={2} dir="rtl" value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: "isActive", label: "Active" }, { key: "isFeatured", label: "Featured" },
                  { key: "isNew", label: "New Arrival" }, { key: "isBestSeller", label: "Best Seller" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={(form as never)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="admin-btn admin-btn-primary flex-1 justify-center">
                  {saving ? "Creating..." : "Create Product"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
