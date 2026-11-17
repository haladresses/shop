"use client";
import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuSearch, LuX } from "react-icons/lu";
import { PAY_STATUS_LABEL, PO_STATUS_LABEL } from "@/lib/purchaseCalc";

// Shared bits for the Suppliers & Purchase Orders screens.

export const fmt3 = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const omr = (n: number | null | undefined) => `${fmt3(n)} OMR`;

const TZ = "Asia/Muscat";

/** Today as YYYY-MM-DD in shop time. */
export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "16 Nov 2026" from a YYYY-MM-DD key or an ISO timestamp. */
export function fmtDate(v: string | null | undefined, withTime = false): string {
  if (!v) return "-";
  const isKey = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const d = isKey ? new Date(`${v}T12:00:00+04:00`) : new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime && !isKey ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export type ApiResult<T> = { success: boolean; data?: T; error?: string; meta?: unknown };

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { success: false, error: "Network error: please try again." };
  }
}

// ───────── permissions ─────────

let mePromise: Promise<string[]> | null = null;
function loadPermissions(): Promise<string[]> {
  if (!mePromise) {
    mePromise = fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d?.data?.permissions as string[]) ?? [])
      .catch(() => {
        mePromise = null;
        return [];
      });
  }
  return mePromise;
}

export type PurchasingPerms = {
  ready: boolean;
  view: boolean;
  manageSuppliers: boolean;
  managePurchases: boolean;
  receive: boolean;
  pay: boolean;
};

export function usePurchasingPerms(): PurchasingPerms {
  const [perms, setPerms] = useState<string[] | null>(null);
  useEffect(() => {
    loadPermissions().then(setPerms);
  }, []);
  const has = (k: string) => !!perms?.includes(k);
  return {
    ready: perms !== null,
    view: has("admin.suppliers.view"),
    manageSuppliers: has("admin.suppliers.manage"),
    managePurchases: has("admin.purchases.manage"),
    receive: has("admin.purchases.receive") || has("admin.purchases.manage"),
    pay: has("admin.supplier_payments.manage"),
  };
}

// ───────── store / tax info for printed documents ─────────

export type DocHeaderInfo = {
  nameEn: string;
  nameAr: string;
  address: string;
  phone: string;
  vatNumber: string;
  crNumber: string;
  legalNameEn: string;
  legalNameAr: string;
  vatEnabled: boolean;
};

let headerPromise: Promise<DocHeaderInfo> | null = null;
export function loadDocHeader(): Promise<DocHeaderInfo> {
  if (!headerPromise) {
    headerPromise = Promise.all([
      fetch("/api/settings?group=general").then((r) => r.json()).catch(() => null),
      fetch("/api/tax/settings").then((r) => r.json()).catch(() => null),
    ]).then(([s, t]) => {
      const g = (s?.data ?? {}) as Record<string, string>;
      const tx = (t?.data ?? {}) as Record<string, unknown>;
      return {
        nameEn: g.store_name_en || "Hala Dresses",
        nameAr: g.store_name_ar || "",
        address: g.store_address || "",
        phone: g.store_phone || "",
        vatNumber: String(tx.vatNumber ?? ""),
        crNumber: String(tx.crNumber ?? ""),
        legalNameEn: String(tx.legalNameEn ?? ""),
        legalNameAr: String(tx.legalNameAr ?? ""),
        vatEnabled: !!tx.enabled,
      };
    });
  }
  return headerPromise;
}

export function useDocHeader(): DocHeaderInfo | null {
  const [h, setH] = useState<DocHeaderInfo | null>(null);
  useEffect(() => {
    loadDocHeader().then(setH);
  }, []);
  return h;
}

// ───────── small UI pieces ─────────

export function StatusBadge({ status }: { status: string }) {
  const s = PO_STATUS_LABEL[status] ?? { en: status, badge: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.badge}`}>{s.en}</span>;
}

export function PayBadge({ status, overdue, days }: { status: string; overdue?: boolean; days?: number }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap bg-rose-100 text-rose-700">
        Overdue{days ? ` ${days} day${days === 1 ? "" : "s"}` : ""}
      </span>
    );
  }
  const s = PAY_STATUS_LABEL[status] ?? PAY_STATUS_LABEL.NONE;
  if (status === "NONE") return <span className="text-xs text-slate-400">-</span>;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.badge}`}>{s.en}</span>;
}

