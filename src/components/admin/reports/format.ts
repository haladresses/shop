// Formatting, labels and CSV export for the sales reports (client side).

import { addDays, toBusinessDateKey } from "@/lib/finance";

export const TZ = "Asia/Muscat";

export const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const int = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");
export const pct = (n: number | null | undefined) => `${(n ?? 0).toFixed(1)}%`;

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function timeOnly(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}
/** "Sun 16/11/2026" for a YYYY-MM-DD business day. */
export function dayLabel(key: string) {
  const d = new Date(`${key}T12:00:00+04:00`);
  return d.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}
export function longDay(key: string) {
  const d = new Date(`${key}T12:00:00+04:00`);
  return d.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00 – ${String((h + 1) % 24).padStart(2, "0")}:00`;

export const METHOD: Record<string, { en: string; ar: string }> = {
  CASH: { en: "Cash", ar: "نقداً" },
  CARD: { en: "Card", ar: "بطاقة" },
  BANK_TRANSFER: { en: "Bank transfer", ar: "تحويل بنكي" },
  CASH_ON_DELIVERY: { en: "Cash on delivery", ar: "الدفع عند الاستلام" },
  THAWANI: { en: "Thawani (online)", ar: "ثواني" },
  STRIPE: { en: "Card (online)", ar: "بطاقة إلكترونية" },
  STORE_CREDIT: { en: "Store credit", ar: "رصيد المتجر" },
};
export const methodName = (m: string) => METHOD[m]?.en ?? m;
export const methodAr = (m: string) => METHOD[m]?.ar ?? m;
export const channelName = (c: string) => (c === "POS" ? "In store (POS)" : c === "ONLINE" ? "Online store" : c);
export const channelAr = (c: string) => (c === "POS" ? "المتجر (نقطة البيع)" : c === "ONLINE" ? "المتجر الإلكتروني" : c);

// ───────── date presets (shop calendar; week starts Sunday) ─────────

export type Preset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "last30" | "custom";
export const PRESETS: [Preset, string][] = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["thisWeek", "This week"],
  ["lastWeek", "Last week"],
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["last30", "Last 30 days"],
  ["custom", "Custom"],
];

export function todayKey() {
  return toBusinessDateKey(new Date());
}
const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay(); // 0 = Sunday

export function presetRange(p: Preset): { from: string; to: string } {
  const t = todayKey();
  switch (p) {
    case "yesterday": {
      const y = addDays(t, -1);
      return { from: y, to: y };
    }
    case "thisWeek":
      return { from: addDays(t, -weekday(t)), to: t };
    case "lastWeek": {
      const start = addDays(t, -weekday(t) - 7);
      return { from: start, to: addDays(start, 6) };
    }
    case "thisMonth":
      return { from: `${t.slice(0, 8)}01`, to: t };
    case "lastMonth": {
      const firstThis = `${t.slice(0, 8)}01`;
      const lastPrev = addDays(firstThis, -1);
      return { from: `${lastPrev.slice(0, 8)}01`, to: lastPrev };
    }
    case "last30":
      return { from: addDays(t, -29), to: t };
    default:
      return { from: t, to: t };
  }
}

// ───────── CSV ─────────

export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  // BOM so Excel opens Arabic names correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
