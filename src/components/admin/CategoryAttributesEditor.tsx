"use client";
import { useEffect, useState } from "react";
import {
  LuPlus, LuTrash2, LuChevronUp, LuChevronDown, LuGripVertical,
} from "react-icons/lu";
import {
  ATTRIBUTE_TYPE_OPTIONS,
  needsOptions,
  type AttributeType,
  type AttributeOption,
  type CategoryAttribute,
} from "@/lib/attributes";

type DraftAttribute = {
  key: string;
  labelEn: string;
  labelAr: string;
  type: AttributeType;
  options: AttributeOption[];
  unit: string;
  placeholder: string;
  isRequired: boolean;
  isFilterable: boolean;
};

const slugifyKey = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

function toDraft(a: CategoryAttribute): DraftAttribute {
  return {
    key: a.key,
    labelEn: a.labelEn,
    labelAr: a.labelAr,
    type: a.type,
    options: a.options,
    unit: a.unit ?? "",
    placeholder: a.placeholder ?? "",
    isRequired: a.isRequired,
    isFilterable: a.isFilterable,
  };
}

const blankAttr = (): DraftAttribute => ({
  key: "", labelEn: "", labelAr: "", type: "TEXT", options: [],
  unit: "", placeholder: "", isRequired: false, isFilterable: false,
});

