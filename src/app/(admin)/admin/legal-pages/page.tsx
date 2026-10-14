"use client";
import { useEffect, useMemo, useState } from "react";
import { LuCheck, LuPlus, LuTrash2, LuChevronUp, LuChevronDown, LuShieldCheck, LuScale, LuFileCheck, LuFileQuestion, LuExternalLink } from "react-icons/lu";
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
  // Snapshot of what's saved, to show an "unsaved changes" state.
  const [baseline, setBaseline] = useState("");
  const snapshot = useMemo(() => JSON.stringify([privacy, refund, terms, faq]), [privacy, refund, terms, faq]);
  useEffect(() => {
    if (!loading && !baseline) setBaseline(snapshot);
  }, [loading, baseline, snapshot]);
  const dirty = !!baseline && baseline !== snapshot;

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
        setBaseline(snapshot);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="spinner" /></div>;

  const tabs: { key: Tab; label: string; icon: typeof LuShieldCheck; href: string }[] = [
    { key: "privacy", label: "Privacy Policy", icon: LuShieldCheck, href: "/privacy-policy" },
    { key: "refund", label: "Refund Policy", icon: LuScale, href: "/refund-policy" },
    { key: "terms", label: "Terms of Use", icon: LuFileCheck, href: "/terms-of-use" },
    { key: "faq", label: "FAQ", icon: LuFileQuestion, href: "/faq" },
  ];

  return (
    <div className="w-full grid lg:grid-cols-[260px_1fr] gap-5 items-start pb-20">
      <aside className="lg:sticky lg:top-0 space-y-3">
        <nav className="admin-card p-2 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-start transition ${on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Icon size={17} className={on ? "text-white" : "text-slate-400"} /> {t.label}
              </button>
            );
          })}
        </nav>
        <p className="hidden lg:block text-xs text-slate-400 px-2">These pages are linked from the store footer. Write in both languages — shoppers see the one matching their language.</p>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{tabs.find((t) => t.key === tab)?.label}</h1>
          <a href={tabs.find((t) => t.key === tab)?.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
            View live page <LuExternalLink size={14} />
          </a>
        </div>
        {tab === "privacy" && <LegalPageEditor key="privacy" config={privacy} onChange={setPrivacy} />}
        {tab === "refund" && <LegalPageEditor key="refund" config={refund} onChange={setRefund} />}
        {tab === "terms" && <LegalPageEditor key="terms" config={terms} onChange={setTerms} />}
        {tab === "faq" && <FaqEditor config={faq} onChange={setFaq} />}
      </section>

      {(dirty || saved) && (
        <div className="fixed bottom-5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl bg-slate-900 text-white ps-5 pe-2 py-2 shadow-2xl">
          {saved && !dirty ? (
            <span className="text-sm flex items-center gap-1.5 pe-3"><LuCheck size={16} /> Saved — live on the store</span>
          ) : (
            <>
              <span className="text-sm">Unsaved changes</span>
              <button onClick={save} disabled={saving} className="rounded-xl bg-white text-slate-900 px-4 py-1.5 text-sm font-semibold disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      )}
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
  const [open, setOpen] = useState(0);
  const addSection = () => {
    onChange({ ...config, sections: [...config.sections, { ...emptySection }] });
    setOpen(config.sections.length);
  };
  const removeSection = (i: number) => onChange({ ...config, sections: config.sections.filter((_, idx) => idx !== i) });
  const moveSection = (i: number, dir: -1 | 1) => {
    const next = [...config.sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...config, sections: next });
  };

  return (
    <div className="space-y-4">
      <div className="admin-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Page Title (English)" value={config.titleEn} onChange={(v) => onChange({ ...config, titleEn: v })} />
        <Field label="Page Title (Arabic)" rtl value={config.titleAr} onChange={(v) => onChange({ ...config, titleAr: v })} />
        <TextArea label="Intro Paragraph (English)" value={config.introEn} onChange={(v) => onChange({ ...config, introEn: v })} />
        <TextArea label="Intro Paragraph (Arabic)" rtl value={config.introAr} onChange={(v) => onChange({ ...config, introAr: v })} />
      </div>

      {config.sections.map((section, i) => (
        <div key={i} className="admin-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === i ? -1 : i)}>
            <div className="min-w-0 flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="min-w-0">
                <span className="block font-medium text-slate-800 truncate">{section.headingEn || "Untitled section"}</span>
                <span className="block text-xs text-slate-400 truncate" dir="rtl">{section.headingAr}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
              <button onClick={() => moveSection(i, 1)} disabled={i === config.sections.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
              <button onClick={() => removeSection(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove section"><LuTrash2 size={16} /></button>
            </div>
          </div>

          {open === i && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5 pt-1 border-t border-slate-100">
            <Field label="Heading (English)" value={section.headingEn} onChange={(v) => updateSection(i, { headingEn: v })} />
            <Field label="Heading (Arabic)" rtl value={section.headingAr} onChange={(v) => updateSection(i, { headingAr: v })} />
            <TextArea label="Body (English)" rows={6} value={section.bodyEn} onChange={(v) => updateSection(i, { bodyEn: v })} hint={'Start a line with "- " to render it as a bullet point.'} />
            <TextArea label="Body (Arabic)" rtl rows={6} value={section.bodyAr} onChange={(v) => updateSection(i, { bodyAr: v })} hint={'ابدئي السطر بـ "- " لعرضه كنقطة.'} />
          </div>}
        </div>
      ))}

      <button onClick={addSection} className="flex items-center gap-2 w-full justify-center py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800 transition-colors">
        <LuPlus size={18} /> Add Section
      </button>
    </div>
  );
}

function FaqEditor({ config, onChange }: { config: FaqConfig; onChange: (c: FaqConfig) => void }) {
  const updateItem = (i: number, patch: Partial<FaqItem>) =>
    onChange({ ...config, items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const [open, setOpen] = useState(0);
  const addItem = () => {
    onChange({ ...config, items: [...config.items, { ...emptyFaqItem }] });
    setOpen(config.items.length);
  };
  const removeItem = (i: number) => onChange({ ...config, items: config.items.filter((_, idx) => idx !== i) });
  const moveItem = (i: number, dir: -1 | 1) => {
    const next = [...config.items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...config, items: next });
  };

  return (
    <div className="space-y-4">
      <div className="admin-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Page Title (English)" value={config.titleEn} onChange={(v) => onChange({ ...config, titleEn: v })} />
        <Field label="Page Title (Arabic)" rtl value={config.titleAr} onChange={(v) => onChange({ ...config, titleAr: v })} />
        <TextArea label="Intro (English)" value={config.introEn} onChange={(v) => onChange({ ...config, introEn: v })} />
        <TextArea label="Intro (Arabic)" rtl value={config.introAr} onChange={(v) => onChange({ ...config, introAr: v })} />
      </div>

      {config.items.map((item, i) => (
        <div key={i} className="admin-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === i ? -1 : i)}>
            <div className="min-w-0 flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center shrink-0">Q{i + 1}</span>
              <span className="min-w-0">
                <span className="block font-medium text-slate-800 truncate">{item.questionEn || "New question"}</span>
                <span className="block text-xs text-slate-400 truncate" dir="rtl">{item.questionAr}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
              <button onClick={() => moveItem(i, 1)} disabled={i === config.items.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
              <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove"><LuTrash2 size={16} /></button>
            </div>
          </div>

          {open === i && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5 pt-1 border-t border-slate-100">
            <Field label="Question (English)" value={item.questionEn} onChange={(v) => updateItem(i, { questionEn: v })} />
            <Field label="Question (Arabic)" rtl value={item.questionAr} onChange={(v) => updateItem(i, { questionAr: v })} />
            <TextArea label="Answer (English)" value={item.answerEn} onChange={(v) => updateItem(i, { answerEn: v })} />
            <TextArea label="Answer (Arabic)" rtl value={item.answerAr} onChange={(v) => updateItem(i, { answerAr: v })} />
          </div>}
        </div>
      ))}

      <button onClick={addItem} className="flex items-center gap-2 w-full justify-center py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800 transition-colors">
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
