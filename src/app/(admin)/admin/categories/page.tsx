"use client";
import { useEffect, useState, useCallback } from "react";

type Category = {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
  image?: string;
  isActive: boolean;
  sortOrder: number;
  parent?: { nameEn: string } | null;
  _count: { products: number };
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ nameEn: "", nameAr: "", parentId: "", image: "", isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    if (data.success) { setCategories(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, []);

  const loadParents = useCallback(async () => {
    const res = await fetch("/api/categories?all=true&parentOnly=true");
    const data = await res.json();
    if (data.success) setParentCategories(data.data);
  }, []);

  useEffect(() => { load(); loadParents(); }, [load, loadParents]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nameEn: "", nameAr: "", parentId: "", image: "", isActive: true, sortOrder: 0 });
    setError("");
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ nameEn: cat.nameEn, nameAr: cat.nameAr, parentId: cat.parent ? "" : "", image: cat.image || "", isActive: cat.isActive, sortOrder: cat.sortOrder });
    setError("");
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const url = editing ? `/api/categories/${editing.id}` : "/api/categories";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, parentId: form.parentId || null }),
    });
    const data = await res.json();
    if (!data.success) {
      setError(data.error);
    } else {
      setShowModal(false);
      load();
      loadParents();
    }
    setSaving(false);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) alert(data.error);
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{total} categories total</p>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          + Add Category
        </button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name (EN)</th>
                  <th>Name (AR)</th>
                  <th>Parent</th>
                  <th>Products</th>
                  <th>Sort</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="font-medium">{cat.nameEn}</td>
                    <td dir="rtl">{cat.nameAr}</td>
                    <td className="text-slate-500">{cat.parent?.nameEn || "—"}</td>
                    <td className="text-center">{cat._count.products}</td>
                    <td className="text-center">{cat.sortOrder}</td>
                    <td>
                      <span className={`badge ${cat.isActive ? "badge-delivered" : "badge-cancelled"}`}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(cat)} className="admin-btn admin-btn-secondary text-xs py-1">Edit</button>
                        <button onClick={() => deleteCategory(cat.id)} className="admin-btn admin-btn-danger text-xs py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No categories yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">{editing ? "Edit Category" : "Add Category"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (English)</label>
                  <input className="admin-input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (Arabic)</label>
                  <input className="admin-input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category</label>
                  <select className="admin-input admin-select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                    <option value="">None (top-level)</option>
                    {parentCategories.map((p) => <option key={p.id} value={p.id}>{p.nameEn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                  <input type="number" className="admin-input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                <input className="admin-input" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="/images/category.jpg" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Active</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="admin-btn admin-btn-primary flex-1 justify-center">
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
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
