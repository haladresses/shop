"use client";
import { useEffect, useState } from "react";
import { LuCheck, LuPlus, LuTrash2, LuChevronUp, LuChevronDown, LuChevronRight } from "react-icons/lu";
import { NavItem, NavSubItem, DEFAULT_NAV_ITEMS, NAV_MENU_KEY } from "@/lib/navigation";

const emptyItem: NavItem = { labelEn: "", labelAr: "", path: "/", newTab: false, submenu: [] };
const emptySubItem: NavSubItem = { labelEn: "", labelAr: "", path: "/", newTab: false };

export default function NavigationAdminPage() {
  const [items, setItems] = useState<NavItem[]>(DEFAULT_NAV_ITEMS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch("/api/navigation")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data.items) && d.data.items.length) setItems(d.data.items);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateItem = (i: number, patch: Partial<NavItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const moveItem = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const updateSub = (i: number, j: number, patch: Partial<NavSubItem>) =>
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === i ? { ...it, submenu: it.submenu.map((s, sj) => (sj === j ? { ...s, ...patch } : s)) } : it
      )
    );
  const addSub = (i: number) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, submenu: [...it.submenu, { ...emptySubItem }] } : it)));
  const removeSub = (i: number, j: number) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, submenu: it.submenu.filter((_, sj) => sj !== j) } : it)));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [NAV_MENU_KEY]: items }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="spinner" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm text-slate-500">
        The main header navigation. Top-level items without a submenu link directly to their path; items with a submenu open a dropdown on desktop and expand in the mobile menu.
      </p>

      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="admin-card p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                className="flex items-center gap-2 font-semibold text-slate-700"
              >
                <LuChevronRight size={16} className={`transition-transform ${expanded[i] ? "rotate-90" : ""}`} />
                {item.labelEn || item.labelAr || `Item ${i + 1}`}
                {item.submenu.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs bg-indigo-100 text-indigo-600">{item.submenu.length}</span>
                )}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
                <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove"><LuTrash2 size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Label (English)" value={item.labelEn} onChange={(v) => updateItem(i, { labelEn: v })} />
              <Field label="Label (Arabic)" rtl value={item.labelAr} onChange={(v) => updateItem(i, { labelAr: v })} />
              <Field label="Link" value={item.path} onChange={(v) => updateItem(i, { path: v })} placeholder="/shop" />
              <label className="flex items-center gap-2.5 cursor-pointer self-end pb-2.5">
                <input
                  type="checkbox"
                  checked={item.newTab}
                  onChange={(e) => updateItem(i, { newTab: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-600">Open in new tab</span>
              </label>
            </div>

            {expanded[i] && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Submenu items</h4>
                {item.submenu.map((sub, j) => (
                  <div key={j} className="flex flex-col sm:flex-row gap-3 sm:items-end bg-slate-50 rounded-lg p-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="Label (English)" value={sub.labelEn} onChange={(v) => updateSub(i, j, { labelEn: v })} />
                      <Field label="Label (Arabic)" rtl value={sub.labelAr} onChange={(v) => updateSub(i, j, { labelAr: v })} />
                      <Field label="Link" value={sub.path} onChange={(v) => updateSub(i, j, { path: v })} />
                    </div>
                    <button onClick={() => removeSub(i, j)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-100 self-start sm:self-end" title="Remove"><LuTrash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={() => addSub(i)} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  <LuPlus size={14} /> Add submenu item
                </button>
              </div>
            )}
          </div>
        ))}

        <button onClick={addItem} className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
          <LuPlus size={18} /> Add Menu Item
        </button>
      </div>

      <div className="flex items-center gap-3 sticky bottom-0 bg-slate-50 py-3">
        <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary px-8">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            <LuCheck size={16} /> Saved!
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rtl,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rtl?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        className="admin-input"
        dir={rtl ? "rtl" : "ltr"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
