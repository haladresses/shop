"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuArchive,
  LuAtSign,
  LuCheck,
  LuClock,
  LuInbox,
  LuMail,
  LuMailOpen,
  LuPhone,
  LuRefreshCw,
  LuSave,
  LuSearch,
  LuSettings2,
  LuTrash2,
  LuUser,
  LuX,
} from "react-icons/lu";

type ContactMessage = {
  id: string;
  firstName: string;
  lastName: string | null;
  subject: string | null;
  phone: string | null;
  email: string | null;
  message: string;
  status: "new" | "read" | "archived";
  language: string | null;
  createdAt: string;
};

type Counts = { all: number; new: number; read: number; archived: number };

type Tab = "inbox" | "details";
type StatusFilter = "all" | "new" | "read" | "archived";

const STATUS_BADGE: Record<ContactMessage["status"], string> = {
  new: "border-amber-200 bg-amber-50 text-amber-700",
  read: "border-slate-200 bg-slate-50 text-slate-600",
  archived: "border-slate-200 bg-white text-slate-400",
};

const INFO_FIELDS: { key: string; labelEn: string; placeholder: string; full?: boolean; ltr?: boolean }[] = [
  { key: "store_name_en", labelEn: "Store name (EN)", placeholder: "Hala Dresses" },
  { key: "store_name_ar", labelEn: "Store name (AR)", placeholder: "هلا دريسز" },
  { key: "store_email", labelEn: "Email", placeholder: "info@haladresses.com", ltr: true },
  { key: "store_phone", labelEn: "Phone", placeholder: "+968 9944 0312", ltr: true },
  { key: "store_whatsapp", labelEn: "WhatsApp (optional)", placeholder: "+968 9944 0312", ltr: true },
  { key: "store_instagram", labelEn: "Instagram", placeholder: "7ala_dresses", ltr: true },
  { key: "store_address", labelEn: "Address", placeholder: "Bousher, Muscat, Oman", full: true },
  { key: "store_map_url", labelEn: "Map URL (optional)", placeholder: "https://maps.google.com/...", full: true, ltr: true },
];

