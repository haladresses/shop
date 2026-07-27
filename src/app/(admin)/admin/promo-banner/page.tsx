"use client";
import { useEffect, useState } from "react";
import { LuCheck, LuPlus, LuTrash2, LuImagePlus, LuChevronUp, LuChevronDown } from "react-icons/lu";
import { PromoTile, DEFAULT_PROMO_TILES, PROMO_BANNER_KEY } from "@/lib/promoBanner";

const emptyTile: PromoTile = {
  image: "",
  eyebrowEn: "",
  eyebrowAr: "",
  titleEn: "",
  titleAr: "",
  ctaEn: "",
  ctaAr: "",
  href: "/shop",
};

export default function PromoBannerAdminPage() {
  const [tiles, setTiles] = useState<PromoTile[]>(DEFAULT_PROMO_TILES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/promo-banner")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data.tiles) && d.data.tiles.length) setTiles(d.data.tiles);
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

  const updateTile = (i: number, patch: Partial<PromoTile>) =>
    setTiles((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTile = () => setTiles((prev) => [...prev, { ...emptyTile }]);
  const removeTile = (i: number) => setTiles((prev) => prev.filter((_, idx) => idx !== i));
  const moveTile = (i: number, dir: -1 | 1) =>
    setTiles((prev) => {
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
        body: JSON.stringify({ [PROMO_BANNER_KEY]: tiles }),
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
      <p className="text-sm text-slate-500">
        The two lifestyle tiles shown on the homepage between New Arrivals and Best Sellers (e.g. &ldquo;Women&apos;s Edit&rdquo; / &ldquo;Girls&apos; Edit&rdquo;). Leave empty to hide the section.
      </p>

      <div className="space-y-5">
        {tiles.map((tile, i) => (
          <div key={i} className="admin-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">Tile {i + 1}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => moveTile(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
                <button onClick={() => moveTile(i, 1)} disabled={i === tiles.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
                <button onClick={() => removeTile(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove tile"><LuTrash2 size={16} /></button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <div className="flex-shrink-0">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Image</label>
                {tile.image ? (
                  <div className="relative w-28 h-36 rounded-lg overflow-hidden border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tile.image} alt="tile" className="w-full h-full object-cover" />
                    <button onClick={() => updateTile(i, { image: "" })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">×</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-28 h-36 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 text-xs">
                    {uploadingKey === `tile-${i}` ? <span className="spinner" /> : (<><LuImagePlus size={20} /><span className="mt-0.5">Upload</span></>)}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files, `tile-${i}`, (url) => updateTile(i, { image: url }))} disabled={uploadingKey === `tile-${i}`} />
                  </label>
                )}
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Eyebrow (English)" value={tile.eyebrowEn} onChange={(v) => updateTile(i, { eyebrowEn: v })} />
                <Field label="Eyebrow (Arabic)" rtl value={tile.eyebrowAr} onChange={(v) => updateTile(i, { eyebrowAr: v })} />
                <Field label="Title (English)" value={tile.titleEn} onChange={(v) => updateTile(i, { titleEn: v })} />
                <Field label="Title (Arabic)" rtl value={tile.titleAr} onChange={(v) => updateTile(i, { titleAr: v })} />
                <Field label="Button Text (English)" value={tile.ctaEn} onChange={(v) => updateTile(i, { ctaEn: v })} />
                <Field label="Button Text (Arabic)" rtl value={tile.ctaAr} onChange={(v) => updateTile(i, { ctaAr: v })} />
                <div className="sm:col-span-2">
                  <Field label="Link" value={tile.href} onChange={(v) => updateTile(i, { href: v })} placeholder="/shop?category=womens-dresses" />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button onClick={addTile} className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
          <LuPlus size={18} /> Add Tile
        </button>
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
