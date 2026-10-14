"use client";
import { useEffect, useState } from "react";
import { LuCheck, LuExternalLink } from "react-icons/lu";
import { DEFAULT_WHATSAPP_WIDGET, normalizeWhatsApp, waLink, WHATSAPP_WIDGET_KEY, WhatsAppWidgetConfig } from "@/lib/whatsapp";

/** Admin → Settings → WhatsApp: the floating chat popup on the storefront. */
export default function WhatsAppSettings() {
  const [cfg, setCfg] = useState<WhatsAppWidgetConfig>(DEFAULT_WHATSAPP_WIDGET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/whatsapp-widget", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setCfg(normalizeWhatsApp(d.data)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof WhatsAppWidgetConfig>(k: K, v: WhatsAppWidgetConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setSaved(false);
  };

  const digits = cfg.phone.replace(/\D/g, "");
  const phoneValid = digits.length >= 8 && digits.length <= 15;

  const save = async () => {
    if (!phoneValid) return setError("Enter the number in international format, e.g. +968 9944 0312");
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [WHATSAPP_WIDGET_KEY]: cfg }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.success) setSaved(true);
    else setError(d.error || "Could not save");
  };

  if (loading) return <div className="flex justify-center py-12"><div className="spinner" /></div>;

  const field = (label: string, k: keyof WhatsAppWidgetConfig, rtl = false, multiline = false) => {
    const Tag = multiline ? "textarea" : "input";
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
        <Tag className="admin-input" dir={rtl ? "rtl" : "ltr"} rows={multiline ? 3 : undefined} value={String(cfg[k])} onChange={(e) => set(k, e.target.value as never)} />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="admin-card p-6 space-y-5">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span>
            <span className="block font-medium text-slate-800">Show WhatsApp chat popup</span>
            <span className="block text-sm text-slate-500">A floating WhatsApp button with a greeting on every storefront page.</span>
          </span>
          <Switch checked={cfg.enabled} onChange={(v) => set("enabled", v)} />
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp number</label>
          <div className="flex gap-2">
            <input className={`admin-input font-mono ${phoneValid ? "" : "!border-rose-300"}`} dir="ltr" value={cfg.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+968 9944 0312" />
            <a href={waLink(cfg.phone, "Test from admin")} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary whitespace-nowrap">
              <LuExternalLink size={15} /> Test
            </a>
          </div>
          <p className="text-xs text-slate-400 mt-1">International format with country code.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {field("Display name (English)", "nameEn")}
          {field("Display name (Arabic)", "nameAr", true)}
          {field("Status line (English)", "statusEn")}
          {field("Status line (Arabic)", "statusAr", true)}
          {field("Greeting (English)", "greetingEn", false, true)}
          {field("Greeting (Arabic)", "greetingAr", true, true)}
          {field("Pre-filled message (English)", "prefillEn", false, true)}
          {field("Pre-filled message (Arabic)", "prefillAr", true, true)}
        </div>
        <p className="text-xs text-slate-400 -mt-2">On product pages the product name and link are added to the pre-filled message automatically.</p>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Button side</label>
            <select className="admin-input admin-select" value={cfg.position} onChange={(e) => set("position", e.target.value as "end" | "start")}>
              <option value="end">Right (left in Arabic)</option>
              <option value="start">Left (right in Arabic)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Auto-open greeting after</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={300} className="admin-input" value={cfg.autoOpenSeconds} onChange={(e) => set("autoOpenSeconds", Number(e.target.value))} />
              <span className="text-sm text-slate-500">sec</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">0 = never. Once per visit.</p>
          </div>
          <label className="flex items-center justify-between gap-3 cursor-pointer sm:pt-7">
            <span className="text-sm text-slate-700">Show on mobile</span>
            <Switch checked={cfg.showOnMobile} onChange={(v) => set("showOnMobile", v)} />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary px-8">{saving ? "Saving..." : "Save WhatsApp settings"}</button>
        {saved && <span className="text-green-600 text-sm font-medium flex items-center gap-1"><LuCheck size={16} /> Saved</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-emerald-500" : "bg-slate-200"}`}>
      <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}
