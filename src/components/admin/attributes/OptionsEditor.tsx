"use client";
import { useRef, useState } from "react";
import { LuCheck, LuGripVertical, LuPlus, LuX } from "react-icons/lu";
import { uniqueKey, type AttributeType } from "@/lib/attributes";
import { moveItem, needsArabic, newUid, type DraftOption } from "./shared";

// Separators accepted when a list is pasted: new line, comma, Arabic comma, semicolon.
const LIST_SEPARATOR = /[\n,،;]+/;

/**
 * Chip-style editor for a field's options. Type a name and press Enter, or
 * paste a whole list at once; click a chip to edit it, drag to reorder.
 */
export default function OptionsEditor({
  type,
  options,
  onChange,
  disabled = false,
}: {
  type: AttributeType;
  options: DraftOption[];
  onChange: (next: DraftOption[]) => void;
  disabled?: boolean;
}) {
  const isColor = type === "COLOR";
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [hex, setHex] = useState("#111111");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const enRef = useRef<HTMLInputElement>(null);

  const exists = (label: string) => {
    const l = label.trim().toLowerCase();
    return options.some((o) => o.labelEn.trim().toLowerCase() === l || o.labelAr.trim() === label.trim());
  };

  const make = (labelEn: string, labelAr: string, taken: Set<string>, color = ""): DraftOption => {
    const value = uniqueKey(labelEn, taken, "option");
    taken.add(value);
    return { uid: newUid("o"), value, labelEn, labelAr, hex: isColor ? color : "" };
  };

  const add = () => {
    const e = en.trim();
    const a = ar.trim();
    if (!e && !a) return;
    if (exists(e || a)) {
      setNotice(`“${e || a}” is already in the list.`);
      return;
    }
    onChange([...options, make(e, a, new Set(options.map((o) => o.value)), hex)]);
    setEn("");
    setAr("");
    setNotice("");
    enRef.current?.focus();
  };

  const addMany = (labels: string[], lang: "en" | "ar") => {
    const taken = new Set(options.map((o) => o.value));
    const seen = new Set<string>();
    const fresh = labels
      .map((l) => l.trim())
      .filter((l) => l && !seen.has(l.toLowerCase()) && !exists(l) && seen.add(l.toLowerCase()))
      .map((l) => (lang === "en" ? make(l, "", taken) : make("", l, taken)));
    if (fresh.length) {
      onChange([...options, ...fresh]);
      setNotice(`Added ${fresh.length} option${fresh.length === 1 ? "" : "s"}.`);
    } else {
      setNotice("Those options are already in the list.");
    }
  };

  const onPaste = (lang: "en" | "ar") => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!LIST_SEPARATOR.test(text)) return;
    e.preventDefault();
    addMany(text.split(LIST_SEPARATOR), lang);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  const patch = (uid: string, p: Partial<DraftOption>) =>
    onChange(options.map((o) => (o.uid === uid ? { ...o, ...p } : o)));

  const remove = (uid: string) => {
    onChange(options.filter((o) => o.uid !== uid));
    if (editing === uid) setEditing(null);
  };

  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  const editingOption = options.find((o) => o.uid === editing);
  const missingArabic = options.filter((o) => needsArabic(o.labelEn, o.labelAr)).length;

  return (
    <div>
      {options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <div
              key={o.uid}
              draggable={!disabled}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", o.uid);
                setDrag(i);
              }}
              onDragOver={(e) => {
                if (drag === null) return;
                e.preventDefault();
                e.stopPropagation();
                setOver(i);
              }}
              onDrop={(e) => {
                if (drag === null) return;
                e.preventDefault();
                e.stopPropagation();
                onChange(moveItem(options, drag, i));
                endDrag();
              }}
              onDragEnd={endDrag}
              className={`group inline-flex items-center gap-1.5 rounded-full border bg-white py-1 pl-1.5 pr-1 text-xs transition ${
                editing === o.uid ? "border-indigo-400 ring-2 ring-indigo-100" : over === i && drag !== i ? "border-indigo-400" : "border-slate-200"
              } ${drag === i ? "opacity-40" : ""}`}
            >
              {!disabled && <LuGripVertical size={12} className="text-slate-300 cursor-grab" aria-hidden />}
              {isColor && (
                <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: o.hex || "#e2e8f0" }} />
              )}
              <button
                type="button"
                onClick={() => setEditing(editing === o.uid ? null : o.uid)}
                className="font-medium text-slate-700 hover:text-indigo-600"
                title="Click to edit"
              >
                {o.labelEn || <span dir="rtl">{o.labelAr}</span>}
                {/* Separate spans so the Arabic name keeps its own direction and the dot stays between the two. */}
                {o.labelEn && !needsArabic(o.labelEn, o.labelAr) && o.labelAr.trim() !== o.labelEn.trim() && (
                  <>
                    <span className="mx-1 font-normal text-slate-300">·</span>
                    <span className="font-normal text-slate-400" dir="rtl">{o.labelAr}</span>
                  </>
                )}
                {needsArabic(o.labelEn, o.labelAr) && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" title="Arabic name missing" />
                )}
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(o.uid)}
                  aria-label={`Remove ${o.labelEn || o.labelAr}`}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <LuX size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No options yet — add the first one below.</p>
      )}

      {editingOption && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2 admin-fade-in">
          {isColor && (
            <input
              type="color"
              value={editingOption.hex || "#111111"}
              onChange={(e) => patch(editingOption.uid, { hex: e.target.value })}
              className="w-9 h-9 rounded-lg border border-slate-200 p-0.5 cursor-pointer flex-shrink-0 bg-white"
              aria-label="Option colour"
            />
          )}
          <input
            className="admin-input !py-1.5 text-sm flex-1 min-w-[120px]"
            value={editingOption.labelEn}
            placeholder="English"
            onChange={(e) => patch(editingOption.uid, { labelEn: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), setEditing(null))}
            autoFocus
          />
          <input
            className="admin-input !py-1.5 text-sm flex-1 min-w-[120px]"
            dir="rtl"
            value={editingOption.labelAr}
            placeholder="بالعربية"
            onChange={(e) => patch(editingOption.uid, { labelAr: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), setEditing(null))}
          />
          <button type="button" onClick={() => setEditing(null)} className="admin-btn admin-btn-secondary text-xs !py-2">
            <LuCheck size={13} /> Done
          </button>
        </div>
      )}

      {!disabled && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isColor && (
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="w-9 h-9 rounded-lg border border-slate-200 p-0.5 cursor-pointer flex-shrink-0 bg-white"
                aria-label="New option colour"
              />
            )}
            <input
              ref={enRef}
              className="admin-input !py-2 text-sm flex-1 min-w-[140px]"
              placeholder="New option, e.g. Silk"
              value={en}
              onChange={(e) => { setEn(e.target.value); setNotice(""); }}
              onKeyDown={onKey}
              onPaste={onPaste("en")}
            />
            <input
              className="admin-input !py-2 text-sm flex-1 min-w-[120px]"
              dir="rtl"
              placeholder="بالعربية، مثل حرير"
              value={ar}
              onChange={(e) => { setAr(e.target.value); setNotice(""); }}
              onKeyDown={onKey}
              onPaste={onPaste("ar")}
            />
            <button type="button" onClick={add} disabled={!en.trim() && !ar.trim()} className="admin-btn admin-btn-secondary text-xs !py-2.5 disabled:opacity-50">
              <LuPlus size={13} /> Add
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {notice || "Press Enter to add. Paste a list (one per line or comma-separated) to add many at once. Drag chips to reorder."}
          </p>
          {missingArabic > 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              {missingArabic} option{missingArabic === 1 ? " has" : "s have"} no Arabic name yet — click a chip to add it. Arabic shoppers will see the English name until then.
            </p>
          )}
        </>
      )}
    </div>
  );
}
