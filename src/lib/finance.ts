import { z } from "zod";

// Shared helpers for the finance & accounting reports.
//
// All bucketing happens in the shop's own timezone (Oman has no DST), so a
// "day", "week", "month" or "year" means the same thing regardless of where
// the server is deployed.

export const BUSINESS_TZ = "Asia/Muscat";
export const BUSINESS_TZ_OFFSET = "+04:00";

export type Granularity = "day" | "week" | "month" | "year";
export const GRANULARITIES: Granularity[] = ["day", "week", "month", "year"];

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Utilities",
  "Marketing",
  "Shipping",
  "Packaging",
  "Supplies",
  "Maintenance",
  "Fees & Commissions",
  "Taxes",
  "Other",
] as const;

/** Formats an instant as a YYYY-MM-DD calendar day in the shop's timezone. */
export function toBusinessDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Start of a business calendar day (YYYY-MM-DD) as a UTC instant. */
export function businessDayStart(key: string): Date {
  return new Date(`${key}T00:00:00.000${BUSINESS_TZ_OFFSET}`);
}

/** End of a business calendar day (YYYY-MM-DD) as a UTC instant. */
export function businessDayEnd(key: string): Date {
  return new Date(`${key}T23:59:59.999${BUSINESS_TZ_OFFSET}`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(v: string | null | undefined): v is string {
  return !!v && DATE_RE.test(v);
}

/** Adds whole days to a YYYY-MM-DD key (calendar arithmetic, no TZ drift). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  const a = Date.parse(`${fromKey}T00:00:00Z`);
  const b = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** The bucket a calendar day belongs to, keyed by the bucket's first day. */
export function bucketKey(dayKey: string, g: Granularity): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (g === "day") return dayKey;
  if (g === "month") return `${y}-${String(m).padStart(2, "0")}-01`;
  if (g === "year") return `${y}-01-01`;
  // ISO week — Monday start (matches Postgres date_trunc('week')).
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = Monday
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

/** Every bucket key from `from` to `to` (inclusive), so charts have no gaps. */
export function enumerateBuckets(fromKey: string, toKey: string, g: Granularity): string[] {
  const keys: string[] = [];
  let cursor = bucketKey(fromKey, g);
  const last = bucketKey(toKey, g);
  let guard = 0;
  while (cursor <= last && guard++ < 5000) {
    keys.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    if (g === "day") cursor = addDays(cursor, 1);
    else if (g === "week") cursor = addDays(cursor, 7);
    else if (g === "month") cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    else cursor = `${y + 1}-01-01`;
  }
  return keys;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export const omr = (n: number) => `${n.toFixed(3)} OMR`;

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(60),
  amount: z.number().positive("Amount must be greater than zero"),
  description: z.string().trim().max(500).optional().nullable(),
  paymentMethod: z.string().trim().max(30).default("CASH"),
  reference: z.string().trim().max(100).optional().nullable(),
  date: z.string().regex(DATE_RE, "Invalid date"),
});

/** Expense dates are business calendar days; stored at local noon so they never drift a day. */
export const expenseDate = (key: string) => new Date(`${key}T12:00:00.000${BUSINESS_TZ_OFFSET}`);
