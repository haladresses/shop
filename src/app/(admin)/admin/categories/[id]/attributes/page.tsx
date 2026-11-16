"use client";
import { use, useState } from "react";
import Link from "next/link";
import { LuChevronLeft, LuChevronRight, LuEyeOff, LuTags } from "react-icons/lu";
import CategoryAttributesEditor, {
  type EditorCategory,
} from "@/components/admin/attributes/CategoryAttributesEditor";

export default function CategoryFieldsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cat, setCat] = useState<EditorCategory | null>(null);
  const parents = cat?.path.slice(0, -1) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/categories" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <LuChevronLeft size={16} /> All categories
        </Link>
        <div className="flex items-center gap-4">
          {cat?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cat.image} alt={cat.nameEn} className="w-14 h-14 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
              <LuTags size={22} />
            </div>
          )}
          <div className="min-w-0">
            {parents.length > 0 && (
              <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400 mb-0.5" aria-label="Parent categories">
                {parents.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1">
                    <Link href={`/admin/categories/${p.id}/attributes`} className="hover:text-indigo-600 hover:underline">{p.nameEn}</Link>
                    <LuChevronRight size={12} />
                  </span>
                ))}
              </nav>
            )}
            <h1 className="text-xl font-semibold text-slate-800 flex flex-wrap items-baseline gap-x-3">
              {cat?.nameEn ?? "Category fields"}
              {cat?.nameAr && <span className="text-base font-normal text-slate-400" dir="rtl">{cat.nameAr}</span>}
            </h1>
            <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
              The specification fields every product in this category fills in.
              {cat && !cat.isActive && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  <LuEyeOff size={12} /> Hidden in shop
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <CategoryAttributesEditor key={id} categoryId={id} onLoaded={setCat} />
    </div>
  );
}
