"use client";
import { useEffect, useState } from "react";
import { LuCheck, LuPlus, LuTrash2, LuImagePlus, LuChevronUp, LuChevronDown, LuStar } from "react-icons/lu";
import { TestimonialItem, DEFAULT_TESTIMONIALS, TESTIMONIALS_KEY } from "@/lib/testimonials";

const emptyItem: TestimonialItem = {
  reviewEn: "",
  reviewAr: "",
  authorNameEn: "",
  authorNameAr: "",
  authorRoleEn: "",
  authorRoleAr: "",
  authorImg: "",
  rating: 5,
};

export default function TestimonialsAdminPage() {
  const [items, setItems] = useState<TestimonialItem[]>(DEFAULT_TESTIMONIALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/testimonials")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data.items) && d.data.items.length) setItems(d.data.items);
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

  const updateItem = (i: number, patch: Partial<TestimonialItem>) =>
    setItems((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const moveItem = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
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
        body: JSON.stringify({ [TESTIMONIALS_KEY]: items }),
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
        Customer reviews shown in the &ldquo;User Feedbacks&rdquo; carousel on the homepage.
      </p>

      <div className="space-y-5">
        {items.map((item, i) => (
          <div key={i} className="admin-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">Testimonial {i + 1}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><LuChevronUp size={16} /></button>
                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><LuChevronDown size={16} /></button>
                <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove"><LuTrash2 size={16} /></button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <label className="block text-sm font-medium text-slate-700 self-start">Photo</label>
                {item.authorImg ? (
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.authorImg} alt="author" className="w-full h-full object-cover" />
                    <button onClick={() => updateItem(i, { authorImg: "" })} className="absolute top-0 right-0 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">×</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-dashed border-slate-300 text-slate-400 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 text-xs">
                    {uploadingKey === `item-${i}` ? <span className="spinner" /> : <LuImagePlus size={18} />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files, `item-${i}`, (url) => updateItem(i, { authorImg: url }))} disabled={uploadingKey === `item-${i}`} />
                  </label>
                )}

                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <button key={s} onClick={() => updateItem(i, { rating: s + 1 })} title={`${s + 1} stars`}>
                      <LuStar size={16} className={s < item.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Author Name (English)" value={item.authorNameEn} onChange={(v) => updateItem(i, { authorNameEn: v })} />
                  <Field label="Author Name (Arabic)" rtl value={item.authorNameAr} onChange={(v) => updateItem(i, { authorNameAr: v })} />
                  <Field label="Author Role (English)" value={item.authorRoleEn} onChange={(v) => updateItem(i, { authorRoleEn: v })} placeholder="Mother from Muscat" />
                  <Field label="Author Role (Arabic)" rtl value={item.authorRoleAr} onChange={(v) => updateItem(i, { authorRoleAr: v })} />
                </div>
                <TextArea label="Review (English)" value={item.reviewEn} onChange={(v) => updateItem(i, { reviewEn: v })} />
                <TextArea label="Review (Arabic)" rtl value={item.reviewAr} onChange={(v) => updateItem(i, { reviewAr: v })} />
              </div>
            </div>
          </div>
        ))}

        <button onClick={addItem} className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
          <LuPlus size={18} /> Add Testimonial
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

function TextArea({
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
      <textarea
        className="admin-input"
        rows={3}
        dir={rtl ? "rtl" : "ltr"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
