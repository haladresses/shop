"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LuArrowRight, LuChevronDown, LuChevronUp, LuCopy, LuCopyPlus, LuGripVertical, LuInfo,
  LuLock, LuPlus, LuSettings2, LuSparkles, LuTrash2, LuTriangleAlert,
} from "react-icons/lu";
import {
  ATTRIBUTE_TYPE_OPTIONS, attributeTypeMeta, fetchCategoryAttributes, needsOptions,
  normalizeAttributes, uniqueKey, type AttributeType, type CategoryAttribute,
} from "@/lib/attributes";
import { PRESET_KITS, presetByKey, type AttributePreset } from "@/lib/attributePresets";
import AddFieldPanel from "./AddFieldPanel";
import AttributesPreview from "./AttributesPreview";
import OptionsEditor from "./OptionsEditor";
import {
  blankDraft, buildPayload, cloneAsNew, draftToAttribute, moveItem, needsArabic, newUid, presetToDraft,
  snapshot, Switch, toDraft, toDraftOption, TYPE_ICONS, TypeTile, validateDrafts, type DraftField,
} from "./shared";

type PathItem = { id: string; nameEn: string; nameAr: string };

export type EditorCategory = {
  id: string;
  nameEn: string;
  nameAr: string;
  image: string | null;
  parentId: string | null;
  isActive: boolean;
  path: PathItem[];
  productCount: number;
};

type EditorData = {
  category: Omit<EditorCategory, "productCount">;
  own: unknown[];
  inherited: unknown[];
  usage: Record<string, number>;
  productCount: number;
  canManage: boolean;
};

const UNITS = ["cm", "mm", "inch", "kg", "g", "ml", "%"];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Edit the specification fields of one category. Changes stay local until
 * "Save changes"; `layout="page"` adds a live preview column.
 */
