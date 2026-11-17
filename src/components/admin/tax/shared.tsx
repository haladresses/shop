"use client";
import { useCallback, useEffect, useState } from "react";
import type { RateInfo, TaxKind, TaxSettings } from "@/lib/taxCalc";

// Shared types / helpers for the Tax & VAT admin screens.

export type TaxRateRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  rate: number;
  type: TaxKind;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  categoryCount: number;
};

export type TaxSettingsResponse = TaxSettings & { defaultRate: RateInfo };

export const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    return await res.json();
  } catch {
    return { success: false, error: "Network error: please try again." };
  }
}

export function sendJson<T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) {
  return fetchJson<T>(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** VAT rates (all, or active only) with a reload function. */
export function useTaxRates(activeOnly = false) {
  const [rates, setRates] = useState<TaxRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const d = await fetchJson<TaxRateRow[]>(`/api/tax/rates${activeOnly ? "?active=true" : ""}`);
    if (d.success && d.data) setRates(d.data);
    setLoading(false);
  }, [activeOnly]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rates, loading, reload };
}

export function useTaxSettings() {
  const [settings, setSettings] = useState<TaxSettingsResponse | null>(null);
  const reload = useCallback(async () => {
    const d = await fetchJson<TaxSettingsResponse>("/api/tax/settings");
    if (d.success && d.data) setSettings(d.data);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { settings, setSettings, reload };
}

/** Store details printed on documents. */
export type StoreInfo = { store_name_en?: string; store_name_ar?: string; store_address?: string; store_phone?: string };

export function useStoreInfo() {
  const [info, setInfo] = useState<StoreInfo>({});
  useEffect(() => {
    fetchJson<StoreInfo>("/api/settings?group=general").then((d) => d.success && d.data && setInfo(d.data));
  }, []);
  return info;
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function TypeBadge({ type }: { type: TaxKind }) {
  const cls: Record<TaxKind, string> = {
    STANDARD: "bg-indigo-50 text-indigo-700",
    ZERO_RATED: "bg-sky-50 text-sky-700",
    EXEMPT: "bg-amber-50 text-amber-700",
    OUT_OF_SCOPE: "bg-slate-100 text-slate-600",
  };
  const label: Record<TaxKind, string> = { STANDARD: "Standard", ZERO_RATED: "Zero-rated", EXEMPT: "Exempt", OUT_OF_SCOPE: "Out of scope" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls[type]}`}>{label[type]}</span>;
}
