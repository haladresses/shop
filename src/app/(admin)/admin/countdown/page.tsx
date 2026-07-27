"use client";
import { useEffect, useState } from "react";
import { LuCheck, LuImagePlus } from "react-icons/lu";
import { CountdownConfig, normalizeCountdown, COUNTDOWN_CONFIG_KEY } from "@/lib/countdown";

/** Convert an ISO string to the value a <input type="datetime-local"> expects (local time, no seconds/zone). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CountdownAdminPage() {
  const [config, setConfig] = useState<CountdownConfig>(() => normalizeCountdown(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/countdown")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setConfig(normalizeCountdown(d.data));
      })
      .finally(() => setLoading(false));
  }, []);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setConfig((c) => ({ ...c, image: data.data.url }));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [COUNTDOWN_CONFIG_KEY]: config }),
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
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-slate-500">
        The countdown / deal banner shown on the homepage between Best Sellers and Testimonials.
      </p>

      <div className="admin-card p-5 space-y-5">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-slate-700">Show this section on the homepage</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Eyebrow (English)" value={config.eyebrowEn} onChange={(v) => setConfig((c) => ({ ...c, eyebrowEn: v }))} />
          <Field label="Eyebrow (Arabic)" rtl value={config.eyebrowAr} onChange={(v) => setConfig((c) => ({ ...c, eyebrowAr: v }))} />
          <Field label="Title (English)" value={config.titleEn} onChange={(v) => setConfig((c) => ({ ...c, titleEn: v }))} />
          <Field label="Title (Arabic)" rtl value={config.titleAr} onChange={(v) => setConfig((c) => ({ ...c, titleAr: v }))} />
          <Field label="Button Text (English)" value={config.ctaEn} onChange={(v) => setConfig((c) => ({ ...c, ctaEn: v }))} />
          <Field label="Button Text (Arabic)" rtl value={config.ctaAr} onChange={(v) => setConfig((c) => ({ ...c, ctaAr: v }))} />
          <Field label="Button Link" value={config.href} onChange={(v) => setConfig((c) => ({ ...c, href: v }))} placeholder="/shop" />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ends At</label>
            <input
              type="datetime-local"
              className="admin-input"
              value={toLocalInputValue(config.endsAt)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setConfig((c) => ({ ...c, endsAt: new Date(v).toISOString() }));
              }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Featured Image</label>
          {config.image ? (
            <div className="relative w-32 h-40 rounded-lg overflow-hidden border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.image} alt="countdown" className="w-full h-full object-cover" />
              <button onClick={() => setConfig((c) => ({ ...c, image: "" }))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">×</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-32 h-40 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 text-xs">
              {uploading ? <span className="spinner" /> : (<><LuImagePlus size={20} /><span className="mt-0.5">Upload</span></>)}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

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