export default function CategoryAttributesEditor({
  categoryId,
  layout = "page",
  onSaved,
  onDirtyChange,
  onLoaded,
}: {
  categoryId: string;
  layout?: "page" | "modal";
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onLoaded?: (category: EditorCategory) => void;
}) {
  const [data, setData] = useState<EditorData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fields, setFields] = useState<DraftField[]>([]);
  const [savedFields, setSavedFields] = useState<DraftField[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [focusUid, setFocusUid] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [overUid, setOverUid] = useState<string | null>(null);
  const [armedUid, setArmedUid] = useState<string | null>(null);

  // Keep the latest callbacks without re-running effects when the parent re-renders.
  const callbacks = useRef({ onDirtyChange, onLoaded });
  useEffect(() => {
    callbacks.current = { onDirtyChange, onLoaded };
  });

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch(`/api/categories/${categoryId}/attributes?view=editor`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setLoadError(json.error === "Forbidden" ? "You don't have permission to view these fields." : json.error || "Could not load the fields.");
        return;
      }
      const d = json.data as EditorData;
      const drafts = normalizeAttributes(d.own).map(toDraft);
      setData(d);
      setFields(drafts);
      setSavedFields(drafts);
      setErrors({});
      callbacks.current.onLoaded?.({ ...d.category, productCount: d.productCount });
    } catch {
      setLoadError("Could not load the fields. Check your connection and try again.");
    }
  }, [categoryId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const inherited = useMemo(() => normalizeAttributes(data?.inherited ?? []), [data]);
  const inheritedKeys = useMemo(() => new Set(inherited.map((a) => a.key)), [inherited]);
  const ownKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const dirty = useMemo(() => snapshot(fields) !== snapshot(savedFields), [fields, savedFields]);
  const canManage = data?.canManage ?? false;
  const usage = data?.usage ?? {};
  const usageOf = (f: DraftField) => usage[f.originalKey ?? f.key] ?? 0;

  useEffect(() => {
    callbacks.current.onDirtyChange?.(dirty);
  }, [dirty]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty || layout !== "page") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, layout]);

  const takenKeys = (exceptUid?: string) =>
    new Set([...inheritedKeys, ...fields.filter((f) => f.uid !== exceptUid).map((f) => f.key)]);

  const patchField = (uid: string, patch: Partial<DraftField>) => {
    setFields((fs) => fs.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));
    if (errors[uid]) {
      setErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => k !== uid)));
    }
  };

  const setLabel = (f: DraftField, lang: "en" | "ar", value: string) => {
    const patch: Partial<DraftField> = lang === "en" ? { labelEn: value } : { labelAr: value };
    // New fields get their key from the name as you type; saved fields keep theirs.
    if (!f.keyTouched) {
      const en = lang === "en" ? value : f.labelEn;
      const ar = lang === "ar" ? value : f.labelAr;
      patch.key = uniqueKey(en || ar, takenKeys(f.uid));
    }
    patchField(f.uid, patch);
  };

  const openField = (uid: string, focus = false) => {
    setExpanded(uid);
    setFocusUid(focus ? uid : null);
    setConfirmDelete(null);
  };

  const append = (newFields: DraftField[]) => setFields((fs) => [...fs, ...newFields]);

  const addPreset = (p: AttributePreset) => {
    if (ownKeys.has(p.key) || inheritedKeys.has(p.key)) return;
    append([presetToDraft(p, takenKeys())]);
    toast.success(`“${p.labelEn}” added`);
  };

  const addKit = (keys: string[], label: string) => {
    const taken = takenKeys();
    const drafts = keys
      .map(presetByKey)
      .filter((p): p is AttributePreset => !!p && !taken.has(p.key))
      .map((p) => {
        const d = presetToDraft(p, taken);
        taken.add(d.key);
        return d;
      });
    if (!drafts.length) return;
    append(drafts);
    setAdding(false);
    toast.success(`${label}: ${plural(drafts.length, "field")} added`);
  };

  const addBlank = (type: AttributeType, label?: string) => {
    const draft = blankDraft(type, takenKeys());
    if (label) {
      draft.labelEn = label;
      draft.key = uniqueKey(label, takenKeys());
    }
    append([draft]);
    setAdding(false);
    openField(draft.uid, true);
  };

  const copyFrom = async (sourceId: string, sourceName: string) => {
    const defs = await fetchCategoryAttributes(sourceId, undefined, { effective: false });
    const taken = takenKeys();
    const fresh = defs.filter((d) => !taken.has(d.key)).map((d) => {
      taken.add(d.key);
      return cloneAsNew(d, d.key);
    });
    if (!fresh.length) {
      toast(`Nothing new to copy: ${sourceName}'s fields are already here.`);
      return;
    }
    append(fresh);
    toast.success(`Copied ${plural(fresh.length, "field")} from ${sourceName}`);
  };

  const removeField = (uid: string) => {
    setFields((fs) => fs.filter((f) => f.uid !== uid));
    setConfirmDelete(null);
    if (expanded === uid) setExpanded(null);
  };

  const duplicateField = (f: DraftField) => {
    const copy: DraftField = {
      ...f,
      uid: newUid("f"),
      id: undefined,
      originalKey: undefined,
      originalType: undefined,
      keyTouched: false,
      labelEn: f.labelEn ? `${f.labelEn} (copy)` : "",
      key: uniqueKey(`${f.labelEn || f.key} copy`, takenKeys()),
      options: f.options.map(toDraftOption),
    };
    setFields((fs) => {
      const i = fs.findIndex((x) => x.uid === f.uid);
      return [...fs.slice(0, i + 1), copy, ...fs.slice(i + 1)];
    });
    openField(copy.uid, true);
  };

  const moveField = (uid: string, delta: number) =>
    setFields((fs) => {
      const i = fs.findIndex((f) => f.uid === uid);
      return moveItem(fs, i, i + delta);
    });

  const endDrag = () => {
    setDragUid(null);
    setOverUid(null);
    setArmedUid(null);
  };

  const dropOn = (targetUid: string) => {
    if (!dragUid || dragUid === targetUid) return endDrag();
    setFields((fs) => moveItem(fs, fs.findIndex((f) => f.uid === dragUid), fs.findIndex((f) => f.uid === targetUid)));
    endDrag();
  };

  const discard = () => {
    setFields(savedFields);
    setErrors({});
    setExpanded(null);
    setConfirmDelete(null);
  };

  const save = async () => {
    const errs = validateDrafts(fields);
    setErrors(errs);
    const firstBad = fields.find((f) => errs[f.uid]);
    if (firstBad) {
      openField(firstBad.uid);
      toast.error("Some fields need attention before saving.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${categoryId}/attributes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: buildPayload(fields) }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not save the fields.");
        return;
      }
      toast.success("Fields saved");
      setExpanded(null);
      await load();
      onSaved?.();
    } catch {
      toast.error("Could not save the fields.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-3">
        <LuTriangleAlert size={16} className="flex-shrink-0" />
        <span className="flex-1">{loadError}</span>
        <button type="button" onClick={load} className="admin-btn admin-btn-secondary text-xs">Try again</button>
      </div>
    );
  }

  if (!data) {
    return <div className="flex justify-center py-16"><span className="spinner" /></div>;
  }

  const previewFields: CategoryAttribute[] = [...inherited, ...fields.map(draftToAttribute)];
  const subtitle = [
    plural(fields.length, "field"),
    inherited.length ? `${inherited.length} inherited` : "",
    plural(data.productCount, "product"),
  ].filter(Boolean).join(" · ");

  const editor = (
    <div className="min-w-0 space-y-4">
      {!canManage && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          <LuLock size={15} /> You can view these fields, but changing them needs the “Manage Categories” permission.
        </div>
      )}

      {inherited.length > 0 && <InheritedFields fields={inherited} />}

      <div className="admin-card !overflow-visible">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-800">Fields for {data.category.nameEn}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          {canManage && (
            <>
              <CopyFromMenu currentId={categoryId} onCopy={copyFrom} />
              <button
                type="button"
                onClick={() => setAdding((a) => !a)}
                className="admin-btn admin-btn-primary"
                aria-expanded={adding}
              >
                <LuPlus size={16} /> Add field
              </button>
            </>
          )}
        </div>

        {adding && (
          <AddFieldPanel
            ownKeys={ownKeys}
            inheritedKeys={inheritedKeys}
            onAddPreset={addPreset}
            onAddKit={addKit}
            onAddBlank={addBlank}
            onClose={() => setAdding(false)}
          />
        )}

        {fields.length === 0 ? (
          !adding && (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <LuSparkles size={22} />
              </div>
              <h4 className="font-semibold text-slate-800">No fields yet</h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                Fields are the details every product in this category shares. Fabric, length, sleeves… Start with a
                ready-made set or build your own.
              </p>
              {canManage && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {PRESET_KITS.map((kit) => (
                    <button
                      key={kit.id}
                      type="button"
                      onClick={() => addKit(kit.keys.filter((k) => !inheritedKeys.has(k)), kit.labelEn)}
                      className="admin-btn admin-btn-secondary"
                    >
                      <LuSparkles size={14} /> {kit.labelEn} set
                    </button>
                  ))}
                  <button type="button" onClick={() => setAdding(true)} className="admin-btn admin-btn-primary">
                    <LuPlus size={15} /> Add a field
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <ul className="divide-y divide-slate-100">
            {fields.map((f, i) => {
              const open = expanded === f.uid;
              const used = usageOf(f);
              const meta = attributeTypeMeta(f.type);
              const missingArabic =
                needsArabic(f.labelEn, f.labelAr) || f.options.some((o) => needsArabic(o.labelEn, o.labelAr));
              return (
                <li
                  key={f.uid}
                  draggable={canManage && armedUid === f.uid}
                  onDragStart={(e) => {
                    if (e.target !== e.currentTarget) return;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", f.uid);
                    setDragUid(f.uid);
                  }}
                  onDragOver={(e) => {
                    if (!dragUid) return;
                    e.preventDefault();
                    setOverUid(f.uid);
                  }}
                  onDrop={(e) => {
                    if (!dragUid) return;
                    e.preventDefault();
                    dropOn(f.uid);
                  }}
                  onDragEnd={endDrag}
                  className={`relative ${dragUid === f.uid ? "opacity-40" : ""} ${
                    overUid === f.uid && dragUid !== f.uid ? "shadow-[inset_0_2px_0_0_#6366f1]" : ""
                  } ${errors[f.uid] ? "bg-rose-50/40" : ""}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => (open ? setExpanded(null) : openField(f.uid))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (open) setExpanded(null);
                        else openField(f.uid);
                      }
                    }}
                    aria-expanded={open}
                    className="flex items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-slate-50/80"
                  >
                    {canManage && (
                      <span
                        onMouseDown={() => setArmedUid(f.uid)}
                        onMouseUp={() => setArmedUid(null)}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:flex text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
                        title="Drag to reorder"
                        aria-hidden
                      >
                        <LuGripVertical size={16} />
                      </span>
                    )}
                    <TypeTile type={f.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className={`font-medium truncate ${f.labelEn || f.labelAr ? "text-slate-800" : "text-slate-400 italic"}`}>
                          {f.labelEn || f.labelAr || "Untitled field"}
                        </span>
                        {f.labelEn && f.labelAr && (
                          <span className="text-sm text-slate-400 truncate" dir="rtl">{f.labelAr}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Tag>{meta.label}</Tag>
                        {needsOptions(f.type) && <Tag>{plural(f.options.length, "option")}</Tag>}
                        {f.type === "NUMBER" && f.unit && <Tag>{f.unit}</Tag>}
                        {f.isRequired && <Tag tone="rose">Required</Tag>}
                        {f.isFilterable && <Tag tone="indigo">Shop filter</Tag>}
                        {used > 0 && <Tag tone="emerald">Used on {plural(used, "product")}</Tag>}
                        {!f.id && <Tag tone="amber">New</Tag>}
                        {missingArabic && (f.labelEn || f.labelAr) && <Tag tone="amber">Arabic missing</Tag>}
                      </div>
                      {errors[f.uid] && (
                        <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                          <LuTriangleAlert size={12} /> {errors[f.uid]}
                        </p>
                      )}
                    </div>
                    <LuChevronDown size={18} className={`text-slate-400 flex-shrink-0 ${open ? "rotate-180" : ""}`} />
                  </div>

                  {open && (
                    <FieldEditor
                      f={f}
                      used={used}
                      canManage={canManage}
                      autoFocus={focusUid === f.uid}
                      isFirst={i === 0}
                      isLast={i === fields.length - 1}
                      confirmingDelete={confirmDelete === f.uid}
                      onConfirmDelete={(v) => setConfirmDelete(v ? f.uid : null)}
                      onPatch={(p) => patchField(f.uid, p)}
                      onLabel={(lang, v) => setLabel(f, lang, v)}
                      onRemove={() => removeField(f.uid)}
                      onDuplicate={() => duplicateField(f)}
                      onMove={(d) => moveField(f.uid, d)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canManage && (dirty || saving) && (
        <div className="sticky bottom-0 z-10 pb-1">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-slate-900/5">
            <span className="flex items-center gap-2 text-sm text-slate-600 flex-1 min-w-[160px]">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> You have unsaved changes
            </span>
            <button type="button" onClick={discard} disabled={saving} className="admin-btn admin-btn-secondary">Discard</button>
            <button type="button" onClick={save} disabled={saving} className="admin-btn admin-btn-primary disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (layout === "modal") return editor;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
      {editor}
      <AttributesPreview fields={previewFields} />
    </div>
  );
}

function Tag({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "rose" | "indigo" | "emerald" | "amber" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-50 text-rose-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

function Notice({ tone, children }: { tone: "amber" | "indigo"; children: React.ReactNode }) {
  const cls = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-indigo-100 bg-indigo-50 text-indigo-800";
  const Icon = tone === "amber" ? LuTriangleAlert : LuInfo;
  return (
    <div className={`mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <Icon size={14} className="mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-slate-600 mb-1.5">{children}</label>
);

function FieldEditor({
  f, used, canManage, autoFocus, isFirst, isLast, confirmingDelete,
  onConfirmDelete, onPatch, onLabel, onRemove, onDuplicate, onMove,
}: {
  f: DraftField;
  used: number;
  canManage: boolean;
  autoFocus: boolean;
  isFirst: boolean;
  isLast: boolean;
  confirmingDelete: boolean;
  onConfirmDelete: (v: boolean) => void;
  onPatch: (p: Partial<DraftField>) => void;
  onLabel: (lang: "en" | "ar", v: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = attributeTypeMeta(f.type);
  const typeChanged = !!f.originalType && f.type !== f.originalType;
  const renamed = !!f.id && !!f.originalKey && f.key !== f.originalKey;

  useEffect(() => {
    if (autoFocus) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [autoFocus]);

  return (
    <div ref={ref} className="px-3 sm:px-4 pb-4">
      <fieldset disabled={!canManage} className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Name in English</FieldLabel>
            <input autoFocus={autoFocus} className="admin-input" value={f.labelEn} placeholder="e.g. Fabric" onChange={(e) => onLabel("en", e.target.value)} />
          </div>
          <div>
            <FieldLabel>Name in Arabic</FieldLabel>
            <input dir="rtl" className="admin-input" value={f.labelAr} placeholder="مثال: الخامة" onChange={(e) => onLabel("ar", e.target.value)} />
          </div>
        </div>

        <div>
          <FieldLabel>Answer type</FieldLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ATTRIBUTE_TYPE_OPTIONS.map((t) => {
              const Icon = TYPE_ICONS[t.value];
              const active = f.type === t.value;
              return (
                <button
                  type="button"
                  key={t.value}
                  aria-pressed={active}
                  onClick={() => onPatch({ type: t.value })}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    active ? "border-indigo-500 bg-white text-indigo-700 ring-2 ring-indigo-100" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="font-medium truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {meta.description} <span className="text-slate-400">e.g. {meta.example}</span>
          </p>
          {typeChanged && used > 0 && (
            <Notice tone="amber">
              {plural(used, "product")} already have an answer for this field. Answers that don&apos;t fit the new type
              will show as “removed” on those products until you update them.
            </Notice>
          )}
        </div>

        {needsOptions(f.type) && (
          <div>
            <FieldLabel>Options</FieldLabel>
            <OptionsEditor type={f.type} options={f.options} onChange={(options) => onPatch({ options })} disabled={!canManage} />
          </div>
        )}

        {f.type === "NUMBER" && (
          <div>
            <FieldLabel>Unit</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <input className="admin-input !w-28" value={f.unit} placeholder="cm" onChange={(e) => onPatch({ unit: e.target.value })} />
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onPatch({ unit: f.unit === u ? "" : u })}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${f.unit === u ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        )}

        {(f.type === "TEXT" || f.type === "NUMBER") && (
          <div>
            <FieldLabel>Hint shown in the empty box (optional)</FieldLabel>
            <input className="admin-input" value={f.placeholder} placeholder={f.type === "NUMBER" ? "e.g. 140" : "e.g. Made in Turkey"} onChange={(e) => onPatch({ placeholder: e.target.value })} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Switch
            checked={f.isRequired}
            onChange={(v) => onPatch({ isRequired: v })}
            label="Required"
            description="A product can't be saved until this is answered."
          />
          <Switch
            checked={f.isFilterable}
            onChange={(v) => onPatch({ isFilterable: v })}
            label="Use as a shop filter"
            description="Marks this field for the shop's product filters."
          />
        </div>

        <div className="border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            aria-expanded={advanced}
          >
            <LuSettings2 size={13} /> Advanced
            <LuChevronDown size={13} className={advanced ? "rotate-180" : ""} />
          </button>
          {advanced && (
            <div className="mt-3">
              <FieldLabel>Key (internal name)</FieldLabel>
              <input
                className="admin-input font-mono text-sm"
                value={f.key}
                onChange={(e) => onPatch({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"), keyTouched: true })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Answers are stored under this key. You rarely need to change it. If you do, saved answers move to the new key automatically.
              </p>
              {renamed && used > 0 && (
                <Notice tone="indigo">
                  When you save, the answers on {plural(used, "product")} move from <code className="font-mono">{f.originalKey}</code> to{" "}
                  <code className="font-mono">{f.key}</code>.
                </Notice>
              )}
            </div>
          )}
        </div>
      </fieldset>

      {canManage && !confirmingDelete && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} className="admin-btn admin-btn-secondary text-xs !py-1.5 disabled:opacity-40">
            <LuChevronUp size={14} /> Move up
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} className="admin-btn admin-btn-secondary text-xs !py-1.5 disabled:opacity-40">
            <LuChevronDown size={14} /> Move down
          </button>
          <button type="button" onClick={onDuplicate} className="admin-btn admin-btn-secondary text-xs !py-1.5">
            <LuCopyPlus size={14} /> Duplicate
          </button>
          <button
            type="button"
            onClick={() => (used > 0 ? onConfirmDelete(true) : onRemove())}
            className="admin-btn admin-btn-danger text-xs !py-1.5 ml-auto"
          >
            <LuTrash2 size={14} /> Delete field
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <p>
            <strong>{plural(used, "product")}</strong> have an answer for this field. Deleting it hides those answers. They
            are kept, and come back if you add a field with the key <code className="font-mono">{f.originalKey ?? f.key}</code> again.
          </p>
          <div className="mt-3 flex gap-2 justify-end">
            <button type="button" onClick={() => onConfirmDelete(false)} className="admin-btn admin-btn-secondary text-xs">Keep field</button>
            <button type="button" onClick={onRemove} className="admin-btn admin-btn-danger text-xs">Delete field</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only list of fields that come from parent categories, grouped by parent. */
function InheritedFields({ fields }: { fields: CategoryAttribute[] }) {
  const groups = new Map<string, { name: string; items: CategoryAttribute[] }>();
  for (const f of fields) {
    const src = f.inheritedFrom!;
    const g = groups.get(src.id) ?? { name: src.nameEn, items: [] };
    g.items.push(f);
    groups.set(src.id, g);
  }
  return (
    <>
      {[...groups.entries()].map(([id, g]) => (
        <div key={id} className="admin-card">
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <LuLock size={15} className="text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-700">Inherited from {g.name}</p>
              <p className="text-xs text-slate-500">Products here fill these in too. Change them on {g.name}.</p>
            </div>
            <Link href={`/admin/categories/${id}/attributes`} className="admin-btn admin-btn-secondary text-xs">
              Edit on {g.name} <LuArrowRight size={13} />
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2 px-4 sm:px-5 py-3">
            {g.items.map((a) => (
              <li key={a.key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white pl-1 pr-3 py-1 text-sm">
                <TypeTile type={a.type} size="sm" />
                <span className="font-medium text-slate-700">{a.labelEn}</span>
                {a.labelAr && <span className="text-xs text-slate-400" dir="rtl">{a.labelAr}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

type TreeCategory = { id: string; nameEn: string; nameAr: string; parentId: string | null; _count: { attributes: number } };

/** "Copy from…" menu: pulls another category's fields in as new, unsaved fields. */
function CopyFromMenu({ currentId, onCopy }: { currentId: string; onCopy: (id: string, name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<TreeCategory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || cats) return;
    fetch("/api/categories?tree=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCats(d.success ? d.data : []))
      .catch(() => setCats([]));
  }, [open, cats]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const sources = (cats ?? []).filter((c) => c.id !== currentId && c._count.attributes > 0);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="admin-btn admin-btn-secondary" aria-expanded={open}>
        <LuCopy size={15} /> Copy from…
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <p className="px-4 pt-3 pb-2 text-xs text-slate-500">Copy another category&apos;s fields into this one. Fields that already exist here are skipped.</p>
          <div className="max-h-72 overflow-y-auto pb-2">
            {cats === null ? (
              <div className="flex justify-center py-6"><span className="spinner !w-6 !h-6" /></div>
            ) : sources.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">No other category has fields yet.</p>
            ) : (
              sources.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onCopy(c.id, c.nameEn);
                    setBusy(false);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-700">{c.nameEn}</span>
                    <span className="block truncate text-xs text-slate-400" dir="rtl">{c.nameAr}</span>
                  </span>
                  <span className="flex-shrink-0 text-xs text-slate-400">{plural(c._count.attributes, "field")}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
