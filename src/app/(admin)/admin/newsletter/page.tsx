"use client";
import { useCallback, useEffect, useState } from "react";
import { LuCheck, LuTrash2, LuDownload, LuMailPlus, LuFileText } from "react-icons/lu";
import { NewsletterConfig, DEFAULT_NEWSLETTER_CONFIG, NEWSLETTER_CONFIG_KEY } from "@/lib/newsletter";

type Subscriber = {
  id: string;
  email: string;
  source: string | null;
  language: string | null;
  isActive: boolean;
  createdAt: string;
};

type Tab = "content" | "subscribers";

export default function NewsletterAdminPage() {
  const [tab, setTab] = useState<Tab>("content");
  const [config, setConfig] = useState<NewsletterConfig>(DEFAULT_NEWSLETTER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subLoading, setSubLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    fetch("/api/newsletter-config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setConfig({ ...DEFAULT_NEWSLETTER_CONFIG, ...d.data });
      })
      .finally(() => setLoading(false));
  }, []);

  const loadSubscribers = useCallback(() => {
    setSubLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) qs.set("search", search);
    fetch(`/api/newsletter/subscribers?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSubscribers(d.data);
          setSubTotal(d.meta?.total ?? d.data.length);
        }
      })
      .finally(() => setSubLoading(false));
  }, [page, search]);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [NEWSLETTER_CONFIG_KEY]: config }),
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

  const removeSubscriber = async (id: string) => {
    if (!confirm("Remove this subscriber?")) return;
    const res = await fetch(`/api/newsletter/subscribers?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) setSubscribers((prev) => prev.filter((s) => s.id !== id));
  };

  const exportCsv = async () => {
    const res = await fetch(`/api/newsletter/subscribers?page=1&pageSize=5000`);
    const data = await res.json();
    if (!data.success) return;
    const rows: Subscriber[] = data.data;
    const header = "email,source,language,subscribedAt\n";
    const body = rows
      .map((s) => [s.email, s.source ?? "", s.language ?? "", s.createdAt].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(subTotal / pageSize));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab("content")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "content" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <LuFileText size={16} /> Content
        </button>
        <button
          onClick={() => setTab("subscribers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "subscribers" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <LuMailPlus size={16} /> Subscribers
          <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs bg-black/10">{subTotal}</span>
        </button>
      </div>

      {tab === "content" && (
        <>
          {loading ? (
            <div className="flex justify-center py-12"><div className="spinner" /></div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                The &ldquo;Join the Hala Circle&rdquo; newsletter banner shown on the homepage and product detail pages.
              </p>

              <div className="admin-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Title (English)" value={config.titleEn} onChange={(v) => setConfig((c) => ({ ...c, titleEn: v }))} />
                <Field label="Title (Arabic)" rtl value={config.titleAr} onChange={(v) => setConfig((c) => ({ ...c, titleAr: v }))} />
                <TextArea label="Description (English)" value={config.descriptionEn} onChange={(v) => setConfig((c) => ({ ...c, descriptionEn: v }))} />
                <TextArea label="Description (Arabic)" rtl value={config.descriptionAr} onChange={(v) => setConfig((c) => ({ ...c, descriptionAr: v }))} />
                <Field label="Input Placeholder (English)" value={config.placeholderEn} onChange={(v) => setConfig((c) => ({ ...c, placeholderEn: v }))} />
                <Field label="Input Placeholder (Arabic)" rtl value={config.placeholderAr} onChange={(v) => setConfig((c) => ({ ...c, placeholderAr: v }))} />
                <Field label="Button Text (English)" value={config.ctaEn} onChange={(v) => setConfig((c) => ({ ...c, ctaEn: v }))} />
                <Field label="Button Text (Arabic)" rtl value={config.ctaAr} onChange={(v) => setConfig((c) => ({ ...c, ctaAr: v }))} />
                <Field label="Success Message (English)" value={config.successEn} onChange={(v) => setConfig((c) => ({ ...c, successEn: v }))} />
                <Field label="Success Message (Arabic)" rtl value={config.successAr} onChange={(v) => setConfig((c) => ({ ...c, successAr: v }))} />
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
            </>
          )}
        </>
      )}

      {tab === "subscribers" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Everyone who submitted their email through the newsletter form on the storefront.
          </p>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <input
              className="admin-input max-w-xs"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <button onClick={exportCsv} className="admin-btn admin-btn-secondary" disabled={subTotal === 0}>
              <LuDownload size={16} /> Export CSV
            </button>
          </div>

          <div className="admin-card">
            {subLoading ? (
              <div className="flex justify-center py-12"><div className="spinner" /></div>
            ) : subscribers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">No subscribers yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Source</th>
                      <th>Language</th>
                      <th>Subscribed</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => (
                      <tr key={s.id}>
                        <td className="font-medium text-slate-700">{s.email}</td>
                        <td className="text-slate-500">{s.source || "—"}</td>
                        <td className="text-slate-500 uppercase">{s.language || "—"}</td>
                        <td className="text-slate-500">{new Date(s.createdAt).toLocaleString()}</td>
                        <td>
                          <button onClick={() => removeSubscriber(s.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove">
                            <LuTrash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="admin-btn admin-btn-secondary disabled:opacity-40">
                Previous
              </button>
              <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="admin-btn admin-btn-secondary disabled:opacity-40">
                Next
              </button>
            </div>
          )}
        </div>
      )}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rtl?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <textarea className="admin-input" rows={3} dir={rtl ? "rtl" : "ltr"} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
