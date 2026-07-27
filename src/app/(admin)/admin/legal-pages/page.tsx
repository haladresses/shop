"use client";
import { useEffect, useState } from "react";
import { LuCheck, LuPlus, LuTrash2, LuChevronUp, LuChevronDown, LuShieldCheck, LuScale, LuFileCheck, LuFileQuestion } from "react-icons/lu";
import {
  LegalPageConfig,
  LegalSection,
  FaqConfig,
  FaqItem,
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_REFUND_POLICY,
  DEFAULT_TERMS_OF_USE,
  DEFAULT_FAQ_CONFIG,
  PRIVACY_POLICY_KEY,
  REFUND_POLICY_KEY,
  TERMS_OF_USE_KEY,
  FAQ_KEY,
} from "@/lib/legalPages";

type Tab = "privacy" | "refund" | "terms" | "faq";

const emptySection: LegalSection = { headingEn: "", headingAr: "", bodyEn: "", bodyAr: "" };
const emptyFaqItem: FaqItem = { questionEn: "", questionAr: "", answerEn: "", answerAr: "" };

export default function LegalPagesAdminPage() {
  const [tab, setTab] = useState<Tab>("privacy");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [privacy, setPrivacy] = useState<LegalPageConfig>(DEFAULT_PRIVACY_POLICY);
  const [refund, setRefund] = useState<LegalPageConfig>(DEFAULT_REFUND_POLICY);
  const [terms, setTerms] = useState<LegalPageConfig>(DEFAULT_TERMS_OF_USE);
  const [faq, setFaq] = useState<FaqConfig>(DEFAULT_FAQ_CONFIG);

  useEffect(() => {
    Promise.all([
      fetch("/api/privacy-policy").then((r) => r.json()),
      fetch("/api/refund-policy").then((r) => r.json()),
      fetch("/api/terms-of-use").then((r) => r.json()),
      fetch("/api/faq").then((r) => r.json()),
    ])
      .then(([p, r, t, f]) => {
        if (p.success) setPrivacy(p.data);
        if (r.success) setRefund(r.data);
        if (t.success) setTerms(t.data);
        if (f.success) setFaq(f.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [PRIVACY_POLICY_KEY]: privacy,
          [REFUND_POLICY_KEY]: refund,
          [TERMS_OF_USE_KEY]: terms,
          [FAQ_KEY]: faq,
        }),
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

  const tabs: { key: Tab; label: string; icon: typeof LuShieldCheck }[] = [
    { key: "privacy", label: "Privacy Policy", icon: LuShieldCheck },
    { key: "refund", label: "Refund Policy", icon: LuScale },
    { key: "terms", label: "Terms of Use", icon: LuFileCheck },
    { key: "faq", label: "FAQ", icon: LuFileQuestion },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm text-slate-500">
        Content for the public policy pages, also linked from the site footer (Privacy Policy, Refund Policy, Terms of Use, FAQ).
      </p>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "privacy" && <LegalPageEditor config={privacy} onChange={setPrivacy} />}
      {tab === "refund" && <LegalPageEditor config={refund} onChange={setRefund} />}
      {tab === "terms" && <LegalPageEditor config={terms} onChange={setTerms} />}
      {tab === "faq" && <FaqEditor config={faq} onChange={setFaq} />}

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

function LegalPageEditor({
  config,
  onChange,
}: {
  config: LegalPageConfig;
  onChange: (c: LegalPageConfig) => void;
}) {
  const updateSection = (i: number, patch: Partial<LegalSection>) =>
    onChange({ ...config, sections: config.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addSection = () => onChange({ ...config, sections: [...config.sections, { ...emptySection }] });
  const removeSection = (i: number) => onChange({ ...config, sections: config.sections.filter((_, idx) => idx !== i) });
  const moveSection = (i: number, dir: -1 | 1) => {
    const next = [...config.sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...config, sections: next });
  };

  return (
    <div className="space-y-5">
      <div className="admin-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Page Title (English)" value={config.titleEn} onChange={(v) => onChange({ ...config, titleEn: v })} />
        <Field label="Page Title (Arabic)" rtl value={config.titleAr} onChange={(v) => onChange({ ...config, titleAr: v })} />
        <TextArea label="Intro Paragraph (English)" value={config.introEn} onChange={(v) => onChange({ ...config, introEn: v })} />
        <TextArea label="Intro Paragraph (Arabic)" rtl value={config.introAr} onChange={(v) => onChange({ ...config, introAr: v })} />
      </div>

      {config.sections.map((section, i) => (
        <div key={i} className="admin-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">Section {i + 1}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
              <button onClick={() => moveSection(i, 1)} disabled={i === config.sections.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
              <button onClick={() => removeSection(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove section"><LuTrash2 size={16} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Heading (English)" value={section.headingEn} onChange={(v) => updateSection(i, { headingEn: v })} />
            <Field label="Heading (Arabic)" rtl value={section.headingAr} onChange={(v) => updateSection(i, { headingAr: v })} />
            <TextArea label="Body (English)" rows={6} value={section.bodyEn} onChange={(v) => updateSection(i, { bodyEn: v })} hint={'Start a line with "- " to render it as a bullet point.'} />
            <TextArea label="Body (Arabic)" rtl rows={6} value={section.bodyAr} onChange={(v) => updateSection(i, { bodyAr: v })} hint={'ابدئي السطر بـ "- " لعرضه كنقطة.'} />
          </div>
        </div>
      ))}

      <button onClick={addSection} className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
        <LuPlus size={18} /> Add Section
      </button>
    </div>
  );
}

function FaqEditor({ config, onChange }: { config: FaqConfig; onChange: (c: FaqConfig) => void }) {
  const updateItem = (i: number, patch: Partial<FaqItem>) =>
    onChange({ ...config, items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const addItem = () => onChange({ ...config, items: [...config.items, { ...emptyFaqItem }] });
  const removeItem = (i: number) => onChange({ ...config, items: config.items.filter((_, idx) => idx !== i) });
  const moveItem = (i: number, dir: -1 | 1) => {
    const next = [...config.items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...config, items: next });
  };

  return (
    <div className="space-y-5">
      <div className="admin-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Page Title (English)" value={config.titleEn} onChange={(v) => onChange({ ...config, titleEn: v })} />
        <Field label="Page Title (Arabic)" rtl value={config.titleAr} onChange={(v) => onChange({ ...config, titleAr: v })} />
        <TextArea label="Intro (English)" value={config.introEn} onChange={(v) => onChange({ ...config, introEn: v })} />
        <TextArea label="Intro (Arabic)" rtl value={config.introAr} onChange={(v) => onChange({ ...config, introAr: v })} />
      </div>

      {config.items.map((item, i) => (
        <div key={i} className="admin-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">Question {i + 1}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
              <button onClick={() => moveItem(i, 1)} disabled={i === config.items.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
              <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove"><LuTrash2 size={16} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Question (English)" value={item.questionEn} onChange={(v) => updateItem(i, { questionEn: v })} />
            <Field label="Question (Arabic)" rtl value={item.questionAr} onChange={(v) => updateItem(i, { questionAr: v })} />
            <TextArea label="Answer (English)" value={item.answerEn} onChange={(v) => updateItem(i, { answerEn: v })} />
            <TextArea label="Answer (Arabic)" rtl value={item.answerAr} onChange={(v) => updateItem(i, { answerAr: v })} />
          </div>
        </div>
      ))}

      <button onClick={addItem} className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
        <LuPlus size={18} /> Add Question
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rtl,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rtl?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input className="admin-input" dir={rtl ? "rtl" : "ltr"} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rtl,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rtl?: boolean;
  rows?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <textarea className="admin-input" rows={rows} dir={rtl ? "rtl" : "ltr"} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