export default function CategoryAttributesEditor({
  categoryId,
  categoryName,
  onSaved,
}: {
  categoryId: string;
  categoryName: string;
  onSaved?: () => void;
}) {
  const [attrs, setAttrs] = useState<DraftAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/categories/${categoryId}/attributes`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.success) setAttrs((d.data as CategoryAttribute[]).map(toDraft));
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => { active = false; };
  }, [categoryId]);

  const update = (idx: number, patch: Partial<DraftAttribute>) =>
    setAttrs((a) => a.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const move = (from: number, to: number) =>
    setAttrs((a) => {
      if (to < 0 || to >= a.length) return a;
      const next = [...a];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });

  const remove = (idx: number) => setAttrs((a) => a.filter((_, i) => i !== idx));
  const add = () => setAttrs((a) => [...a, blankAttr()]);

  // ---- Option editing (SELECT / MULTISELECT / COLOR) ----
  const addOption = (idx: number) =>
    update(idx, { options: [...attrs[idx].options, { value: "", labelEn: "", labelAr: "", hex: "" }] });

  const updateOption = (idx: number, oi: number, patch: Partial<AttributeOption>) =>
    update(idx, { options: attrs[idx].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });

  const removeOption = (idx: number, oi: number) =>
    update(idx, { options: attrs[idx].options.filter((_, i) => i !== oi) });

  const save = async () => {
    setError("");
    setSaved(false);

    // Client-side validation
    const seen = new Set<string>();
    const payload = attrs.map((a, i) => {
      const key = a.key || slugifyKey(a.labelEn);
      if (!key) throw new Error(`Row ${i + 1}: a key or English label is required`);
      if (seen.has(key)) throw new Error(`Duplicate key "${key}"`);
      seen.add(key);
      return {
        key,
        labelEn: a.labelEn || a.key,
        labelAr: a.labelAr || a.labelEn || a.key,
        type: a.type,
        options: needsOptions(a.type)
          ? a.options
              .filter((o) => o.value || o.labelEn)
              .map((o) => ({
                value: o.value || slugifyKey(o.labelEn),
                labelEn: o.labelEn || o.value,
                labelAr: o.labelAr || o.labelEn || o.value,
                ...(a.type === "COLOR" && o.hex ? { hex: o.hex } : {}),
              }))
          : [],
        unit: a.unit || undefined,
        placeholder: a.placeholder || undefined,
        isRequired: a.isRequired,
        isFilterable: a.isFilterable,
        sortOrder: i,
      };
    });

    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${categoryId}/attributes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: payload }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not save attributes");
      } else {
        setAttrs((data.data as CategoryAttribute[]).map(toDraft));
        setSaved(true);
        onSaved?.();
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError("Could not save attributes");
    }
    setSaving(false);
  };

  const handleSave = () => {
    try {
      save();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><span className="spinner" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Define the specification fields for <span className="font-medium text-slate-700">{categoryName}</span>.
        Products in this category will show these fields when being edited and on the storefront.
      </p>

      {error && <div className="bg-rose-50 text-rose-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
      {saved && <div className="bg-emerald-50 text-emerald-700 text-sm px-3 py-2 rounded-lg">Attributes saved.</div>}

      <div className="space-y-3">
        {attrs.map((a, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-400">
                <LuGripVertical size={15} />
                <span className="text-xs font-medium text-slate-500">Field {idx + 1}</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(idx, idx - 1)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100" aria-label="Move up"><LuChevronUp size={15} /></button>
                <button type="button" onClick={() => move(idx, idx + 1)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100" aria-label="Move down"><LuChevronDown size={15} /></button>
                <button type="button" onClick={() => remove(idx)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50" aria-label="Remove field"><LuTrash2 size={15} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Label (English)</label>
                <input className="admin-input !py-2 text-sm" value={a.labelEn} onChange={(e) => update(idx, { labelEn: e.target.value, key: a.key || slugifyKey(e.target.value) })} placeholder="e.g. Material" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Label (Arabic)</label>
                <input className="admin-input !py-2 text-sm" dir="rtl" value={a.labelAr} onChange={(e) => update(idx, { labelAr: e.target.value })} placeholder="الخامة" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Key</label>
                <input className="admin-input !py-2 text-sm font-mono" value={a.key} onChange={(e) => update(idx, { key: slugifyKey(e.target.value) })} placeholder="material" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select className="admin-input admin-select !py-2 text-sm" value={a.type} onChange={(e) => update(idx, { type: e.target.value as AttributeType })}>
                  {ATTRIBUTE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {a.type === "NUMBER" && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Unit (optional)</label>
                  <input className="admin-input !py-2 text-sm" value={a.unit} onChange={(e) => update(idx, { unit: e.target.value })} placeholder="cm, kg, GB..." />
                </div>
              )}
              {(a.type === "TEXT" || a.type === "NUMBER") && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Placeholder (optional)</label>
                  <input className="admin-input !py-2 text-sm" value={a.placeholder} onChange={(e) => update(idx, { placeholder: e.target.value })} />
                </div>
              )}
            </div>

            {needsOptions(a.type) && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Options</span>
                  <button type="button" onClick={() => addOption(idx)} className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"><LuPlus size={13} /> Add option</button>
                </div>
                {a.options.length === 0 ? (
                  <p className="text-xs text-slate-400">No options yet.</p>
                ) : (
                  <div className="space-y-2">
                    {a.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        {a.type === "COLOR" && (
                          <input type="color" value={o.hex || "#000000"} onChange={(e) => updateOption(idx, oi, { hex: e.target.value })} className="w-8 h-8 rounded border border-slate-200 p-0.5 cursor-pointer flex-shrink-0" />
                        )}
                        <input className="admin-input !py-1.5 text-sm flex-1" value={o.labelEn} onChange={(e) => updateOption(idx, oi, { labelEn: e.target.value, value: o.value || slugifyKey(e.target.value) })} placeholder="Label EN" />
                        <input className="admin-input !py-1.5 text-sm flex-1" dir="rtl" value={o.labelAr} onChange={(e) => updateOption(idx, oi, { labelAr: e.target.value })} placeholder="Label AR" />
                        <button type="button" onClick={() => removeOption(idx, oi)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50 flex-shrink-0" aria-label="Remove option"><LuTrash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={a.isRequired} onChange={(e) => update(idx, { isRequired: e.target.checked })} className="rounded" />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={a.isFilterable} onChange={(e) => update(idx, { isFilterable: e.target.checked })} className="rounded" />
                Filterable
              </label>
            </div>
          </div>
        ))}

        {attrs.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No specification fields yet. Add the first one below.</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={add} className="admin-btn admin-btn-secondary inline-flex items-center gap-1.5 text-sm">
          <LuPlus size={15} /> Add Field
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="admin-btn admin-btn-primary ml-auto disabled:opacity-60">
          {saving ? "Saving..." : "Save Attributes"}
        </button>
      </div>
    </div>
  );
}
