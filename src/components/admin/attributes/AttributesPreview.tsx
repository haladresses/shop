"use client";
import { useState } from "react";
import { LuEye } from "react-icons/lu";
import { formatAttributeValue, type AttributeValue, type CategoryAttribute } from "@/lib/attributes";
import AttributeField from "./AttributeField";

/** A plausible value so the shop preview is never empty. */
function sampleValue(a: CategoryAttribute): AttributeValue {
  switch (a.type) {
    case "SELECT":
    case "COLOR":
      return a.options[0]?.value ?? null;
    case "MULTISELECT":
      return a.options.slice(0, 2).map((o) => o.value);
    case "BOOLEAN":
      return true;
    case "NUMBER":
      return a.placeholder && !Number.isNaN(Number(a.placeholder)) ? Number(a.placeholder) : 120;
    default:
      return a.placeholder || "Sample text";
  }
}

/**
 * Live preview of the fields being edited: how the specification table reads
 * to shoppers (English or Arabic), and how the inputs look to whoever adds a
 * product. Values typed in the form tab feed the shop tab.
 */
export default function AttributesPreview({ fields }: { fields: CategoryAttribute[] }) {
  const [tab, setTab] = useState<"shop" | "form">("shop");
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [values, setValues] = useState<Record<string, AttributeValue>>({});
  const valueOf = (a: CategoryAttribute) => (a.key in values ? values[a.key] : sampleValue(a));
  const isArabic = lang === "ar";

  const rows = fields
    .map((a) => ({
      key: a.key,
      label: (isArabic ? a.labelAr : a.labelEn) || a.labelEn || a.labelAr,
      value: formatAttributeValue(a, valueOf(a), isArabic),
    }))
    .filter((r) => r.value !== "");

  const seg = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs font-medium ${active ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`;

  return (
    <aside className="admin-card lg:sticky lg:top-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <LuEye size={16} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700 flex-1">Live preview</h3>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
          <button type="button" className={seg(tab === "shop")} onClick={() => setTab("shop")}>Shop page</button>
          <button type="button" className={seg(tab === "form")} onClick={() => setTab("form")}>Product form</button>
        </div>
      </div>

      <div className="p-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
        {fields.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Add a field to see it here.</p>
        ) : tab === "shop" ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400">What shoppers see</span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                <button type="button" className={seg(lang === "en")} onClick={() => setLang("en")}>EN</button>
                <button type="button" className={seg(lang === "ar")} onClick={() => setLang("ar")}>عربي</button>
              </div>
            </div>
            <div dir={isArabic ? "rtl" : "ltr"} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 border-b border-slate-200">
                {isArabic ? "المواصفات" : "Specifications"}
              </div>
              <div className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <div key={`${r.key}-${i}`} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                    <span className="text-slate-500">{r.label}</span>
                    <span className="font-medium text-slate-800 text-end">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Sample values. Try different answers in the <button type="button" className="underline" onClick={() => setTab("form")}>product form</button> tab.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            {fields.map((a, i) => (
              <AttributeField
                key={`${a.key}-${i}`}
                def={a}
                value={valueOf(a)}
                onChange={(v) => setValues((s) => ({ ...s, [a.key]: v }))}
                showSource
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
