"use client";
import type { IconType } from "react-icons";
import { LuCircleDot, LuHash, LuListChecks, LuPalette, LuToggleLeft, LuType } from "react-icons/lu";
import {
  needsOptions,
  uniqueKey,
  type AttributeOption,
  type AttributeType,
  type CategoryAttribute,
} from "@/lib/attributes";
import type { AttributePreset } from "@/lib/attributePresets";

export const TYPE_ICONS: Record<AttributeType, IconType> = {
  TEXT: LuType,
  NUMBER: LuHash,
  SELECT: LuCircleDot,
  MULTISELECT: LuListChecks,
  COLOR: LuPalette,
  BOOLEAN: LuToggleLeft,
};

export function TypeTile({ type, size = "md" }: { type: AttributeType; size?: "sm" | "md" }) {
  const Icon = TYPE_ICONS[type];
  const box = size === "sm" ? "w-7 h-7 rounded-md" : "w-9 h-9 rounded-lg";
  return (
    <span className={`${box} flex-shrink-0 inline-flex items-center justify-center bg-indigo-50 text-indigo-600`}>
      <Icon size={size === "sm" ? 14 : 17} />
    </span>
  );
}

export type DraftOption = AttributeOption & { uid: string; hex: string };

/** Editor-side copy of a field. `uid` is a client id; `id` is the saved row's id. */
export type DraftField = {
  uid: string;
  id?: string;
  originalKey?: string;
  originalType?: AttributeType;
  key: string;
  /** Once true the key no longer follows the label (saved fields keep their key stable). */
  keyTouched: boolean;
  labelEn: string;
  labelAr: string;
  type: AttributeType;
  options: DraftOption[];
  unit: string;
  placeholder: string;
  isRequired: boolean;
  isFilterable: boolean;
};

let seq = 0;
export const newUid = (prefix = "u") => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const toDraftOption = (o: AttributeOption): DraftOption => ({
  value: o.value,
  labelEn: o.labelEn,
  labelAr: o.labelAr,
  hex: o.hex ?? "",
  uid: newUid("o"),
});

export function toDraft(a: CategoryAttribute): DraftField {
  return {
    uid: newUid("f"),
    id: a.id,
    originalKey: a.key,
    originalType: a.type,
    key: a.key,
    keyTouched: true,
    labelEn: a.labelEn,
    labelAr: a.labelAr,
    type: a.type,
    options: a.options.map(toDraftOption),
    unit: a.unit ?? "",
    placeholder: a.placeholder ?? "",
    isRequired: a.isRequired,
    isFilterable: a.isFilterable,
  };
}

/** A copy of an existing definition as a brand-new field (no id, so nothing is renamed). */
export function cloneAsNew(a: CategoryAttribute, key: string): DraftField {
  return { ...toDraft(a), id: undefined, originalKey: undefined, originalType: undefined, key };
}

export function presetToDraft(p: AttributePreset, taken: Set<string>): DraftField {
  return {
    uid: newUid("f"),
    key: taken.has(p.key) ? uniqueKey(p.key, taken) : p.key,
    keyTouched: true,
    labelEn: p.labelEn,
    labelAr: p.labelAr,
    type: p.type,
    options: (p.options ?? []).map(toDraftOption),
    unit: p.unit ?? "",
    placeholder: p.placeholder ?? "",
    isRequired: false,
    isFilterable: Boolean(p.isFilterable),
  };
}

export function blankDraft(type: AttributeType, taken: Set<string>): DraftField {
  return {
    uid: newUid("f"),
    key: uniqueKey("", taken),
    keyTouched: false,
    labelEn: "",
    labelAr: "",
    type,
    options: [],
    unit: "",
    placeholder: "",
    isRequired: false,
    isFilterable: type !== "TEXT" && type !== "NUMBER",
  };
}

