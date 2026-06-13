"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  LuPlus, LuShirt, LuPencil, LuTrash2, LuChevronLeft, LuChevronRight,
  LuPackage, LuCircleCheck, LuStar, LuSparkles, LuSearch,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

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
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) {
      setDeleteError(data.error || "Could not delete product");
      return;
    }
    setDeleteTarget(null);
    load();
  };

  const totalPages = Math.ceil(total / 20);
  const activeCount = products.filter((p) => p.isActive).length;
  const featuredCount = products.filter((p) => p.isFeatured).length;
  const newCount = products.filter((p) => p.isNew).length;

  const stats = [
    { label: "Total Products", value: total, icon: LuPackage, accent: "from-indigo-500 to-violet-500", ring: "ring-indigo-100" },
    { label: "Active", value: activeCount, icon: LuCircleCheck, accent: "from-emerald-400 to-teal-500", ring: "ring-emerald-100" },
    { label: "Featured", value: featuredCount, icon: LuStar, accent: "from-amber-400 to-orange-500", ring: "ring-amber-100" },
    { label: "New Arrivals", value: newCount, icon: LuSparkles, accent: "from-sky-400 to-blue-500", ring: "ring-sky-100" },
  ];

  const price = (p: Product) => (
    p.salePrice ? (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-emerald-600 font-semibold">{Number(p.salePrice).toFixed(3)}</span>
        <span className="text-xs text-slate-400 line-through">{Number(p.basePrice).toFixed(3)}</span>
      </span>
    ) : (
      <span className="font-semibold text-slate-700">{Number(p.basePrice).toFixed(3)}</span>
    )
  );

  const flags = (p: Product) => (
    <div className="flex gap-1 flex-wrap">
      {p.isFeatured && <span className="badge badge-confirmed">Featured</span>}
      {p.isNew && <span className="badge badge-processing">New</span>}
      {p.isBestSeller && <span className="badge badge-delivered">Best</span>}
    </div>
  );

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
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="admin-input w-full sm:w-56 pl-9" placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="admin-input admin-select w-full sm:w-44" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
          </select>
        </div>
        <Link href="/admin/products/new" className="admin-btn admin-btn-primary inline-flex items-center gap-1.5">
          <LuPlus size={16} /> Add Product
        </Link>
      </div>

      {loading ? (
        <div className="admin-card flex justify-center py-16"><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-3"><LuShirt size={26} /></div>
          <p className="text-slate-500">No products found</p>
          <Link href="/admin/products/new" className="admin-btn admin-btn-primary mt-4 inline-flex items-center gap-1.5"><LuPlus size={16} /> Add your first product</Link>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200/70 p-4">
                <div className="flex gap-3">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0].url} alt={p.nameEn} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 flex-shrink-0"><LuShirt size={24} /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{p.nameEn}</div>
                    <div className="text-xs text-slate-400 truncate" dir="rtl">{p.nameAr}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.category.nameEn}</div>
                    <div className="mt-1 text-sm">{price(p)}</div>
                  </div>
                  <button
                    onClick={() => toggleField(p.id, "isActive", p.isActive)}
                    className={`badge cursor-pointer h-fit ${p.isActive ? "badge-delivered" : "badge-cancelled"}`}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {flags(p)}
                  <div className="flex gap-2">
                    <Link href={`/admin/products/${p.id}`} className="admin-btn admin-btn-secondary text-xs py-1"><LuPencil size={14} /> Edit</Link>
                    <button onClick={() => { setDeleteError(""); setDeleteTarget(p); }} className="admin-btn admin-btn-danger text-xs py-1"><LuTrash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="admin-card hidden lg:block">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th className="text-center">Variants</th>
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
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0].url} alt={p.nameEn} className="w-12 h-12 object-cover rounded-lg" />
                        ) : (
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300"><LuShirt size={22} /></div>
                        )}
                      </td>
                      <td>
                        <div className="font-medium text-slate-800">{p.nameEn}</div>
                        <div className="text-xs text-slate-400" dir="rtl">{p.nameAr}</div>
                        {p.sku && <div className="text-xs text-slate-400">SKU: {p.sku}</div>}
                      </td>
                      <td className="text-slate-600">{p.category.nameEn}</td>
                      <td>{price(p)}</td>
                      <td className="text-center">{p._count.variants}</td>
                      <td>{flags(p)}</td>
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
                          <Link href={`/admin/products/${p.id}`} className="admin-btn admin-btn-secondary text-xs py-1"><LuPencil size={14} /> Edit</Link>
                          <button onClick={() => { setDeleteError(""); setDeleteTarget(p); }} className="admin-btn admin-btn-danger text-xs py-1"><LuTrash2 size={14} /> Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between admin-card px-4 py-3">
          <span className="text-sm text-slate-500">Total: {total}</span>
          <div className="flex gap-2 items-center">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40"><LuChevronLeft size={14} /> Prev</button>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next <LuChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <AdminModal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        className="!max-w-md"
        title="Delete product?"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="admin-btn admin-btn-secondary">Cancel</button>
            <button onClick={confirmDelete} disabled={deleting} className="admin-btn admin-btn-danger justify-center disabled:opacity-60">
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
            <LuTrash2 size={26} />
          </div>
          <p className="text-sm text-slate-500">
            You are about to delete <span className="font-semibold text-slate-700">{deleteTarget?.nameEn}</span>. This action cannot be undone.
          </p>
          {deleteError && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mt-4 w-full">{deleteError}</div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}
