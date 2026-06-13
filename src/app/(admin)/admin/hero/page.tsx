"use client";
import { useEffect, useState } from "react";
import {
  LuCheck,
  LuPlus,
  LuTrash2,
  LuImagePlus,
  LuChevronUp,
  LuChevronDown,
  LuLayoutPanelTop,
  LuLayoutGrid,
} from "react-icons/lu";
import {
  HeroSlide,
  HeroFeatureItem,
  DEFAULT_HERO_SLIDES,
  DEFAULT_HERO_FEATURES,
  HERO_SLIDES_KEY,
  HERO_FEATURES_KEY,
} from "@/lib/hero";

const emptySlide: HeroSlide = {
  image: "",
  badgeEn: "",
  badgeAr: "",
  titleEn: "",
  titleAr: "",
  ctaEn: "",
  ctaAr: "",
  href: "/shop",
};

const emptyFeature: HeroFeatureItem = {
  image: "",
  titleEn: "",
  titleAr: "",
  descEn: "",
  descAr: "",
};

type Tab = "slides" | "features";

export default function HeroAdminPage() {
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_HERO_SLIDES);
  const [features, setFeatures] = useState<HeroFeatureItem[]>(DEFAULT_HERO_FEATURES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("slides");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hero")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          if (Array.isArray(d.data.slides) && d.data.slides.length) setSlides(d.data.slides);
          if (Array.isArray(d.data.features) && d.data.features.length) setFeatures(d.data.features);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const upload = async (files: FileList | null, key: string, apply: (url: string) => void) => {
    if (!files || files.length === 0) return;
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) apply(data.data.url);
    } finally {
      setUploadingKey(null);
    }
  };

  // ── Slide helpers ──
  const updateSlide = (i: number, patch: Partial<HeroSlide>) =>
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSlide = () => setSlides((prev) => [...prev, { ...emptySlide }]);
  const removeSlide = (i: number) => setSlides((prev) => prev.filter((_, idx) => idx !== i));
  const moveSlide = (i: number, dir: -1 | 1) =>
    setSlides((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // ── Feature helpers ──
  const updateFeature = (i: number, patch: Partial<HeroFeatureItem>) =>
    setFeatures((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const addFeature = () => setFeatures((prev) => [...prev, { ...emptyFeature }]);
  const removeFeature = (i: number) => setFeatures((prev) => prev.filter((_, idx) => idx !== i));
  const moveFeature = (i: number, dir: -1 | 1) =>
    setFeatures((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [HERO_SLIDES_KEY]: slides,
          [HERO_FEATURES_KEY]: features,
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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab("slides")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "slides" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <LuLayoutPanelTop size={16} /> Slides
          <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs bg-black/10">{slides.length}</span>
        </button>
        <button
          onClick={() => setTab("features")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "features" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <LuLayoutGrid size={16} /> Feature Boxes
          <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs bg-black/10">{features.length}</span>
        </button>
      </div>

      {/* ── SLIDES ── */}
      {tab === "slides" && (
        <div className="space-y-5">
          {slides.map((slide, i) => (
            <div key={i} className="admin-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Slide {i + 1}</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveSlide(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
                  <button onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
                  <button onClick={() => removeSlide(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove slide"><LuTrash2 size={16} /></button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-5">
                {/* Image */}
                <div className="flex-shrink-0">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Image</label>
                  {slide.image ? (
                    <div className="relative w-28 h-28 rounded-full overflow-hidden border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slide.image} alt="slide" className="w-full h-full object-cover" />
                      <button onClick={() => updateSlide(i, { image: "" })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">×</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-28 h-28 rounded-full border-2 border-dashed border-slate-300 text-slate-400 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 text-xs">
                      {uploadingKey === `slide-${i}` ? <span className="spinner" /> : (<><LuImagePlus size={20} /><span className="mt-0.5">Upload</span></>)}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files, `slide-${i}`, (url) => updateSlide(i, { image: url }))} disabled={uploadingKey === `slide-${i}`} />
                    </label>
                  )}
                </div>

                {/* Fields */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Badge (English)" value={slide.badgeEn} onChange={(v) => updateSlide(i, { badgeEn: v })} />
                  <Field label="Badge (Arabic)" rtl value={slide.badgeAr} onChange={(v) => updateSlide(i, { badgeAr: v })} />
                  <Field label="Title (English)" value={slide.titleEn} onChange={(v) => updateSlide(i, { titleEn: v })} />
                  <Field label="Title (Arabic)" rtl value={slide.titleAr} onChange={(v) => updateSlide(i, { titleAr: v })} />
                  <Field label="Button Text (English)" value={slide.ctaEn} onChange={(v) => updateSlide(i, { ctaEn: v })} />
                  <Field label="Button Text (Arabic)" rtl value={slide.ctaAr} onChange={(v) => updateSlide(i, { ctaAr: v })} />
                  <div className="sm:col-span-2">
                    <Field label="Button Link" value={slide.href} onChange={(v) => updateSlide(i, { href: v })} placeholder="/shop" />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button onClick={addSlide} className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
            <LuPlus size={18} /> Add Slide
          </button>
        </div>
      )}

      {/* ── FEATURES ── */}
      {tab === "features" && (
        <div className="space-y-5">
          {features.map((feature, i) => (
            <div key={i} className="admin-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Box {i + 1}</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveFeature(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
                  <button onClick={() => moveFeature(i, 1)} disabled={i === features.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
                  <button onClick={() => removeFeature(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove box"><LuTrash2 size={16} /></button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-5">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Icon</label>
                  {feature.image ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-[#F7EDE7] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={feature.image} alt="icon" className="w-10 h-10 object-contain" />
                      <button onClick={() => updateFeature(i, { image: "" })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">×</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 text-xs">
                      {uploadingKey === `feature-${i}` ? <span className="spinner" /> : (<><LuImagePlus size={18} /><span className="mt-0.5">Icon</span></>)}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files, `feature-${i}`, (url) => updateFeature(i, { image: url }))} disabled={uploadingKey === `feature-${i}`} />
                    </label>
                  )}
                </div>

                {/* Fields */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Title (English)" value={feature.titleEn} onChange={(v) => updateFeature(i, { titleEn: v })} />
                  <Field label="Title (Arabic)" rtl value={feature.titleAr} onChange={(v) => updateFeature(i, { titleAr: v })} />
                  <Field label="Description (English)" value={feature.descEn} onChange={(v) => updateFeature(i, { descEn: v })} />
                  <Field label="Description (Arabic)" rtl value={feature.descAr} onChange={(v) => updateFeature(i, { descAr: v })} />
                </div>
              </div>
            </div>
          ))}

          <button onClick={addFeature} className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
            <LuPlus size={18} /> Add Feature Box
          </button>
        </div>
      )}

      {/* Save bar */}
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
