"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuCopy,
  LuEye,
  LuImagePlus,
  LuLayoutGrid,
  LuLayoutPanelTop,
  LuPalette,
  LuPlus,
  LuSmartphone,
  LuTrash2,
} from "react-icons/lu";
import HeroView from "@/components/Home/Hero/HeroView";
import {
  DEFAULT_HERO_FEATURES,
  DEFAULT_HERO_SETTINGS,
  DEFAULT_HERO_SLIDES,
  EMPTY_HERO_SLIDE,
  HERO_FEATURES_KEY,
  HERO_SETTINGS_KEY,
  HERO_SLIDES_KEY,
  HeroFeatureItem,
  HeroSettings,
  HeroSlide,
  normalizeFeatures,
  normalizeSettings,
  normalizeSlides,
} from "@/lib/hero";

const emptyFeature: HeroFeatureItem = { image: "", titleEn: "", titleAr: "", descEn: "", descAr: "" };

type Tab = "slides" | "design" | "features";

export default function HeroAdminPage() {
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_HERO_SLIDES);
  const [features, setFeatures] = useState<HeroFeatureItem[]>(DEFAULT_HERO_FEATURES);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("slides");
  const [open, setOpen] = useState(0);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"en" | "ar">("en");

  useEffect(() => {
    fetch("/api/hero", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSlides(normalizeSlides(d.data.slides));
          setFeatures(normalizeFeatures(d.data.features));
          setSettings(normalizeSettings(d.data.settings));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const upload = async (files: FileList | null, key: string, apply: (url: string) => void) => {
    if (!files || files.length === 0) return;
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        apply(data.data.url);
        setDirty(true);
      } else setError(data.error || "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const updateSlide = (i: number, patch: Partial<HeroSlide>) => {
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setDirty(true);
  };
  const move = <T,>(list: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };
  const updateFeature = (i: number, patch: Partial<HeroFeatureItem>) => {
    setFeatures((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    setDirty(true);
  };
  const set = <K extends keyof HeroSettings>(k: K, v: HeroSettings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [HERO_SLIDES_KEY]: slides, [HERO_FEATURES_KEY]: features, [HERO_SETTINGS_KEY]: settings }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedAt(Date.now());
        setDirty(false);
      } else setError(data.error || "Could not save");
    } catch {
      setError("Could not save");
    } finally {
      setSaving(false);
    }
  };

  const previewConfig = useMemo(
    () => ({ slides: slides.filter((s) => s.titleEn || s.titleAr || s.image), features, settings }),
    [slides, features, settings],
  );

  if (loading) return <div className="flex justify-center py-12"><div className="spinner" /></div>;

  return (
    <div className="space-y-5 pb-20">
      {/* Live preview */}
      <section className="admin-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><LuEye size={16} /> Live preview</span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {(["en", "ar"] as const).map((l) => (
              <button key={l} onClick={() => setPreviewLang(l)} className={`px-3 py-1 rounded-md font-medium ${previewLang === l ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
                {l === "en" ? "English · LTR" : "العربية · RTL"}
              </button>
            ))}
          </div>
        </div>
        <ScaledPreview>
          {previewConfig.slides.length > 0 ? (
            <HeroView config={previewConfig} isArabic={previewLang === "ar"} preview />
          ) : (
            <div className="h-[460px] flex items-center justify-center text-slate-400">Add a slide to see the preview</div>
          )}
        </ScaledPreview>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          ["slides", "Slides", LuLayoutPanelTop, slides.length],
          ["design", "Design & behaviour", LuPalette, null],
          ["features", "Feature boxes", LuLayoutGrid, features.length],
        ] as [Tab, string, React.ElementType, number | null][]).map(([id, label, Icon, count]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Icon size={16} /> {label}
            {count !== null && <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs bg-black/10">{count}</span>}
          </button>
        ))}
      </div>

      {/* ── SLIDES ── */}
      {tab === "slides" && (
        <div className="space-y-3">
          {slides.map((slide, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="admin-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => setOpen(isOpen ? -1 : i)}>
                  <div className="w-12 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {slide.image && <img src={slide.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">{slide.titleEn || slide.titleAr || `Slide ${i + 1}`}</p>
                    <p className="text-xs text-slate-400 truncate" dir="rtl">{slide.titleAr}</p>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <IconBtn title="Move up" disabled={i === 0} onClick={() => { setSlides((p) => move(p, i, -1)); setOpen(i - 1); setDirty(true); }}><LuChevronUp size={16} /></IconBtn>
                    <IconBtn title="Move down" disabled={i === slides.length - 1} onClick={() => { setSlides((p) => move(p, i, 1)); setOpen(i + 1); setDirty(true); }}><LuChevronDown size={16} /></IconBtn>
                    <IconBtn title="Duplicate" onClick={() => { setSlides((p) => [...p.slice(0, i + 1), { ...p[i] }, ...p.slice(i + 1)]); setOpen(i + 1); setDirty(true); }}><LuCopy size={15} /></IconBtn>
                    <IconBtn title="Remove" danger onClick={() => { if (confirm("Remove this slide?")) { setSlides((p) => p.filter((_, idx) => idx !== i)); setDirty(true); } }}><LuTrash2 size={15} /></IconBtn>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 p-5 space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <ImageField
                        label="Photo (desktop)"
                        hint="Portrait works best · ~1200×1500"
                        url={slide.image}
                        uploading={uploadingKey === `s${i}`}
                        onFile={(f) => upload(f, `s${i}`, (url) => updateSlide(i, { image: url }))}
                        onClear={() => updateSlide(i, { image: "" })}
                      />
                      <ImageField
                        label="Photo (mobile, optional)"
                        hint="Used on phones if set"
                        icon={<LuSmartphone size={18} />}
                        url={slide.mobileImage}
                        uploading={uploadingKey === `m${i}`}
                        onFile={(f) => upload(f, `m${i}`, (url) => updateSlide(i, { mobileImage: url }))}
                        onClear={() => updateSlide(i, { mobileImage: "" })}
                      />
                    </div>

                    <Pair label="Headline" en={slide.titleEn} ar={slide.titleAr} onEn={(v) => updateSlide(i, { titleEn: v })} onAr={(v) => updateSlide(i, { titleAr: v })} />
                    <Pair label="Sub-headline" multiline en={slide.subtitleEn} ar={slide.subtitleAr} onEn={(v) => updateSlide(i, { subtitleEn: v })} onAr={(v) => updateSlide(i, { subtitleAr: v })} />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Main button</p>
                        <Pair compact label="Text" en={slide.ctaEn} ar={slide.ctaAr} onEn={(v) => updateSlide(i, { ctaEn: v })} onAr={(v) => updateSlide(i, { ctaAr: v })} />
                        <Field label="Link" value={slide.href} placeholder="/shop" onChange={(v) => updateSlide(i, { href: v })} />
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Second button <span className="font-normal text-slate-400">(optional)</span></p>
                        <Pair compact label="Text" en={slide.cta2En} ar={slide.cta2Ar} onEn={(v) => updateSlide(i, { cta2En: v })} onAr={(v) => updateSlide(i, { cta2Ar: v })} />
                        <Field label="Link" value={slide.href2} placeholder="/shop?category=…" onChange={(v) => updateSlide(i, { href2: v })} />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Photo side</label>
                        <Segmented
                          value={slide.imageSide}
                          options={[["end", "After the text"], ["start", "Before the text"]]}
                          onChange={(v) => updateSlide(i, { imageSide: v as HeroSlide["imageSide"] })}
                        />
                        <p className="text-xs text-slate-400 mt-1">Mirrors automatically in Arabic (RTL).</p>
                      </div>
                      <ColorField
                        label="Slide accent colour"
                        value={slide.accent}
                        allowEmpty
                        emptyLabel="Use global accent"
                        onChange={(v) => updateSlide(i, { accent: v })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => { setSlides((p) => [...p, { ...EMPTY_HERO_SLIDE }]); setOpen(slides.length); setDirty(true); }}
            className="flex items-center gap-2 w-full justify-center py-3.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            <LuPlus size={18} /> Add slide
          </button>
        </div>
      )}

      {/* ── DESIGN ── */}
      {tab === "design" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="admin-card p-5 space-y-5">
            <h3 className="font-semibold text-slate-800">Layout</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["split", "Split", "Text + framed photo"],
                ["fullbleed", "Full-bleed", "Photo fills the hero"],
                ["centered", "Centered", "Text only, centred"],
              ] as const).map(([v, label, desc]) => (
                <button
                  key={v}
                  onClick={() => set("layout", v)}
                  className={`text-start rounded-xl border-2 p-3 transition-colors ${settings.layout === v ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <LayoutThumb kind={v} />
                  <p className="text-sm font-medium text-slate-800 mt-2">{label}</p>
                  <p className="text-[11px] text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Height</label>
              <Segmented value={settings.height} options={[["md", "Compact"], ["lg", "Tall"], ["screen", "Full screen"]]} onChange={(v) => set("height", v as HeroSettings["height"])} />
            </div>
            {settings.layout === "fullbleed" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Photo darkening: {settings.overlay}%</label>
                <input type="range" min={0} max={80} value={settings.overlay} onChange={(e) => set("overlay", Number(e.target.value))} className="w-full accent-indigo-600" />
              </div>
            )}
          </div>

          <div className="admin-card p-5 space-y-5">
            <h3 className="font-semibold text-slate-800">Colours &amp; 3D background</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <ColorField label="Accent (buttons, badge)" value={settings.accent} onChange={(v) => set("accent", v || DEFAULT_HERO_SETTINGS.accent)} />
              <ColorField label="Background" value={settings.background} onChange={(v) => set("background", v || DEFAULT_HERO_SETTINGS.background)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Animated background (Three.js)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ["particles", "Floating petals"],
                  ["silk", "Silk waves"],
                  ["aurora", "Soft light"],
                  ["none", "None"],
                ] as const).map(([v, label]) => (
                  <button key={v} onClick={() => set("effect", v)} className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium ${settings.effect === v ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Pauses off-screen and for visitors who prefer reduced motion.</p>
            </div>
          </div>

          <div className="admin-card p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">Slideshow</h3>
            <Toggle label="Auto-play" checked={settings.autoplay} onChange={(v) => set("autoplay", v)} />
            {settings.autoplay && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time per slide: {(settings.intervalMs / 1000).toFixed(1)}s</label>
                <input type="range" min={2500} max={15000} step={500} value={settings.intervalMs} onChange={(e) => set("intervalMs", Number(e.target.value))} className="w-full accent-indigo-600" />
              </div>
            )}
            <Toggle label="Show arrows (desktop)" checked={settings.showArrows} onChange={(v) => set("showArrows", v)} />
          </div>

          <div className="admin-card p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">Extras</h3>
            <Toggle label="Customer rating line" checked={settings.showSocialProof} onChange={(v) => set("showSocialProof", v)} />
            {settings.showSocialProof && (
              <Pair compact label="Rating text" en={settings.socialProofEn} ar={settings.socialProofAr} onEn={(v) => set("socialProofEn", v)} onAr={(v) => set("socialProofAr", v)} />
            )}
            <Toggle label="Feature boxes under the hero" checked={settings.showFeatures} onChange={(v) => set("showFeatures", v)} />
          </div>
        </div>
      )}

      {/* ── FEATURES ── */}
      {tab === "features" && (
        <div className="space-y-4">
          {!settings.showFeatures && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 text-amber-800 px-4 py-3 text-sm flex items-center justify-between gap-3">
              Feature boxes are currently hidden on the storefront.
              <button onClick={() => set("showFeatures", true)} className="font-medium underline shrink-0">Show them</button>
            </div>
          )}
          {features.map((feature, i) => (
            <div key={i} className="admin-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Box {i + 1}</h3>
                <div className="flex items-center gap-1">
                  <IconBtn title="Move up" disabled={i === 0} onClick={() => { setFeatures((p) => move(p, i, -1)); setDirty(true); }}><LuChevronUp size={16} /></IconBtn>
                  <IconBtn title="Move down" disabled={i === features.length - 1} onClick={() => { setFeatures((p) => move(p, i, 1)); setDirty(true); }}><LuChevronDown size={16} /></IconBtn>
                  <IconBtn title="Remove" danger onClick={() => { setFeatures((p) => p.filter((_, idx) => idx !== i)); setDirty(true); }}><LuTrash2 size={15} /></IconBtn>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-5">
                <ImageField
                  small
                  label="Icon"
                  url={feature.image}
                  uploading={uploadingKey === `f${i}`}
                  onFile={(f) => upload(f, `f${i}`, (url) => updateFeature(i, { image: url }))}
                  onClear={() => updateFeature(i, { image: "" })}
                />
                <div className="flex-1 space-y-3">
                  <Pair compact label="Title" en={feature.titleEn} ar={feature.titleAr} onEn={(v) => updateFeature(i, { titleEn: v })} onAr={(v) => updateFeature(i, { titleAr: v })} />
                  <Pair compact label="Description" en={feature.descEn} ar={feature.descAr} onEn={(v) => updateFeature(i, { descEn: v })} onAr={(v) => updateFeature(i, { descAr: v })} />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => { setFeatures((p) => [...p, { ...emptyFeature }]); setDirty(true); }}
            className="flex items-center gap-2 w-full justify-center py-3.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            <LuPlus size={18} /> Add feature box
          </button>
        </div>
      )}

      {/* Save bar */}
      <div className="fixed bottom-0 inset-x-0 lg:start-64 z-30 bg-white/90 backdrop-blur border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button onClick={save} disabled={saving || !dirty} className="admin-btn admin-btn-primary px-8 disabled:opacity-50">
          {saving ? "Saving..." : "Publish changes"}
        </button>
        {dirty ? (
          <span className="text-sm text-amber-600">Unsaved changes</span>
        ) : savedAt ? (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1"><LuCheck size={16} /> Live on the store</span>
        ) : null}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </div>
  );
}

/** Renders the real hero at desktop width (1280px) scaled to fit the card. */
function ScaledPreview({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(300);
  const BASE = 1280;

  useEffect(() => {
    const update = () => {
      const w = wrap.current?.clientWidth ?? BASE;
      const s = Math.min(1, w / BASE);
      setScale(s);
      setHeight((inner.current?.scrollHeight ?? 500) * s);
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrap.current) ro.observe(wrap.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} className="relative w-full overflow-hidden bg-slate-50" style={{ height }}>
      <div ref={inner} style={{ width: BASE, transform: `scale(${scale})`, transformOrigin: "top left" }} className="absolute top-0 left-0">
        {children}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, disabled, danger, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; title: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={title} className={`p-1.5 rounded-lg disabled:opacity-30 ${danger ? "text-rose-500 hover:bg-rose-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, rtl }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rtl?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input className="admin-input" dir={rtl ? "rtl" : "ltr"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** English + Arabic inputs side by side. */
function Pair({
  label,
  en,
  ar,
  onEn,
  onAr,
  multiline,
  compact,
}: {
  label: string;
  en: string;
  ar: string;
  onEn: (v: string) => void;
  onAr: (v: string) => void;
  multiline?: boolean;
  compact?: boolean;
}) {
  const Input = multiline ? "textarea" : "input";
  return (
    <div>
      {!compact && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          {compact && <label className="block text-xs font-medium text-slate-500 mb-1">{label} · English</label>}
          <Input className="admin-input" rows={multiline ? 2 : undefined} placeholder={compact ? "" : "English"} value={en} onChange={(e) => onEn(e.target.value)} />
        </div>
        <div>
          {compact && <label className="block text-xs font-medium text-slate-500 mb-1 text-end">العربية · {label}</label>}
          <Input className="admin-input" dir="rtl" rows={multiline ? 2 : undefined} placeholder={compact ? "" : "العربية"} value={ar} onChange={(e) => onAr(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function ImageField({
  label,
  hint,
  url,
  uploading,
  onFile,
  onClear,
  small,
  icon,
}: {
  label: string;
  hint?: string;
  url: string;
  uploading: boolean;
  onFile: (f: FileList | null) => void;
  onClear: () => void;
  small?: boolean;
  icon?: React.ReactNode;
}) {
  const size = small ? "w-20 h-20" : "w-full h-40";
  return (
    <div className={small ? "shrink-0" : ""}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {url ? (
        <div className={`relative ${size} rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className={`w-full h-full ${small ? "object-contain p-3" : "object-cover object-top"}`} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <label className="px-3 py-1.5 rounded-lg bg-white text-xs font-medium cursor-pointer">
              Replace
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files)} />
            </label>
            <button onClick={onClear} className="px-3 py-1.5 rounded-lg bg-white text-xs font-medium text-rose-600">Remove</button>
          </div>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center ${size} rounded-xl border-2 border-dashed border-slate-300 text-slate-400 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 text-xs gap-1`}>
          {uploading ? <span className="spinner" /> : <>{icon ?? <LuImagePlus size={20} />}<span>Upload</span></>}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => onFile(e.target.files)} />
        </label>
      )}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange, allowEmpty, emptyLabel }: { label: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean; emptyLabel?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || "#8C3B49"} onChange={(e) => onChange(e.target.value)} className="w-11 h-10 rounded-lg border border-slate-200 p-1 bg-white cursor-pointer" />
        <input className="admin-input font-mono" value={value} placeholder={emptyLabel} onChange={(e) => onChange(e.target.value.trim())} maxLength={7} />
        {allowEmpty && value && (
          <button onClick={() => onChange("")} className="text-xs text-slate-500 hover:text-slate-800 whitespace-nowrap">Reset</button>
        )}
      </div>
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm flex-wrap">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`px-3.5 py-1.5 rounded-lg font-medium ${value === v ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-indigo-600" : "bg-slate-200"}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function LayoutThumb({ kind }: { kind: "split" | "fullbleed" | "centered" }) {
  return (
    <div className={`h-12 rounded-lg overflow-hidden flex items-center gap-1.5 p-1.5 ${kind === "fullbleed" ? "bg-slate-500" : "bg-slate-100"}`}>
      {kind !== "centered" && (
        <div className="flex-1 space-y-1">
          <div className={`h-1.5 w-3/4 rounded ${kind === "fullbleed" ? "bg-white" : "bg-slate-400"}`} />
          <div className={`h-1.5 w-1/2 rounded ${kind === "fullbleed" ? "bg-white/70" : "bg-slate-300"}`} />
        </div>
      )}
      {kind === "centered" && (
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="h-1.5 w-2/3 rounded bg-slate-400" />
          <div className="h-1.5 w-1/3 rounded bg-slate-300" />
        </div>
      )}
      {kind === "split" && <div className="w-7 h-full rounded-t-full bg-slate-300" />}
    </div>
  );
}
