"use client";
import { LuCheck, LuLock, LuPlus, LuSearch, LuSparkles, LuX } from "react-icons/lu";
import { useState } from "react";
import { ATTRIBUTE_TYPE_OPTIONS, type AttributeType } from "@/lib/attributes";
import { ATTRIBUTE_PRESETS, PRESET_GROUPS, PRESET_KITS, type AttributePreset } from "@/lib/attributePresets";
import { TYPE_ICONS, TypeTile } from "./shared";

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">{children}</h4>
);

/**
 * The "Add field" picker: search ready-made fields, add a whole starter set in
 * one click, or start a custom field from one of the six answer types.
 */
export default function AddFieldPanel({
  ownKeys,
  inheritedKeys,
  onAddPreset,
  onAddKit,
  onAddBlank,
  onClose,
}: {
  ownKeys: Set<string>;
  inheritedKeys: Set<string>;
  onAddPreset: (preset: AttributePreset) => void;
  onAddKit: (keys: string[], label: string) => void;
  onAddBlank: (type: AttributeType, label?: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const raw = q.trim();
  const query = raw.toLowerCase();

  const state = (key: string) =>
    inheritedKeys.has(key) ? "inherited" : ownKeys.has(key) ? "added" : "available";

  const matches = (p: AttributePreset) =>
    !query ||
    p.labelEn.toLowerCase().includes(query) ||
    p.labelAr.includes(raw) ||
    p.key.includes(query) ||
    (p.options ?? []).some((o) => o.labelEn.toLowerCase().includes(query) || o.labelAr.includes(raw));

  const presets = ATTRIBUTE_PRESETS.filter(matches);
  const types = ATTRIBUTE_TYPE_OPTIONS.filter(
    (t) => !query || t.label.toLowerCase().includes(query) || t.labelAr.includes(raw),
  );

  return (
    <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            autoFocus
            className="admin-input !pl-9"
            placeholder="Search ready-made fields: fabric, sleeves, الخامة…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 flex-shrink-0 rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 flex items-center justify-center"
        >
          <LuX size={18} />
        </button>
      </div>

      {raw && (
        <button
          type="button"
          onClick={() => onAddBlank("SELECT", raw)}
          className="mb-4 w-full flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-white px-3 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50"
        >
          <LuPlus size={15} /> Create a new field called <strong className="font-semibold">“{raw}”</strong>
        </button>
      )}

      {!query && (
        <section className="mb-5">
          <SectionTitle><LuSparkles size={13} /> Starter sets: add a typical category in one click</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRESET_KITS.map((kit) => {
              const missing = kit.keys.filter((k) => state(k) === "available");
              return (
                <button
                  type="button"
                  key={kit.id}
                  disabled={!missing.length}
                  onClick={() => onAddKit(missing, kit.labelEn)}
                  className="text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-indigo-300 disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none"
                >
                  <span className="block text-sm font-medium text-slate-800">{kit.labelEn}</span>
                  <span className="block text-xs text-slate-400" dir="rtl">{kit.labelAr}</span>
                  <span className="block text-xs font-medium text-indigo-600 mt-2">
                    {missing.length ? `+ Add ${missing.length} field${missing.length === 1 ? "" : "s"}` : "All added"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {PRESET_GROUPS.map((g) => {
        const items = presets.filter((p) => p.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id} className="mb-4">
            <SectionTitle>
              {g.labelEn}
              <span className="text-slate-300">·</span>
              <span className="font-normal normal-case tracking-normal text-slate-400" dir="rtl">{g.labelAr}</span>
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {items.map((p) => {
                const s = state(p.key);
                const Icon = TYPE_ICONS[p.type];
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={s !== "available"}
                    onClick={() => onAddPreset(p)}
                    title={
                      s === "inherited" ? "Already comes from a parent category"
                        : s === "added" ? "Already added"
                        : `Add “${p.labelEn}”${p.options?.length ? ` with ${p.options.length} options` : ""}`
                    }
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      s === "available"
                        ? "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                        : "border-slate-200 bg-slate-100 text-slate-400 cursor-default"
                    }`}
                  >
                    {s === "added" ? <LuCheck size={14} className="text-emerald-500" />
                      : s === "inherited" ? <LuLock size={13} />
                      : <Icon size={14} className="text-indigo-500" />}
                    <span className="font-medium">{p.labelEn}</span>
                    <span className="text-xs text-slate-400" dir="rtl">{p.labelAr}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {types.length > 0 && (
        <section className="mt-5">
          <SectionTitle>Build your own</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {types.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => onAddBlank(t.value)}
                className="flex items-start gap-3 text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm"
              >
                <TypeTile type={t.value} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">
                    {t.label} <span className="text-xs font-normal text-slate-400" dir="rtl">{t.labelAr}</span>
                  </span>
                  <span className="block text-xs text-slate-500">{t.description}</span>
                  <span className="block text-[11px] text-slate-400 mt-1">e.g. {t.example}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {query && !presets.length && !types.length && (
        <p className="text-sm text-slate-500">No ready-made field matches “{raw}”: use the button above to create it.</p>
      )}
    </div>
  );
}
