"use client";
import { useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { flattenTree, type CategoryNode } from "./shared";

/** Indented category tree with checkboxes. A ticked category also covers its sub-categories. */
export default function CategoryPicker({
  categories,
  selected,
  onChange,
  disabled,
}: {
  categories: CategoryNode[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const tree = useMemo(() => flattenTree(categories), [categories]);
  const set = new Set(selected);
  const parentOf = useMemo(() => new Map(categories.map((c) => [c.id, c.parentId])), [categories]);

  // A category whose ancestor is ticked is already covered.
  const coveredByParent = (id: string) => {
    let cur = parentOf.get(id);
    let guard = 0;
    while (cur && guard++ < 50) {
      if (set.has(cur)) return true;
      cur = parentOf.get(cur);
    }
    return false;
  };

  const shown = q.trim()
    ? tree.filter((c) => `${c.nameEn} ${c.nameAr}`.toLowerCase().includes(q.trim().toLowerCase()))
    : tree;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="relative border-b border-slate-100">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          className="w-full pl-9 pr-3 py-2 text-sm outline-none"
          placeholder="Filter categories…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
        {shown.map((c) => {
          const covered = coveredByParent(c.id);
          return (
            <label
              key={c.id}
              className={`flex items-center gap-2.5 py-2 pr-3 text-sm cursor-pointer hover:bg-slate-50 ${covered ? "text-slate-400" : "text-slate-700"}`}
              style={{ paddingLeft: 12 + (q.trim() ? 0 : c.depth * 18) }}
            >
              <input
                type="checkbox"
                className="rounded"
                disabled={disabled}
                checked={set.has(c.id) || covered}
                onChange={() => onChange(set.has(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
              />
              <span className="flex-1 min-w-0 truncate">
                {c.nameEn}
                {!c.isActive && <span className="ml-1.5 text-[11px] text-amber-600">(hidden)</span>}
                {covered && <span className="ml-1.5 text-[11px]">· included via parent</span>}
              </span>
              <span className="text-xs text-slate-400 shrink-0" dir="rtl">
                {c.nameAr}
              </span>
              {c._count?.products != null && <span className="text-[11px] text-slate-400 w-10 text-right shrink-0">{c._count.products}</span>}
            </label>
          );
        })}
        {shown.length === 0 && <p className="text-center text-sm text-slate-400 py-6">No categories</p>}
      </div>
    </div>
  );
}
