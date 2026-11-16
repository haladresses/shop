"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { rateLabel, type TaxKind } from "@/lib/taxCalc";
import { useRouter } from "next/navigation";
import {
  LuX, LuPlus, LuPencil, LuTrash2, LuImagePlus, LuLayers, LuTags, LuFolderTree,
  LuCircleCheck, LuSearch, LuChevronRight, LuSlidersHorizontal, LuFolderPlus,
  LuPackage, LuArrowRight, LuSparkles, LuChevronsDownUp, LuChevronsUpDown,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { buildCategoryTree, type CategoryNode } from "@/lib/categoryTree";

type Category = {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
  image?: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  /** Own VAT rate (null = inherits) — managed under Tax & VAT. */
  taxRateId?: string | null;
  _count: { products: number; children: number; attributes: number };
};

type FormState = { nameEn: string; nameAr: string; parentId: string; image: string; isActive: boolean; sortOrder: number };

const emptyForm: FormState = { nameEn: "", nameAr: "", parentId: "", image: "", isActive: true, sortOrder: 0 };

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [created, setCreated] = useState<{ id: string; nameEn: string } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/categories?tree=true", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // VAT rates, to label categories that set their own (best-effort; the
  // endpoint needs a catalog/tax permission).
  const [taxRates, setTaxRates] = useState<Map<string, { code: string; nameEn: string; rate: number; type: TaxKind }>>(new Map());
  useEffect(() => {
    fetch("/api/tax/rates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setTaxRates(new Map((d.data as { id: string; code: string; nameEn: string; rate: number; type: TaxKind }[]).map((r) => [r.id, r])));
      })
      .catch(() => {});
  }, []);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const query = search.trim().toLowerCase();
  const matches = useMemo(
    () =>
      query
        ? categories.filter(
            (c) => c.nameEn.toLowerCase().includes(query) || c.nameAr.includes(search.trim()) || c.slug.includes(query),
          )
        : [],
    [categories, query, search],
  );

  const stats = [
    { label: "Categories", value: categories.length, icon: LuLayers, accent: "from-indigo-500 to-violet-500", ring: "ring-indigo-100" },
    { label: "Active", value: categories.filter((c) => c.isActive).length, icon: LuCircleCheck, accent: "from-emerald-400 to-teal-500", ring: "ring-emerald-100" },
    { label: "Top-level", value: categories.filter((c) => !c.parentId).length, icon: LuFolderTree, accent: "from-sky-400 to-blue-500", ring: "ring-sky-100" },
    { label: "With fields", value: categories.filter((c) => c._count.attributes > 0).length, icon: LuSlidersHorizontal, accent: "from-amber-400 to-orange-500", ring: "ring-amber-100" },
  ];

  const openCreate = (parentId = "") => {
    setEditing(null);
    setCreated(null);
    setForm({ ...emptyForm, parentId });
    setError("");
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setCreated(null);
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
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, parentId: form.parentId || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) {
      setError(data.error);
      return;
    }
    load();
    if (editing) setShowModal(false);
    else setCreated({ id: data.data.id, nameEn: data.data.nameEn });
  };

  const toggleActive = async (cat: Category) => {
    setCategories((cs) => cs.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c)));
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    load();
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
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const parentIds = tree.filter((n) => n.children.length > 0).map((n) => n.id);
  const allCollapsed = parentIds.length > 0 && parentIds.every((id) => collapsed.has(id));

  // A category with sub-categories stays top-level so the shop menu keeps two levels.
  const parentOptions = categories.filter((c) => !c.parentId && c.id !== editing?.id);
  const editingHasChildren = !!editing && editing._count.children > 0;

  const renderRow = (cat: Category, depth: number, hasChildren: boolean, isCollapsed: boolean, showPath = false) => {
    const parent = cat.parentId ? byId.get(cat.parentId) : undefined;
    return (
      <div className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-3 hover:bg-slate-50/80">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 basis-[260px]" style={{ paddingLeft: depth * 28 }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapsed(cat.id)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? `Show sub-categories of ${cat.nameEn}` : `Hide sub-categories of ${cat.nameEn}`}
              className="w-6 h-6 flex-shrink-0 rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 flex items-center justify-center"
            >
              <LuChevronRight size={16} className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
            </button>
          ) : (
            <span className="w-6 flex-shrink-0" />
          )}
          <Thumb cat={cat} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className={`font-medium truncate ${cat.isActive ? "text-slate-800" : "text-slate-400"}`}>{cat.nameEn}</span>
              <span className="text-sm text-slate-400 truncate" dir="rtl">{cat.nameAr}</span>
            </div>
            <div className="text-xs text-slate-400 truncate">
              {showPath && parent ? <>{parent.nameEn} › </> : null}
              <span className="font-mono">/{cat.slug}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-8 sm:pl-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600" title="Products in this category">
            <LuPackage size={12} /> {cat._count.products}
          </span>
          {cat.taxRateId && taxRates.get(cat.taxRateId) && (
            <Link
              href="/admin/tax?tab=assign"
              className="inline-flex items-center rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
              title={`VAT: ${taxRates.get(cat.taxRateId)!.nameEn} (applies to products in this category unless they set their own)`}
            >
              VAT {rateLabel(taxRates.get(cat.taxRateId)!)}
            </Link>
          )}
          <Link
            href={`/admin/categories/${cat.id}/attributes`}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              cat._count.attributes > 0
                ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                : "border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50"
            }`}
            title="Specification fields for products in this category"
          >
            <LuSlidersHorizontal size={12} />
            {cat._count.attributes > 0 ? plural(cat._count.attributes, "field") : "Add fields"}
          </Link>
          <button
            type="button"
            onClick={() => toggleActive(cat)}
            className={`badge cursor-pointer ${cat.isActive ? "badge-delivered" : "badge-cancelled"}`}
            title={cat.isActive ? "Visible in the shop. Click to hide" : "Hidden: click to show in the shop"}
          >
            {cat.isActive ? "Active" : "Hidden"}
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Link href={`/admin/categories/${cat.id}/attributes`} className="admin-btn admin-btn-secondary text-xs !py-1.5" title="Edit fields">
            <LuSlidersHorizontal size={14} /> <span className="hidden md:inline">Fields</span>
          </Link>
          {!cat.parentId && (
            <button type="button" onClick={() => openCreate(cat.id)} className="admin-btn admin-btn-secondary text-xs !py-1.5" title="Add a sub-category">
              <LuFolderPlus size={14} /> <span className="hidden md:inline">Sub</span>
            </button>
          )}
          <button type="button" onClick={() => openEdit(cat)} className="admin-btn admin-btn-secondary text-xs !py-1.5" title="Edit details">
            <LuPencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => { setDeleteError(""); setDeleteTarget(cat); }}
            className="admin-btn admin-btn-danger text-xs !py-1.5"
            title="Delete"
          >
            <LuTrash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderNode = (node: CategoryNode<Category>): React.ReactNode => {
    const isCollapsed = collapsed.has(node.id);
    return (
      <li key={node.id}>
        {renderRow(node, node.depth, node.children.length > 0, isCollapsed)}
        {node.children.length > 0 && !isCollapsed && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-5">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <input
            className="admin-input !pl-10"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {!query && parentIds.length > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(parentIds))}
              className="admin-btn admin-btn-secondary"
            >
              {allCollapsed ? <><LuChevronsUpDown size={15} /> Expand all</> : <><LuChevronsDownUp size={15} /> Collapse all</>}
            </button>
          )}
          <button className="admin-btn admin-btn-primary" onClick={() => openCreate()}>
            <LuPlus size={16} /> Add Category
          </button>
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <LuTags size={40} className="mb-3 text-slate-300" />
            <p className="text-sm">No categories yet</p>
            <button onClick={() => openCreate()} className="admin-btn admin-btn-primary mt-4 text-sm">
              <LuPlus size={15} /> Create your first category
            </button>
          </div>
        ) : query ? (
          matches.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No categories match “{search.trim()}”.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {matches.map((c) => (
                <li key={c.id}>{renderRow(c, 0, false, false, true)}</li>
              ))}
            </ul>
          )
        ) : (
          <ul className="divide-y divide-slate-100">{tree.map(renderNode)}</ul>
        )}
      </div>

      <AdminModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={created ? "Category created" : editing ? "Edit Category" : form.parentId ? "Add Sub-category" : "Add Category"}
        footer={
          created ? (
            <>
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Later</button>
              <button type="button" onClick={() => router.push(`/admin/categories/${created.id}/attributes`)} className="admin-btn admin-btn-primary">
                Set up fields <LuArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Cancel</button>
              <button type="submit" form="category-form" disabled={saving || uploading} className="admin-btn admin-btn-primary justify-center disabled:opacity-60">
                {saving ? "Saving..." : editing ? "Update Category" : "Create Category"}
              </button>
            </>
          )
        }
      >
        {created ? (
          <div className="text-center py-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <LuCircleCheck size={28} />
            </div>
            <p className="font-semibold text-slate-800">“{created.nameEn}” is ready</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Next, choose the details every product in it should have. Fabric, length, sleeves… It takes a minute with the
              ready-made sets.
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-indigo-600 mt-3">
              <LuSparkles size={13} /> Sub-categories automatically get their parent&apos;s fields.
            </p>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form id="category-form" onSubmit={save} className="space-y-4">
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
                        aria-label="Remove image"
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
                  <input className="admin-input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required autoFocus />
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
                  <select
                    className="admin-input admin-select disabled:bg-slate-50 disabled:text-slate-400"
                    value={form.parentId}
                    disabled={editingHasChildren}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  >
                    <option value="">None (top-level)</option>
                    {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.nameEn}{p.isActive ? "" : " (hidden)"}</option>)}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    {editingHasChildren
                      ? "This category has sub-categories, so it stays top-level."
                      : form.parentId
                        ? "It will also get all of the parent's fields."
                        : "Leave empty for a main category."}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                  <input type="number" className="admin-input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-slate-400 mt-1">Lower numbers come first.</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <span className="font-medium text-slate-700">Active (visible in the storefront)</span>
              </label>
            </form>
          </>
        )}
      </AdminModal>

      <AdminModal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        className="!max-w-md"
        title="Delete category?"
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
            You are about to delete <span className="font-semibold text-slate-700">{deleteTarget?.nameEn}</span>
            {deleteTarget && deleteTarget._count.attributes > 0 && <> and its {plural(deleteTarget._count.attributes, "field")}</>}.
            This action cannot be undone.
          </p>
          {deleteTarget && (deleteTarget._count.products > 0 || deleteTarget._count.children > 0) && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">
              It still has {[
                deleteTarget._count.products > 0 ? plural(deleteTarget._count.products, "product") : "",
                deleteTarget._count.children > 0 ? plural(deleteTarget._count.children, "sub-category") : "",
              ].filter(Boolean).join(" and ")}. Move them to another category first.
            </p>
          )}
          {deleteError && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mt-4 w-full">{deleteError}</div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}

function Thumb({ cat }: { cat: Category }) {
  if (cat.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cat.image} alt={cat.nameEn} className={`w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-100 ${cat.isActive ? "" : "opacity-50"}`} />;
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
      <LuTags size={17} />
    </div>
  );
}
