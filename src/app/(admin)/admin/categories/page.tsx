"use client";
import { useEffect, useState, useCallback } from "react";
import {
  LuX, LuPlus, LuPencil, LuTrash2, LuImagePlus, LuLayers, LuTags,
  LuFolderTree, LuPackage, LuCircleCheck, LuSearch, LuChevronLeft, LuChevronRight,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

type Category = {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
  image?: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId?: string | null;
  parent?: { nameEn: string; nameAr: string } | null;
  _count: { products: number; children: number };
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ nameEn: "", nameAr: "", parentId: "", image: "", isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(search && { search }) });
    const res = await fetch(`/api/categories?${params}`);
    const data = await res.json();
    if (data.success) { setCategories(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, search]);

  const loadParents = useCallback(async () => {
    const res = await fetch("/api/categories?all=true&parentOnly=true");
    const data = await res.json();
    if (data.success) setParentCategories(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadParents(); }, [loadParents]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nameEn: "", nameAr: "", parentId: "", image: "", isActive: true, sortOrder: 0 });
    setError("");
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      nameEn: cat.nameEn,
      nameAr: cat.nameAr,
      parentId: cat.parentId || "",
      image: cat.image || "",
      isActive: cat.isActive,
      sortOrder: cat.sortOrder,
    });
    setError("");
    setShowModal(true);
  };

  const uploadImage = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setForm((f) => ({ ...f, image: data.data.url }));
      else setError(data.error || "Upload failed");
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
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

  const toggleActive = async (cat: Category) => {
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    load();
  };

  const deleteCategory = async (cat: Category) => {
    setDeleteError("");
    setDeleteTarget(cat);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) {
      setDeleteError(data.error || "Could not delete category");
      return;
    }
    setDeleteTarget(null);
    load();
    loadParents();
  };

  const totalPages = Math.ceil(total / 20);
  const activeCount = categories.filter((c) => c.isActive).length;
  const topLevelCount = categories.filter((c) => !c.parentId).length;
  const withProducts = categories.filter((c) => c._count.products > 0).length;

  const stats = [
    { label: "Total Categories", value: total, icon: LuLayers, accent: "from-indigo-500 to-violet-500", ring: "ring-indigo-100" },
    { label: "Active", value: activeCount, icon: LuCircleCheck, accent: "from-emerald-400 to-teal-500", ring: "ring-emerald-100" },
    { label: "Top-level", value: topLevelCount, icon: LuFolderTree, accent: "from-sky-400 to-blue-500", ring: "ring-sky-100" },
    { label: "With Products", value: withProducts, icon: LuPackage, accent: "from-amber-400 to-orange-500", ring: "ring-amber-100" },
  ];

  // Exclude the category being edited from the parent dropdown to avoid cycles
  const parentOptions = parentCategories.filter((p) => p.id !== editing?.id);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${s.accent} ring-4 ${s.ring} flex items-center justify-center text-white flex-shrink-0`}>
              <s.icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">{s.value}</p>
              <p className="text-xs sm:text-sm text-slate-500 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="admin-input pl-9"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          <LuPlus size={16} /> Add Category
        </button>
      </div>

      {/* List */}
      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <LuTags size={40} className="mb-3 text-slate-300" />
            <p className="text-sm">{search ? "No categories match your search" : "No categories yet"}</p>
            {!search && (
              <button onClick={openCreate} className="admin-btn admin-btn-primary mt-4 text-sm">
                <LuPlus size={15} /> Create your first category
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {categories.map((cat) => (
                <div key={cat.id} className="p-4 flex gap-3">
                  <div className="relative flex-shrink-0">
                    <Thumb cat={cat} />
                    <button
                      onClick={() => toggleActive(cat)}
                      title={cat.isActive ? "Active (tap to disable)" : "Inactive (tap to enable)"}
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white ${cat.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{cat.nameEn}</p>
                        <p className="text-sm text-slate-500 truncate" dir="rtl">{cat.nameAr}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => openEdit(cat)} className="admin-btn admin-btn-secondary text-xs py-1.5 px-2.5"><LuPencil size={13} /></button>
                        <button onClick={() => deleteCategory(cat)} className="admin-btn admin-btn-danger text-xs py-1.5 px-2.5"><LuTrash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-400">
                      <span>{cat.parent?.nameEn ? `\u21B3 ${cat.parent.nameEn}` : "Top-level"}</span>
                      <span>{cat._count.products} products</span>
                      {cat._count.children > 0 && <span>{cat._count.children} sub</span>}
                      <span>Sort: {cat.sortOrder}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Parent</th>
                    <th className="text-center">Products</th>
                    <th className="text-center">Sub</th>
                    <th className="text-center">Sort</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Thumb cat={cat} />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">{cat.nameEn}</div>
                            <div className="text-xs text-slate-400 truncate" dir="rtl">{cat.nameAr}</div>
                            <div className="text-xs text-slate-300 font-mono">/{cat.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-500">{cat.parent?.nameEn || <span className="text-slate-300">Top-level</span>}</td>
                      <td className="text-center font-medium">{cat._count.products}</td>
                      <td className="text-center text-slate-500">{cat._count.children}</td>
                      <td className="text-center text-slate-500">{cat.sortOrder}</td>
                      <td>
                        <button
                          onClick={() => toggleActive(cat)}
                          className={`badge cursor-pointer ${cat.isActive ? "badge-delivered" : "badge-cancelled"}`}
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openEdit(cat)} className="admin-btn admin-btn-secondary text-xs py-1"><LuPencil size={14} /> Edit</button>
                          <button onClick={() => deleteCategory(cat)} className="admin-btn admin-btn-danger text-xs py-1"><LuTrash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Total: {total}</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40"><LuChevronLeft size={14} /> Prev</button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next <LuChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <AdminModal open={showModal} onClose={() => setShowModal(false)}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-800">{editing ? "Edit Category" : "Add Category"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"><LuX size={18} /></button>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form onSubmit={save} className="space-y-4">
              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category Image</label>
                <div className="flex items-center gap-4">
                  {form.image ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.image} alt="category" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image: "" })}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <LuX size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:border-indigo-400 hover:text-indigo-500 text-xs flex-shrink-0">
                      {uploading ? <span className="spinner" /> : (<><LuImagePlus size={20} /><span className="mt-0.5">Upload</span></>)}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files)} disabled={uploading} />
                    </label>
                  )}
                  <p className="text-xs text-slate-400">JPG, PNG, WEBP, AVIF up to 5MB. Square images look best.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (English) *</label>
                  <input className="admin-input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
                  {!editing && form.nameEn && (
                    <p className="text-xs text-slate-400 mt-1 font-mono">slug: /{slugify(form.nameEn)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (Arabic) *</label>
                  <input className="admin-input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category</label>
                  <select className="admin-input admin-select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                    <option value="">None (top-level)</option>
                    {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.nameEn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                  <input type="number" className="admin-input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <span className="font-medium text-slate-700">Active (visible in the storefront)</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || uploading} className="admin-btn admin-btn-primary flex-1 justify-center disabled:opacity-60">
                  {saving ? "Saving..." : editing ? "Update Category" : "Create Category"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Cancel</button>
              </div>
            </form>
      </AdminModal>

      {/* Delete confirmation modal */}
      <AdminModal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} className="!max-w-md">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                <LuTrash2 size={26} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Delete category?</h3>
              <p className="text-sm text-slate-500 mt-1.5">
                You are about to delete <span className="font-semibold text-slate-700">{deleteTarget?.nameEn}</span>. This action cannot be undone.
              </p>
              {deleteError && (
                <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mt-4 w-full">{deleteError}</div>
              )}
              <div className="flex gap-3 w-full mt-6">
                <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="admin-btn admin-btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={confirmDelete} disabled={deleting} className="admin-btn admin-btn-danger flex-1 justify-center disabled:opacity-60">
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
      </AdminModal>
    </div>
  );
}

function Thumb({ cat }: { cat: Category }) {
  if (cat.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cat.image} alt={cat.nameEn} className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-100" />;
  }
  return (
    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
      <LuTags size={18} />
    </div>
  );
}
