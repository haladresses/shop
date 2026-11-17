"use client";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { addDays, toBusinessDateKey } from "@/lib/finance";
import { fmtDay, fmtDateTime, methodName } from "./shared";

// Report filters live in the URL (?tab=…&preset=…&from=…), so every view is
// linkable and survives a reload.

export type Tab = "summary" | "days" | "sellers" | "receipts" | "payments" | "products" | "categories";
export const TABS: { id: Tab; label: string; labelAr: string }[] = [
  { id: "summary", label: "Daily summary", labelAr: "الملخص اليومي" },
  { id: "days", label: "By day", labelAr: "حسب اليوم" },
  { id: "sellers", label: "By salesperson", labelAr: "حسب البائع" },
  { id: "receipts", label: "By receipt", labelAr: "حسب الإيصال" },
  { id: "payments", label: "By payment method", labelAr: "حسب طريقة الدفع" },
  { id: "products", label: "By product", labelAr: "حسب المنتج" },
  { id: "categories", label: "By category", labelAr: "حسب الفئة" },
];

export type Preset = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month" | "last-30" | "this-year" | "custom";
export const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-30", label: "Last 30 days" },
  { id: "this-year", label: "This year" },
  { id: "custom", label: "Custom" },
];

const weekday = (key: string) => (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday

/** Calendar range for a preset, in the shop's own days. */
export function presetRange(p: Preset, today = toBusinessDateKey(new Date())): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  switch (p) {
    case "yesterday": {
      const d = addDays(today, -1);
      return { from: d, to: d };
    }
    case "this-week":
      return { from: addDays(today, -weekday(today)), to: today };
    case "last-week": {
      const start = addDays(today, -weekday(today) - 7);
      return { from: start, to: addDays(start, 6) };
    }
    case "this-month":
      return { from: monthStart, to: today };
    case "last-month": {
      const end = addDays(monthStart, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
    case "last-30":
      return { from: addDays(today, -29), to: today };
    case "this-year":
      return { from: `${y}-01-01`, to: today };
    default:
      return { from: today, to: today };
  }
}

export type Meta = {
  sellers: { id: string; name: string; role: string; isActive: boolean }[];
  shifts: { id: string; status: string; openedAt: string; closedAt: string | null; cashierName: string }[];
  saleMethods: string[];
  refundMethods: string[];
  categories: { id: string; nameEn: string; nameAr: string; parentId: string | null; sortOrder: number }[];
};

export type FilterState = {
  preset: Preset;
  from: string;
  to: string;
  channel: string;
  seller: string;
  method: string;
  shift: string;
};

export const ONLINE_SELLER = "__online";
export const UNKNOWN_SELLER = "__unknown";

export function sellerLabel(id: string, meta: Meta | null) {
  if (id === ONLINE_SELLER) return "Online store";
  if (id === UNKNOWN_SELLER) return "Unassigned";
  return meta?.sellers.find((s) => s.id === id)?.name ?? "Selected salesperson";
}

export function rangeLabel(from: string, to: string) {
  return from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;
}

export function filterLabel(f: FilterState, meta: Meta | null) {
  const parts: string[] = [];
  if (f.channel) parts.push(`Channel: ${f.channel === "POS" ? "In store" : "Online"}`);
  if (f.seller) parts.push(`Salesperson: ${sellerLabel(f.seller, meta)}`);
  if (f.method) parts.push(`Payment: ${methodName(f.method)}`);
  if (f.shift) {
    const s = meta?.shifts.find((x) => x.id === f.shift);
    parts.push(`Shift: ${s ? `${s.cashierName} ${fmtDateTime(s.openedAt)}` : "selected"}`);
  }
  return parts.join(" · ");
}

export default function Filters({
  f,
  meta,
  onChange,
}: {
  f: FilterState;
  meta: Meta | null;
  onChange: (patch: Partial<FilterState>) => void;
}) {
  const single = f.from === f.to;
  const shiftDay = (days: number) => {
    const from = addDays(f.from, days);
    const to = single ? from : addDays(f.to, days);
    onChange({ preset: "custom", from, to });
  };
  const methods = Array.from(new Set([...(meta?.saleMethods ?? []), ...(meta?.refundMethods ?? [])]));

  return (
    <div className="admin-card p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id === "custom" ? { preset: "custom" } : { preset: p.id, ...presetRange(p.id) })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              f.preset === p.id ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* Dates, with arrows to step to the previous / next period */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-end gap-1.5">
          <button type="button" onClick={() => shiftDay(single ? -1 : -(1 + daysSpan(f.from, f.to)))} className="admin-btn admin-btn-secondary !px-2 !py-2" title="Previous period" aria-label="Previous period">
            <LuChevronLeft size={15} />
          </button>
          <label className="block text-xs text-slate-500">
            <span className="block mb-1">From</span>
            <input type="date" value={f.from} max={f.to} onChange={(e) => e.target.value && onChange({ preset: "custom", from: e.target.value })} className="admin-input !py-1.5 text-sm !w-auto" />
          </label>
          <label className="block text-xs text-slate-500">
            <span className="block mb-1">To</span>
            <input type="date" value={f.to} min={f.from} onChange={(e) => e.target.value && onChange({ preset: "custom", to: e.target.value })} className="admin-input !py-1.5 text-sm !w-auto" />
          </label>
          <button type="button" onClick={() => shiftDay(single ? 1 : 1 + daysSpan(f.from, f.to))} className="admin-btn admin-btn-secondary !px-2 !py-2" title="Next period" aria-label="Next period">
            <LuChevronRight size={15} />
          </button>
        </div>
        {(f.channel || f.seller || f.method || f.shift) && (
          <button type="button" onClick={() => onChange({ channel: "", seller: "", method: "", shift: "" })} className="admin-btn admin-btn-secondary !py-2 !text-xs">
            Clear filters
          </button>
        )}
      </div>

      {/* The four filters on one even grid, so the fields always line up */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block text-xs text-slate-500 min-w-0">
          <span className="block mb-1">Channel</span>
          <select value={f.channel} onChange={(e) => onChange({ channel: e.target.value })} className="admin-input admin-select !py-1.5 text-sm">
            <option value="">All channels</option>
            <option value="POS">In store (POS)</option>
            <option value="ONLINE">Online</option>
          </select>
        </label>
        <label className="block text-xs text-slate-500 min-w-0">
          <span className="block mb-1">Salesperson</span>
          <select value={f.seller} onChange={(e) => onChange({ seller: e.target.value })} className="admin-input admin-select !py-1.5 text-sm">
            <option value="">Everyone</option>
            <option value={ONLINE_SELLER}>Online store</option>
            {(meta?.sellers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? "" : " (inactive)"}
              </option>
            ))}
            <option value={UNKNOWN_SELLER}>Unassigned</option>
          </select>
        </label>
        <label className="block text-xs text-slate-500 min-w-0">
          <span className="block mb-1">Payment method</span>
          <select value={f.method} onChange={(e) => onChange({ method: e.target.value })} className="admin-input admin-select !py-1.5 text-sm">
            <option value="">All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>{methodName(m)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500 min-w-0">
          <span className="block mb-1">POS shift</span>
          <select value={f.shift} onChange={(e) => onChange({ shift: e.target.value })} className="admin-input admin-select !py-1.5 text-sm">
            <option value="">All shifts</option>
            {(meta?.shifts ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.cashierName} · {fmtDateTime(s.openedAt)}
                {s.status === "OPEN" ? " (open)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function daysSpan(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
