"use client";
import { useEffect, useState } from "react";
import { LuCheck, LuPlus, LuTrash2, LuChevronUp, LuChevronDown } from "react-icons/lu";
import {
  DEFAULT_FOOTER_CONFIG,
  normalizeFooter,
  FOOTER_CONFIG_KEY,
  type FooterConfig,
  type FooterColumn,
  type FooterLink,
} from "@/lib/footer";

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        className="admin-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-card p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">{title}</h3>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export default function FooterSettings() {
  const [config, setConfig] = useState<FooterConfig>(DEFAULT_FOOTER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setConfig(normalizeFooter(d.data?.[FOOTER_CONFIG_KEY]));
      })
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof FooterConfig>(key: K, value: FooterConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const setColumn = (idx: number, patch: Partial<FooterColumn>) =>
    setConfig((c) => ({
      ...c,
      columns: c.columns.map((col, i) => (i === idx ? { ...col, ...patch } : col)),
    }));

  const setLink = (colIdx: number, linkIdx: number, patch: Partial<FooterLink>) =>
    setColumn(colIdx, {
      links: config.columns[colIdx].links.map((l, i) =>
        i === linkIdx ? { ...l, ...patch } : l
      ),
    });

  const addColumn = () =>
    set("columns", [
      ...config.columns,
      { titleEn: "New Column", titleAr: "عمود جديد", links: [] },
    ]);

  const removeColumn = (idx: number) =>
    set("columns", config.columns.filter((_, i) => i !== idx));

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const next = [...config.columns];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    set("columns", next);
  };

  const addLink = (colIdx: number) =>
    setColumn(colIdx, {
      links: [...config.columns[colIdx].links, { labelEn: "", labelAr: "", href: "#" }],
    });

  const removeLink = (colIdx: number, linkIdx: number) =>
    setColumn(colIdx, {
      links: config.columns[colIdx].links.filter((_, i) => i !== linkIdx),
    });

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [FOOTER_CONFIG_KEY]: config }),
    });
    const data = await res.json();
    if (data.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );

  return (
    <div className="space-y-6">
      <Section title="Brand & Contact">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Brand Name (English)" value={config.brandEn} onChange={(v) => set("brandEn", v)} />
          <Field label="Brand Name (Arabic)" value={config.brandAr} onChange={(v) => set("brandAr", v)} />
          <Field label="Address (English)" value={config.addressEn} onChange={(v) => set("addressEn", v)} />
          <Field label="Address (Arabic)" value={config.addressAr} onChange={(v) => set("addressAr", v)} />
          <Field label="Phone" value={config.phone} onChange={(v) => set("phone", v)} />
          <Field
            label="Instagram Handle (display text)"
            value={config.instagramHandle}
            onChange={(v) => set("instagramHandle", v)}
            placeholder="instagram.com/your_handle"
          />
        </div>
      </Section>

      <Section title="Social Links">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Facebook URL" value={config.facebookUrl} onChange={(v) => set("facebookUrl", v)} placeholder="https://facebook.com/..." />
          <Field label="Twitter / X URL" value={config.twitterUrl} onChange={(v) => set("twitterUrl", v)} placeholder="https://x.com/..." />
          <Field label="Instagram URL" value={config.instagramUrl} onChange={(v) => set("instagramUrl", v)} placeholder="https://instagram.com/..." />
          <Field label="LinkedIn URL" value={config.linkedinUrl} onChange={(v) => set("linkedinUrl", v)} placeholder="https://linkedin.com/..." />
        </div>
      </Section>

      <Section title="Link Columns">
        <div className="space-y-4">
          {config.columns.map((col, colIdx) => (
            <div key={colIdx} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 sm:grid-cols-2 gap-3">
                  <Field label="Title (English)" value={col.titleEn} onChange={(v) => setColumn(colIdx, { titleEn: v })} />
                  <Field label="Title (Arabic)" value={col.titleAr} onChange={(v) => setColumn(colIdx, { titleAr: v })} />
                </div>
                <div className="flex flex-col gap-1 pt-6">
                  <button
                    type="button"
                    onClick={() => moveColumn(colIdx, -1)}
                    className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    disabled={colIdx === 0}
                    aria-label="Move column up"
                  >
                    <LuChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveColumn(colIdx, 1)}
                    className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    disabled={colIdx === config.columns.length - 1}
                    aria-label="Move column down"
                  >
                    <LuChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeColumn(colIdx)}
                    className="p-1.5 rounded text-red-500 hover:bg-red-50"
                    aria-label="Remove column"
                  >
                    <LuTrash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {col.links.map((link, linkIdx) => (
                  <div key={linkIdx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <input
                      className="admin-input"
                      placeholder="Label (EN)"
                      value={link.labelEn}
                      onChange={(e) => setLink(colIdx, linkIdx, { labelEn: e.target.value })}
                    />
                    <input
                      className="admin-input"
                      placeholder="Label (AR)"
                      value={link.labelAr}
                      onChange={(e) => setLink(colIdx, linkIdx, { labelAr: e.target.value })}
                    />
                    <input
                      className="admin-input"
                      placeholder="Link (href)"
                      value={link.href}
                      onChange={(e) => setLink(colIdx, linkIdx, { href: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(colIdx, linkIdx)}
                      className="p-2 rounded text-red-500 hover:bg-red-50 justify-self-start"
                      aria-label="Remove link"
                    >
                      <LuTrash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addLink(colIdx)}
                  className="admin-btn admin-btn-secondary text-sm inline-flex items-center gap-1.5"
                >
                  <LuPlus size={15} /> Add Link
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addColumn}
            className="admin-btn admin-btn-secondary inline-flex items-center gap-1.5"
          >
            <LuPlus size={16} /> Add Column
          </button>
        </div>
      </Section>

      <Section title="Store Hours">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Title (English)" value={config.storeHoursTitleEn} onChange={(v) => set("storeHoursTitleEn", v)} />
          <Field label="Title (Arabic)" value={config.storeHoursTitleAr} onChange={(v) => set("storeHoursTitleAr", v)} />
          <Field label="Text (English)" value={config.storeHoursTextEn} onChange={(v) => set("storeHoursTextEn", v)} />
          <Field label="Text (Arabic)" value={config.storeHoursTextAr} onChange={(v) => set("storeHoursTextAr", v)} />
        </div>
      </Section>

      <Section title="Call To Action Buttons">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="WhatsApp Number (digits)" value={config.whatsappNumber} onChange={(v) => set("whatsappNumber", v)} placeholder="96899440312" />
          <div />
          <Field label="WhatsApp Lead Text (English)" value={config.whatsappLeadEn} onChange={(v) => set("whatsappLeadEn", v)} />
          <Field label="WhatsApp Lead Text (Arabic)" value={config.whatsappLeadAr} onChange={(v) => set("whatsappLeadAr", v)} />
          <Field label="Instagram Lead Text (English)" value={config.instagramLeadEn} onChange={(v) => set("instagramLeadEn", v)} />
          <Field label="Instagram Lead Text (Arabic)" value={config.instagramLeadAr} onChange={(v) => set("instagramLeadAr", v)} />
        </div>
      </Section>

      <Section title="Copyright">
        <p className="text-xs text-slate-500 -mt-2">
          Use <code className="px-1 py-0.5 bg-slate-100 rounded">{"{year}"}</code> to insert the current year automatically.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Copyright (English)" value={config.copyrightEn} onChange={(v) => set("copyrightEn", v)} />
          <Field label="Copyright (Arabic)" value={config.copyrightAr} onChange={(v) => set("copyrightAr", v)} />
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary px-8">
          {saving ? "Saving..." : "Save Footer"}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            <LuCheck size={16} /> Footer saved!
          </span>
        )}
      </div>
    </div>
  );
}