/** Shape the editor draft as a definition, for previews. */
export function draftToAttribute(f: DraftField, index: number): CategoryAttribute {
  return {
    id: f.id,
    key: f.key,
    labelEn: f.labelEn.trim() || f.labelAr.trim() || "Untitled field",
    labelAr: f.labelAr.trim(),
    type: f.type,
    options: f.options
      .filter((o) => o.labelEn.trim() || o.labelAr.trim())
      .map((o) => ({ value: o.value, labelEn: o.labelEn.trim() || o.labelAr.trim(), labelAr: o.labelAr.trim(), hex: o.hex || undefined })),
    unit: f.unit || null,
    placeholder: f.placeholder || null,
    isRequired: f.isRequired,
    isFilterable: f.isFilterable,
    sortOrder: index,
    inheritedFrom: null,
  };
}

/** Stable string used to tell whether anything changed since the last save. */
export function snapshot(fields: DraftField[]): string {
  return JSON.stringify(
    fields.map((f) => [
      f.id ?? null, f.key, f.labelEn, f.labelAr, f.type, f.unit, f.placeholder, f.isRequired, f.isFilterable,
      f.options.map((o) => [o.value, o.labelEn, o.labelAr, o.hex]),
    ]),
  );
}

/** Per-field problems that block saving, keyed by the draft's uid. */
export function validateDrafts(fields: DraftField[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.labelEn.trim() && !f.labelAr.trim()) {
      errors[f.uid] = "Give this field a name.";
      continue;
    }
    if (!/^[a-z0-9_]+$/.test(f.key)) {
      errors[f.uid] = "The key (under Advanced) may only use lowercase letters, numbers and _.";
      continue;
    }
    if (seen.has(f.key)) {
      errors[f.uid] = `Another field already uses the key "${f.key}". Change it under Advanced.`;
      continue;
    }
    seen.add(f.key);
    if (needsOptions(f.type) && !f.options.some((o) => o.labelEn.trim() || o.labelAr.trim())) {
      errors[f.uid] = "Add at least one option.";
    }
  }
  return errors;
}

/** The PUT body for /api/categories/[id]/attributes. */
export function buildPayload(fields: DraftField[]) {
  return fields.map((f, i) => {
    const labelEn = f.labelEn.trim() || f.labelAr.trim();
    const labelAr = f.labelAr.trim() || labelEn;
    const seenValues = new Set<string>();
    const options = needsOptions(f.type)
      ? f.options
          .filter((o) => o.labelEn.trim() || o.labelAr.trim())
          .map((o) => {
            let value = o.value || uniqueKey(o.labelEn, seenValues, "option");
            if (seenValues.has(value)) value = uniqueKey(value, seenValues, "option");
            seenValues.add(value);
            const en = o.labelEn.trim() || o.labelAr.trim();
            return {
              value,
              labelEn: en,
              labelAr: o.labelAr.trim() || en,
              ...(f.type === "COLOR" && o.hex ? { hex: o.hex } : {}),
            };
          })
      : [];
    return {
      ...(f.id ? { id: f.id } : {}),
      key: f.key,
      labelEn,
      labelAr,
      type: f.type,
      options,
      unit: f.type === "NUMBER" && f.unit.trim() ? f.unit.trim() : null,
      placeholder: (f.type === "TEXT" || f.type === "NUMBER") && f.placeholder.trim() ? f.placeholder.trim() : null,
      isRequired: f.isRequired,
      isFilterable: f.isFilterable,
      sortOrder: i,
    };
  });
}

/**
 * True when a name still needs an Arabic version: none was typed, or it only
 * holds the English text that saving copies in as a fallback. Short codes such
 * as "XL" read the same in both languages and are not flagged.
 */
export const needsArabic = (en: string, ar: string) => {
  const a = ar.trim();
  const e = en.trim();
  return !a || (a === e && /[a-z]{3,}/i.test(e));
};

/** Move the item at `from` to position `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
      </span>
    </label>
  );
}