export function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "bad" | "good" | "info";
  onClick?: () => void;
}) {
  const color =
    tone === "warn"
      ? "bg-amber-50 text-amber-600"
      : tone === "bad"
        ? "bg-rose-50 text-rose-600"
        : tone === "good"
          ? "bg-emerald-50 text-emerald-600"
          : tone === "info"
            ? "bg-sky-50 text-sky-600"
            : "bg-slate-100 text-slate-600";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3 min-w-0 text-left ${onClick ? "hover:border-slate-300" : ""}`}
    >
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 tabular-nums break-words">{value}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </Tag>
  );
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: React.ElementType; count?: number | null }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
            value === id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          {Icon && <Icon size={16} />} {label}
          {count != null && count > 0 && (
            <span className={`rounded-full px-1.5 text-[11px] font-semibold ${value === id ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 text-slate-400">
      <Icon size={34} className="mb-2 text-slate-300" />
      <p className="font-medium text-slate-500">{title}</p>
      {children && <div className="text-sm mt-1">{children}</div>}
    </div>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 text-sm">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="admin-btn admin-btn-secondary !py-1.5 disabled:opacity-40">
        Previous
      </button>
      <span className="text-slate-500 tabular-nums">
        {page} / {totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="admin-btn admin-btn-secondary !py-1.5 disabled:opacity-40">
        Next
      </button>
    </div>
  );
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 8) digits = `968${digits}`; // local Omani number
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// ───────── supplier picker ─────────

export type SupplierOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  paymentTermsDays: number;
  balance: number;
  isActive: boolean;
  phone?: string | null;
  vatNumber?: string | null;
};

/** Searchable supplier dropdown (active suppliers). */
export function SupplierPicker({
  value,
  onChange,
  disabled,
  placeholder = "Choose a supplier…",
}: {
  value: SupplierOption | null;
  onChange: (s: SupplierOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [list, setList] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      api<{ items: SupplierOption[] }>(`/api/suppliers?status=active&pageSize=50&sort=name&search=${encodeURIComponent(q.trim())}`).then((d) => {
        setList(d.data?.items ?? []);
        setLoading(false);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="admin-input flex items-center justify-between gap-2 text-left disabled:bg-slate-50 disabled:text-slate-500"
      >
        {value ? (
          <span className="min-w-0 truncate">
            <span className="font-medium text-slate-800">{value.nameEn}</span>
            <span className="text-slate-400 text-xs ml-2">{value.code}</span>
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <LuChevronDown size={16} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[260px] bg-white rounded-xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
          <div className="relative border-b border-slate-100">
            <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, code, phone…"
              className="w-full pl-9 pr-8 py-2.5 text-sm outline-none"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label="Clear">
                <LuX size={14} />
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {loading && list.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">Searching…</li>}
            {!loading && list.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No suppliers found</li>}
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 ${value?.id === s.id ? "bg-indigo-50/60" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800 truncate">{s.nameEn}</span>
                    <span className="block text-xs text-slate-400">
                      {s.code} · {s.paymentTermsDays ? `Net ${s.paymentTermsDays} days` : "Cash on delivery"}
                    </span>
                  </span>
                  <span className={`text-xs tabular-nums shrink-0 ${s.balance > 0.0005 ? "text-rose-600" : s.balance < -0.0005 ? "text-emerald-600" : "text-slate-400"}`}>
                    {s.balance > 0.0005 ? `Owe ${fmt3(s.balance)}` : s.balance < -0.0005 ? `Credit ${fmt3(-s.balance)}` : "Settled"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Money cell coloured by direction (we owe = red, credit = green). */
export function BalanceText({ value, className = "" }: { value: number; className?: string }) {
  const cls = value > 0.0005 ? "text-rose-600" : value < -0.0005 ? "text-emerald-600" : "text-slate-400";
  return (
    <span className={`tabular-nums font-semibold ${cls} ${className}`}>
      {value < -0.0005 ? `−${fmt3(-value)}` : fmt3(value)}
    </span>
  );
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: "BANK_TRANSFER", en: "Bank transfer", ar: "تحويل بنكي" },
  { value: "CASH", en: "Cash", ar: "نقداً" },
  { value: "CHEQUE", en: "Cheque", ar: "شيك" },
  { value: "CARD", en: "Card", ar: "بطاقة" },
  { value: "OTHER", en: "Other", ar: "أخرى" },
];
export const methodText = (m: string) => PAYMENT_METHOD_OPTIONS.find((o) => o.value === m)?.en ?? m;
