"use client";
import { useEffect, useState, useCallback } from "react";
import { LuChevronLeft, LuChevronRight, LuImage, LuPlus, LuX } from "react-icons/lu";

type Product = {
  id: string;
  nameEn: string;
  nameAr: string;
  sku?: string;
  basePrice: number;
  salePrice?: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  category: { nameEn: string };
  images: { url: string }[];
  _count: { variants: number; reviews: number };
};

type Category = { id: string; nameEn: string };

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({
    nameEn: "", nameAr: "", categoryId: "", basePrice: "", salePrice: "", sku: "",
    descriptionEn: "", descriptionAr: "", isActive: true, isNew: true, isFeatured: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.success) setUser(d.data); });
    fetch("/api/categories?all=true").then(r => r.json()).then(d => { if (d.success) setCategories(d.data); });
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search, sellerId: user.id });
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    if (data.success) { setProducts(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, search, user]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
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
      setForm({ nameEn: "", nameAr: "", categoryId: "", basePrice: "", salePrice: "", sku: "", descriptionEn: "", descriptionAr: "", isActive: true, isNew: true, isFeatured: false });
      load();
    }
    setSaving(false);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">My Products</h2>
          <p className="text-sm text-slate-500">{total} product{total === 1 ? "" : "s"} in total</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          onClick={() => { setError(""); setShowModal(true); }}
        >
          <LuPlus size={16} /> Add Product
        </button>
      </div>

      <div className="flex gap-3">
        <input
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-indigo-300"
          placeholder="Search products…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Image</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0].url} alt={p.nameEn} className="w-12 h-12 object-cover rounded-lg" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300"><LuImage size={20} /></div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.nameEn}</div>
                      <div className="text-xs text-slate-400" dir="rtl">{p.nameAr}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.category.nameEn}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{Number(p.basePrice).toFixed(3)} OMR</div>
                      {p.salePrice && <div className="text-xs text-green-600">{Number(p.salePrice).toFixed(3)} OMR</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                      >
                        {p.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">{search ? "No products match your search." : "No products yet. Add your first product."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40"><LuChevronLeft size={14} /> Previous</button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40">Next <LuChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {/* Create Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-800">Add Product</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close"><LuX size={20} /></button>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form onSubmit={createProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (EN) *</label>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (AR) *</label>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (OMR) *</label>
                  <input type="number" step="0.001" min="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sale Price</label>
                  <input type="number" step="0.001" min="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (EN)</label>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300" rows={2} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} />
              </div>
              <div className="flex gap-4">
                {[{ key: "isActive", label: "Active" }, { key: "isNew", label: "New Arrival" }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={(form as never)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                  {saving ? "Creating…" : "Create Product"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