export default function AdminContactPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Inbox state
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, new: 0, read: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Contact details state
  const [info, setInfo] = useState<Record<string, string>>({});
  const [infoLoading, setInfoLoading] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/contact/messages?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load messages");
      setMessages(json.data.messages);
      setCounts(json.data.counts);
    } catch (e) {
      setBanner({ type: "error", text: e instanceof Error ? e.message : "Failed to load messages" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    const t = setTimeout(loadMessages, 250);
    return () => clearTimeout(t);
  }, [loadMessages]);

  useEffect(() => {
    fetch("/api/admin/contact/info")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setInfo(json.data);
      })
      .catch(() => {})
      .finally(() => setInfoLoading(false));
  }, []);

  const updateStatus = async (id: string, status: ContactMessage["status"]) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/contact/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update message");
      await loadMessages();
    } catch (e) {
      setBanner({ type: "error", text: e instanceof Error ? e.message : "Failed to update message" });
    } finally {
      setBusyId(null);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!window.confirm("Delete this message permanently?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/contact/messages?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete message");
      await loadMessages();
    } catch (e) {
      setBanner({ type: "error", text: e instanceof Error ? e.message : "Failed to delete message" });
    } finally {
      setBusyId(null);
    }
  };

  const saveInfo = async () => {
    setSavingInfo(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/contact/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save contact details");
      setInfo(json.data);
      setBanner({ type: "success", text: "Contact details saved." });
    } catch (e) {
      setBanner({ type: "error", text: e instanceof Error ? e.message : "Failed to save contact details" });
    } finally {
      setSavingInfo(false);
    }
  };

  const statusTabs: { id: StatusFilter; label: string; count: number }[] = useMemo(
    () => [
      { id: "all", label: "All", count: counts.all },
      { id: "new", label: "New", count: counts.new },
      { id: "read", label: "Read", count: counts.read },
      { id: "archived", label: "Archived", count: counts.archived },
    ],
    [counts],
  );

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-sm ${
            banner.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-black/5">
            <LuX size={14} />
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="admin-card border border-slate-200 p-5 sm:p-6">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Contact Us</h1>
          <p className="text-sm leading-6 text-slate-500">
            Read and manage messages sent from the storefront contact form, and keep the public contact details accurate across the
            whole site.
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setTab("inbox")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "inbox" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LuInbox size={16} /> Inbox
            {counts.new > 0 ? (
              <span className={`rounded-full px-1.5 text-[11px] ${tab === "inbox" ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>
                {counts.new}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab("details")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "details" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LuSettings2 size={16} /> Contact details
          </button>
        </div>
      </section>

      {tab === "inbox" ? (
        <>
          {/* Toolbar */}
          <section className="admin-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="group relative min-w-0 flex-1">
                <LuSearch size={16} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-slate-700" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ paddingLeft: "3rem", paddingRight: query ? "2.25rem" : "0.875rem" }}
                  className="admin-input !rounded-full border-slate-200 bg-white transition-colors duration-200 focus:border-slate-300"
                  placeholder="Search messages"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <LuX size={14} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={loadMessages}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                title="Refresh"
                aria-label="Refresh"
              >
                <LuRefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {statusTabs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                    statusFilter === s.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {s.label}
                  <span className={`text-[11px] font-semibold ${statusFilter === s.id ? "text-white/70" : "text-slate-400"}`}>
                    {s.count}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Messages */}
          {loading && messages.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : messages.length === 0 ? (
            <section className="admin-card p-10 text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <LuInbox size={22} />
              </div>
              <div className="text-lg font-semibold text-slate-800">No messages here</div>
              <div className="mt-2 text-sm text-slate-500">
                {query || statusFilter !== "all"
                  ? "Try a different search or status filter."
                  : "New messages from the storefront contact form will appear here."}
              </div>
            </section>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <MessageCard
                  key={m.id}
                  message={m}
                  busy={busyId === m.id}
                  onStatus={updateStatus}
                  onDelete={deleteMessage}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Contact details */
        <section className="admin-card border border-slate-200 p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <LuSettings2 size={18} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Public contact details</h2>
              <p className="mt-1 text-sm text-slate-500">
                These values power the storefront Contact page, the footer, and other site-wide contact points.
              </p>
            </div>
          </div>

          {infoLoading ? (
            <div className="flex justify-center py-10">
              <div className="spinner" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {INFO_FIELDS.map((field) => (
                  <div key={field.key} className={field.full ? "sm:col-span-2" : ""}>
                    <label htmlFor={field.key} className="mb-1.5 block text-sm font-medium text-slate-700">
                      {field.labelEn}
                    </label>
                    <input
                      id={field.key}
                      value={info[field.key] ?? ""}
                      onChange={(e) => setInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      dir={field.ltr ? "ltr" : undefined}
                      className="admin-input rounded-xl border-slate-200 bg-white transition-colors duration-200 focus:border-slate-300"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={saveInfo}
                  disabled={savingInfo}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <LuSave size={16} /> {savingInfo ? "Saving..." : "Save details"}
                </button>
                <span className="text-xs text-slate-400">Instagram accepts a handle or a full profile URL.</span>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function MessageCard({
  message,
  busy,
  onStatus,
  onDelete,
}: {
  message: ContactMessage;
  busy: boolean;
  onStatus: (id: string, status: ContactMessage["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const fullName = [message.firstName, message.lastName].filter(Boolean).join(" ");
  const created = new Date(message.createdAt);
  const dateLabel = created.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <article
      className={`admin-card border p-5 transition-colors duration-200 ${
        message.status === "new" ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <LuUser size={16} />
            </span>
            <span className="font-semibold text-slate-900">{fullName || "Unknown"}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[message.status]}`}>
              {message.status}
            </span>
            {message.language ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {message.language}
              </span>
            ) : null}
          </div>

          {message.subject ? (
            <div className="mt-3 text-sm font-semibold text-slate-800">{message.subject}</div>
          ) : null}
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600">{message.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <LuClock size={13} /> {dateLabel}
            </span>
            {message.phone ? (
              <a href={`tel:${message.phone}`} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900">
                <LuPhone size={13} /> <span dir="ltr">{message.phone}</span>
              </a>
            ) : null}
            {message.email ? (
              <a href={`mailto:${message.email}`} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900">
                <LuAtSign size={13} /> {message.email}
              </a>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {message.status !== "read" ? (
            <button
              type="button"
              onClick={() => onStatus(message.id, "read")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <LuMailOpen size={14} /> Mark read
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStatus(message.id, "new")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <LuMail size={14} /> Mark unread
            </button>
          )}
          {message.status !== "archived" ? (
            <button
              type="button"
              onClick={() => onStatus(message.id, "archived")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <LuArchive size={14} /> Archive
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStatus(message.id, "read")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <LuCheck size={14} /> Restore
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <LuTrash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </article>
  );
}
