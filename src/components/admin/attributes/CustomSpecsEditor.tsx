"use client";
import { useRef } from "react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import type { CustomSpec } from "@/lib/attributes";
import { ATTRIBUTE_PRESETS } from "@/lib/attributePresets";

const blank = (): CustomSpec => ({ labelEn: "", labelAr: "", valueEn: "", valueAr: "" });

/**
 * Specifications that only this product has — e.g. "Fabric weight: Light" on
 * a single dress — without adding a field to the whole category.
 */
export default function CustomSpecsEditor({
  specs,
  onChange,
  takenKeys,
}: {
  specs: CustomSpec[];
  onChange: (next: CustomSpec[]) => void;
  /** Keys and lowercase English labels the category already asks for, so they aren't suggested again. */
  takenKeys: Set<string>;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const used = new Set(specs.map((s) => s.labelEn.trim().toLowerCase()).filter(Boolean));
  const suggestions = ATTRIBUTE_PRESETS.filter((p) => {
    const label = p.labelEn.toLowerCase();
    return !takenKeys.has(p.key) && !takenKeys.has(label) && !used.has(label);
  }).slice(0, 8);

  const patch = (i: number, p: Partial<CustomSpec>) =>
    onChange(specs.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const add = (spec: CustomSpec = blank()) => {
    onChange([...specs, spec]);
    // Focus the new row's first empty box once it renders.
    requestAnimationFrame(() => {
      const rows = listRef.current?.querySelectorAll<HTMLDivElement>("[data-spec-row]");
      const last = rows?.[rows.length - 1];
      const target = last?.querySelector<HTMLInputElement>(spec.labelEn ? "[data-value-en]" : "input");
      target?.focus();
    });
  };

  return (
    <div>
      {specs.length > 0 && (
        <div ref={listRef} className="space-y-2 mb-3">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Name</span>
            <span>Value</span>
            <span />
          </div>
          {specs.map((s, i) => (
            <div
              key={i}
              data-spec-row
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_36px] gap-2 rounded-xl border border-slate-200 bg-slate-50/40 p-2"
            >
              <div className="space-y-1.5">
                <input className="admin-input !py-1.5 text-sm" placeholder="Name, e.g. Fabric weight" value={s.labelEn} onChange={(e) => patch(i, { labelEn: e.target.value })} />
                <input className="admin-input !py-1.5 text-sm" dir="rtl" placeholder="الاسم بالعربية" value={s.labelAr} onChange={(e) => patch(i, { labelAr: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <input data-value-en className="admin-input !py-1.5 text-sm" placeholder="Value, e.g. Light" value={s.valueEn} onChange={(e) => patch(i, { valueEn: e.target.value })} />
                <input className="admin-input !py-1.5 text-sm" dir="rtl" placeholder="القيمة بالعربية" value={s.valueAr} onChange={(e) => patch(i, { valueAr: e.target.value })} />
              </div>
              <button
                type="button"
                onClick={() => onChange(specs.filter((_, idx) => idx !== i))}
                className="h-9 w-9 justify-self-end rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center"
                aria-label="Remove this specification"
              >
                <LuTrash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => add()} className="admin-btn admin-btn-secondary text-sm">
          <LuPlus size={15} /> Add a specification
        </button>
        {suggestions.length > 0 && <span className="text-xs text-slate-400 ml-1">or quickly add:</span>}
        {suggestions.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => add({ labelEn: p.labelEn, labelAr: p.labelAr, valueEn: "", valueAr: "" })}
            className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
          >
            + {p.labelEn}
          </button>
        ))}
      </div>
      {specs.some((s) => (s.labelEn || s.labelAr) && !(s.valueEn || s.valueAr)) && (
        <p className="text-xs text-amber-600 mt-2">Rows without a value are skipped when you save.</p>
      )}
    </div>
  );
}
