"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LuPlus, LuShirt, LuPencil, LuTrash2, LuChevronLeft, LuChevronRight,
  LuPackage, LuCircleCheck, LuStar, LuSparkles, LuSearch, LuCopy,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { buildProductPayload, productToFormValue } from "@/components/admin/ProductForm";
import { categorySelectOptions, type FlatCategory } from "@/lib/categoryTree";
import { productImageUrl } from "@/lib/productImage";

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

type Category = FlatCategory & { isActive: boolean };

type StatusFilter = "" | "true" | "false";

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: string; nameEn: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [copyTarget, setCopyTarget] = useState<Product | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState("");
  // Catalogue-wide counts for the stat cards. They ignore the search, the
  // filters and the current page, so the cards always describe the whole shop.
  const [counts, setCounts] = useState({ all: 0, active: 0, featured: 0, fresh: 0 });

  const loadCounts = useCallback(async () => {
    const count = (query: string) =>
      fetch(`/api/products?pageSize=1${query}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => (d.success ? (d.meta.total as number) : 0))
        .catch(() => 0);
    const [all, active, featured, fresh] = await Promise.all([
      count(""),
      count("&isActive=true"),
      count("&isFeatured=true"),
      count("&isNew=true"),
    ]);
    setCounts({ all, active, featured, fresh });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      search,
      ...(categoryFilter && { categoryId: categoryFilter }),
      ...(supplierFilter && { supplierId: supplierFilter }),
      ...(statusFilter && { isActive: statusFilter }),
    });
    const res = await fetch(`/api/products?${params}`, { cache: "no-store" });
    const data = await res.json();
    if (data.success) { setProducts(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, search, categoryFilter, supplierFilter, statusFilter]);

  useEffect(() => {
    fetch("/api/categories?tree=true").then(r => r.json()).then(d => { if (d.success) setCategories(d.data); });
    // Supplier filter: only shown to staff who can see suppliers.
    fetch("/api/suppliers?status=all&pageSize=500&sort=name").then(r => r.json()).then(d => { if (d.success) setSuppliers(d.data.items); }).catch(() => {});
  }, []);

  const categoryOptions = useMemo(() => categorySelectOptions(categories), [categories]);

  // Copy a product as a hidden draft — same images, specs and variants, but
  // stock 0 and no SKU/barcode (those must be unique) — then open it to edit.
  const confirmDuplicate = async () => {
    if (!copyTarget) return;
    setCopying(true);
    setCopyError("");
    try {
      const src = await fetch(`/api/products/${copyTarget.id}`, { cache: "no-store" }).then((r) => r.json());
      if (!src.success) throw new Error(src.error || "Could not load the product");
      const form = productToFormValue(src.data);
      const payload = buildProductPayload({
        ...form,
        nameEn: `${form.nameEn} (Copy)`,
        nameAr: `${form.nameAr} (نسخة)`,
        sku: "",
        barcode: "",
        isActive: false,
        variants: form.variants.map((v) => ({ ...v, sku: "", barcode: "", stock: "0" })),
      });
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.error || "Could not create the copy");
      setCopyTarget(null);
      router.push(`/admin/products/${res.data.id}`);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : "Could not duplicate the product");
    } finally {
      setCopying(false);
    }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const toggleField = async (id: string, field: string, value: boolean) => {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !value }),
    });
    load();
    loadCounts();
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
    loadCounts();
  };

  const totalPages = Math.ceil(total / 20);

  const stats = [
    { label: "Total Products", value: counts.all, icon: LuPackage },
    { label: "Active", value: counts.active, icon: LuCircleCheck },
    { label: "Featured", value: counts.featured, icon: LuStar },
    { label: "New Arrivals", value: counts.fresh, icon: LuSparkles },
  ];

  // The shop charges the sale price when one is set. The regular price is
  // only shown (crossed out) when it is really higher.
  const price = (p: Product) => {
    const current = Number(p.salePrice ?? p.basePrice);
    const regular = Number(p.basePrice);
    return (
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-semibold text-slate-800">{current.toFixed(3)}</span>
        {regular > current && <span className="text-xs text-slate-400 line-through">{regular.toFixed(3)}</span>}
      </span>
    );
  };

  // Edit is the everyday action; Duplicate and Delete are quieter icon buttons.
  const rowActions = (p: Product) => (
    <div className="inline-flex items-center gap-1">
      <Link href={`/admin/products/${p.id}`} className="admin-btn admin-btn-secondary !py-1.5 !px-2.5 !text-xs"><LuPencil size={14} /> Edit</Link>
      <button type="button" onClick={() => { setCopyError(""); setCopyTarget(p); }} className="admin-icon-btn" title="Duplicate" aria-label="Duplicate"><LuCopy size={15} /></button>
      <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(p); }} className="admin-icon-btn admin-icon-btn-danger" title="Delete" aria-label="Delete"><LuTrash2 size={15} /></button>
    </div>
  );

  const flags = (p: Product) => (
    <div className="flex gap-1 flex-wrap">
      {p.isFeatured && <span className="badge badge-confirmed">Featured</span>}
      {p.isNew && <span className="badge badge-processing">New</span>}
      {p.isBestSeller && <span className="badge badge-delivered">Best seller</span>}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
              <s.icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">{s.value}</p>
              <p className="text-xs sm:text-sm text-slate-500 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: search, category, status, then the main action */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <LuSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="admin-input !pl-9" placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="admin-input admin-select !w-full sm:!w-52" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {suppliers.length > 0 && (
          <select className="admin-input admin-select !w-full sm:!w-48" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }} aria-label="Filter by supplier">
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nameEn}</option>)}
          </select>
        )}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Filter by status">
          {([["", "All"], ["true", "Active"], ["false", "Hidden"]] as [StatusFilter, string][]).map(([v, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={statusFilter === v}
              onClick={() => { setStatusFilter(v); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${statusFilter === v ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link href="/admin/products/new" className="admin-btn admin-btn-primary sm:ml-auto">
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={productImageUrl(p.images)} alt={p.nameEn} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{p.nameEn}</div>
                    <div className="text-xs text-slate-400 truncate" dir="rtl">{p.nameAr}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.category.nameEn}</div>
                    <div className="mt-1 text-sm">{price(p)}</div>
                  </div>
                  <button
                    onClick={() => toggleField(p.id, "isActive", p.isActive)}
                    className={`badge cursor-pointer h-fit ${p.isActive ? "badge-delivered" : "badge-refunded"}`}
                    title={p.isActive ? "Click to hide from the shop" : "Click to show in the shop"}
                  >
                    {p.isActive ? "Active" : "Hidden"}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {flags(p)}
                  {rowActions(p)}
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
                    <th>Tags</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={productImageUrl(p.images)} alt={p.nameEn} className="w-12 h-12 object-cover rounded-lg" />
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
                          className={`badge cursor-pointer ${p.isActive ? "badge-delivered" : "badge-refunded"}`}
                          title={p.isActive ? "Click to hide from the shop" : "Click to show in the shop"}
                        >
                          {p.isActive ? "Active" : "Hidden"}
                        </button>
                      </td>
                      <td className="text-right">
                        {rowActions(p)}
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
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40"><LuChevronLeft size={14} /> Previous</button>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next <LuChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Duplicate confirmation modal */}
      <AdminModal
        open={!!copyTarget}
        onClose={() => !copying && setCopyTarget(null)}
        className="!max-w-md"
        title="Duplicate product?"
        footer={
          <>
            <button onClick={() => setCopyTarget(null)} disabled={copying} className="admin-btn admin-btn-secondary">Cancel</button>
            <button onClick={confirmDuplicate} disabled={copying} className="admin-btn admin-btn-primary justify-center disabled:opacity-60">
              {copying ? "Copying..." : "Duplicate"}
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
            <LuCopy size={24} />
          </div>
          <p className="text-sm text-slate-600">
            Creates a copy of <span className="font-semibold text-slate-800">{copyTarget?.nameEn}</span> with the same images,
            prices, specifications and variants, then opens it so you can adjust it.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            The copy starts hidden from the shop, with stock 0 and empty SKUs and barcodes.
          </p>
          {copyError && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mt-4 w-full">{copyError}</div>}
        </div>
      </AdminModal>

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
