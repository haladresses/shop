"use client";
import { LuCheck, LuCornerDownRight } from "react-icons/lu";
import type { AttributeValue, CategoryAttribute } from "@/lib/attributes";

// A single-choice field with up to this many options shows them as one-click
// chips; longer lists fall back to a dropdown so the form stays compact.
const CHIP_LIMIT = 12;

const chip = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    active
      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
  }`;

/** The input control for one specification field, chosen by the field's type. */
export default function AttributeField({
  def,
  value,
  onChange,
  showSource = false,
  error,
  disabled = false,
}: {
  def: CategoryAttribute;
  value: AttributeValue;
  onChange: (v: AttributeValue) => void;
  /** Show which parent category an inherited field comes from. */
  showSource?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  const wide = def.type === "MULTISELECT" || ((def.type === "SELECT" || def.type === "COLOR") && def.options.length > 4);

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5">
        <span className="text-sm font-medium text-slate-700">
          {def.labelEn || def.labelAr}
          {def.isRequired && <span className="text-rose-500"> *</span>}
        </span>
        {def.labelAr && def.labelAr !== def.labelEn && (
          <span className="text-xs text-slate-400" dir="rtl">{def.labelAr}</span>
        )}
        {showSource && def.inheritedFrom && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <LuCornerDownRight size={11} /> from {def.inheritedFrom.nameEn}
          </span>
        )}
      </div>
      <Control def={def} value={value} onChange={onChange} disabled={disabled} />
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}

function Control({
  def,
  value,
  onChange,
  disabled,
}: {
  def: CategoryAttribute;
  value: AttributeValue;
  onChange: (v: AttributeValue) => void;
  disabled: boolean;
}) {
  if (def.type === "BOOLEAN") {
    const choice = value === true ? "yes" : value === false ? "no" : "";
    return (
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="radiogroup">
        {(["yes", "no"] as const).map((c) => {
          const active = choice === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              // Clicking the selected answer again clears it (no answer).
              onClick={() => onChange(active ? null : c === "yes")}
              className={`min-w-[64px] px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {c === "yes" ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
    );
  }

  if (def.type === "NUMBER") {
    return (
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          disabled={disabled}
          className={`admin-input ${def.unit ? "!pr-14" : ""}`}
          value={value == null ? "" : String(value)}
          placeholder={def.placeholder || ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {def.unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            {def.unit}
          </span>
        )}
      </div>
    );
  }

  if (def.type === "SELECT" || def.type === "COLOR") {
    const selected = value == null ? "" : String(value);
    const stale = selected && !def.options.some((o) => o.value === selected);
    if (def.type === "SELECT" && def.options.length > CHIP_LIMIT) {
      return (
        <select
          className="admin-input admin-select"
          disabled={disabled}
          value={selected}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">Choose…</option>
          {stale && <option value={selected}>{selected} (removed option)</option>}
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.labelEn}{o.labelAr && o.labelAr !== o.labelEn ? `: ${o.labelAr}` : ""}
            </option>
          ))}
        </select>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {def.options.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(active ? null : o.value)}
              title={o.labelAr || undefined}
              className={chip(active)}
            >
              {def.type === "COLOR" && (
                <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: o.hex || "#e2e8f0" }} />
              )}
              {o.labelEn || o.labelAr}
            </button>
          );
        })}
        {stale && (
          <button type="button" onClick={() => onChange(null)} className={`${chip(true)} !border-amber-300 !bg-amber-50 !text-amber-700`} title="This option was removed from the category. Click to clear.">
            {selected} · removed
          </button>
        )}
        {def.options.length === 0 && <p className="text-xs text-slate-400">No options defined yet.</p>}
      </div>
    );
  }

  if (def.type === "MULTISELECT") {
    const selected: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];
    const toggle = (v: string) =>
      onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
    const stale = selected.filter((s) => !def.options.some((o) => o.value === s));
    return (
      <div className="flex flex-wrap gap-2">
        {def.options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => toggle(o.value)}
              title={o.labelAr || undefined}
              className={chip(active)}
            >
              {active && <LuCheck size={12} />}
              {o.labelEn || o.labelAr}
            </button>
          );
        })}
        {stale.map((s) => (
          <button key={s} type="button" onClick={() => toggle(s)} className={`${chip(true)} !border-amber-300 !bg-amber-50 !text-amber-700`} title="This option was removed from the category. Click to clear.">
            {s} · removed
          </button>
        ))}
        {def.options.length === 0 && <p className="text-xs text-slate-400">No options defined yet.</p>}
      </div>
    );
  }

  return (
    <input
      className="admin-input"
      disabled={disabled}
      value={value == null ? "" : String(value)}
      placeholder={def.placeholder || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
