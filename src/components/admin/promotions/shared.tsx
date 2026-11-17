"use client";
import type { IconType } from "react-icons";
import { LuCoins, LuGift, LuPercent, LuShoppingBag, LuShuffle, LuTag } from "react-icons/lu";
import type { PromotionRule, PromotionStatus, PromotionTypeKey } from "@/lib/promotionEngine";
import type { PickerProduct } from "@/lib/promotionAdmin";

export type { PickerProduct };

export type CategoryNode = {
  id: string;
  nameEn: string;
  nameAr: string;
  parentId: string | null;
  isActive: boolean;
  _count?: { products?: number };
};

export type PromotionListItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  badgeEn: string | null;
  badgeAr: string | null;
  type: PromotionTypeKey;
  channel: "ALL" | "ONLINE" | "POS";
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startsAtLocal: string;
  endsAtLocal: string;
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
  priority: number;
  discountPercent: number | null;
  discountAmount: number | null;
  fixedPrice: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minSpend: number | null;
  maxApplicationsPerOrder: number | null;
  usageLimit: number | null;
  usedCount: number;
  buyScope: "ALL" | "PRODUCTS" | "CATEGORIES";
  getScope: "ALL" | "PRODUCTS" | "CATEGORIES" | null;
  excludeSaleItems: boolean;
  status: PromotionStatus;
  description: { en: string; ar: string };
  targets: {
    buyProducts: number;
    buyCategories: number;
    getProducts: number;
    getCategories: number;
    buyNames: string[];
    getNames: string[];
  };
  stats: { redemptions: number; discount: number; revenue: number; lastUsedAt: string | null };
  rule: PromotionRule;
  createdAt: string;
  updatedAt: string;
};

export type PromotionDetail = PromotionListItem & {
  buyProducts: PickerProduct[];
  getProducts: PickerProduct[];
  buyCategories: { id: string; nameEn: string; nameAr: string }[];
  getCategories: { id: string; nameEn: string; nameAr: string }[];
  series: { day: string; orders: number; discount: number }[];
  recent: {
    id: string;
    discount: number;
    units: number;
    createdAt: string;
    order: { id: string; orderNumber: string; total: number; source: string; customer: string };
  }[];
};

export const TYPE_META: Record<PromotionTypeKey, { icon: IconType; tile: string; examples: string[] }> = {
  BUY_X_GET_Y: { icon: LuGift, tile: "bg-slate-100 text-slate-600", examples: ["Buy 1, get 2 free", "Buy 2, get 1 at 50% off"] },
  MIX_AND_MATCH: { icon: LuShuffle, tile: "bg-slate-100 text-slate-600", examples: ["Any 3 for 20 OMR", "Any 2 scarves for 5 OMR"] },
  PERCENT_OFF: { icon: LuPercent, tile: "bg-slate-100 text-slate-600", examples: ["20% off the new collection", "30% off on Fridays"] },
  AMOUNT_OFF: { icon: LuCoins, tile: "bg-slate-100 text-slate-600", examples: ["2 OMR off every abaya", "5 OMR off selected dresses"] },
  FIXED_PRICE: { icon: LuTag, tile: "bg-slate-100 text-slate-600", examples: ["All scarves 3 OMR", "Clearance at 9.900 OMR"] },
  ORDER_THRESHOLD: { icon: LuShoppingBag, tile: "bg-slate-100 text-slate-600", examples: ["Spend 50, save 10%", "Spend 30, save 5 OMR"] },
};

export const STATUS_META: Record<PromotionStatus, { label: string; chip: string; dot: string }> = {
  ACTIVE: { label: "Active", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  SCHEDULED: { label: "Scheduled", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  PAUSED: { label: "Paused", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  EXPIRED: { label: "Ended", chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  USED_UP: { label: "Used up", chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
};

export const CHANNEL_LABEL: Record<"ALL" | "ONLINE" | "POS", string> = {
  ALL: "Online + in store",
  ONLINE: "Online only",
  POS: "In store (POS) only",
};

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const omr = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} OMR`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-01T09:00" (shop time) → "1 Dec 2026, 09:00". */
export function formatLocal(v: string, withYear = true): string {
  if (!v) return "";
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}${t ? `, ${t.slice(0, 5)}` : ""}`;
}

/** Days as a compact phrase: "Fri – Sat", "Weekdays", "Mon, Wed". */
export function formatDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  const sorted = [...days].sort();
  if (sorted.join() === "0,1,2,3,4") return "Sun – Thu";
  if (sorted.join() === "5,6") return "Fri – Sat (weekend)";
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}

export function formatSchedule(p: {
  startsAtLocal?: string;
  endsAtLocal?: string;
  daysOfWeek?: number[] | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  const parts: string[] = [];
  if (p.startsAtLocal && p.endsAtLocal) parts.push(`${formatLocal(p.startsAtLocal)} → ${formatLocal(p.endsAtLocal)}`);
  else if (p.startsAtLocal) parts.push(`From ${formatLocal(p.startsAtLocal)}`);
  else if (p.endsAtLocal) parts.push(`Until ${formatLocal(p.endsAtLocal)}`);
  else parts.push("No end date");
  if (p.daysOfWeek && p.daysOfWeek.length) parts.push(formatDays(p.daysOfWeek));
  if (p.startTime && p.endTime) parts.push(`${p.startTime}–${p.endTime}`);
  return parts.join(" · ");
}

export function StatusChip({ status }: { status: PromotionStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${m.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function TypeTile({ type, size = 40 }: { type: PromotionTypeKey; size?: number }) {
  const m = TYPE_META[type];
  const Icon = m.icon;
  return (
    <span className={`rounded-xl flex items-center justify-center shrink-0 ${m.tile}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    return await res.json();
  } catch {
    return { success: false, error: "Network error: please try again." };
  }
}

/** Builds categoryId → [itself, parent, …] from a flat list. */
export function buildAncestry(categories: CategoryNode[]): Map<string, string[]> {
  const parent = new Map(categories.map((c) => [c.id, c.parentId]));
  const out = new Map<string, string[]>();
  for (const c of categories) {
    const chain: string[] = [];
    let cur: string | null | undefined = c.id;
    let guard = 0;
    while (cur && guard++ < 50) {
      chain.push(cur);
      cur = parent.get(cur);
    }
    out.set(c.id, chain);
  }
  return out;
}

/** Flat list in tree order with depth, for indented pickers. */
export function flattenTree(categories: CategoryNode[]): (CategoryNode & { depth: number })[] {
  const byParent = new Map<string | null, CategoryNode[]>();
  for (const c of categories) {
    const key = c.parentId && categories.some((x) => x.id === c.parentId) ? c.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const out: (CategoryNode & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ ...c, depth });
      if (depth < 10) walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
