"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toBusinessDateKey } from "@/lib/finance";
import type { StoreInfo } from "@/lib/invoice";
import { DEFAULT_TAX_SETTINGS, type TaxSettings } from "@/lib/taxCalc";
import Filters, { PRESETS, TABS, filterLabel, presetRange, rangeLabel, type FilterState, type Meta, type Preset, type Tab } from "@/components/admin/reports/Filters";
import { ReportContext } from "@/components/admin/reports/shared";
import SummaryTab from "@/components/admin/reports/SummaryTab";
import DaysTab from "@/components/admin/reports/DaysTab";
import SellersTab from "@/components/admin/reports/SellersTab";
import ReceiptsTab from "@/components/admin/reports/ReceiptsTab";
import PaymentsTab from "@/components/admin/reports/PaymentsTab";
import ProductsTab from "@/components/admin/reports/ProductsTab";
import CategoriesTab from "@/components/admin/reports/CategoriesTab";

// Sales Report — accountant-style tables only (no charts): daily summary,
// by day, salesperson, receipt, payment method, product and category. Every
// filter and the open tab live in the URL so a report can be bookmarked or
// shared.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Params that belong to one tab and are dropped when switching tabs.
const TAB_PARAMS = ["q", "page", "scope", "cat", "variants", "top"];

export default function SalesReportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <SalesReport />
    </Suspense>
  );
}

function SalesReport() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tab = (TABS.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "summary") as Tab;
  const preset = (PRESETS.some((p) => p.id === sp.get("preset")) ? sp.get("preset") : "today") as Preset;
  const today = toBusinessDateKey(new Date());
  const range =
    preset === "custom"
      ? {
          from: DATE_RE.test(sp.get("from") || "") ? sp.get("from")! : today,
          to: DATE_RE.test(sp.get("to") || "") ? sp.get("to")! : today,
        }
      : presetRange(preset, today);
  const filters: FilterState = {
    preset,
    from: range.from,
    to: range.to < range.from ? range.from : range.to,
    channel: sp.get("channel") || "",
    seller: sp.get("seller") || "",
    method: sp.get("method") || "",
    shift: sp.get("shift") || "",
  };

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      // Only custom ranges need explicit dates in the URL.
      if (next.get("preset") !== "custom") {
        next.delete("from");
        next.delete("to");
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  const changeFilters = (patch: Partial<FilterState>) => {
    const p: Record<string, string | undefined> = { page: undefined };
    if (patch.preset && patch.preset !== "custom") {
      // A named period: its dates are worked out from today on every visit.
      p.preset = patch.preset === "today" ? undefined : patch.preset;
    } else if (patch.preset === "custom" || patch.from !== undefined || patch.to !== undefined) {
      p.preset = "custom";
      p.from = patch.from ?? filters.from;
      p.to = patch.to ?? filters.to;
      if (p.from && p.to && p.to < p.from) p.to = p.from;
    }
    for (const k of ["channel", "seller", "method", "shift"] as const) if (patch[k] !== undefined) p[k] = patch[k] || undefined;
    setParams(p);
  };

  const switchTab = (t: Tab, extra: Record<string, string | undefined> = {}) => {
    const p: Record<string, string | undefined> = { tab: t === "summary" ? undefined : t };
    for (const k of TAB_PARAMS) p[k] = undefined;
    setParams({ ...p, ...extra });
  };

  // Query string the report APIs share.
  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.channel) q.set("channel", filters.channel);
    if (filters.seller) q.set("seller", filters.seller);
    if (filters.method) q.set("method", filters.method);
    if (filters.shift) q.set("shift", filters.shift);
    return q.toString();
  }, [filters.from, filters.to, filters.channel, filters.seller, filters.method, filters.shift]);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [store, setStore] = useState<StoreInfo>({});
  const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);
  useEffect(() => {
    fetch("/api/settings?group=general").then((r) => r.json()).then((d) => d.success && setStore(d.data)).catch(() => {});
    fetch("/api/tax/settings").then((r) => r.json()).then((d) => d.success && setTax(d.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/reports/sales/meta?from=${filters.from}&to=${filters.to}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => d.success && setMeta(d.data))
      .catch(() => {});
    return () => ctrl.abort();
  }, [filters.from, filters.to]);

  const ctx = useMemo(
    () => ({
      store,
      tax,
      rangeLabel: rangeLabel(filters.from, filters.to),
      filterLabel: filterLabel(filters, meta),
      fileStem: `sales-${filters.from === filters.to ? filters.from : `${filters.from}_${filters.to}`}`,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, tax, filters.from, filters.to, filters.channel, filters.seller, filters.method, filters.shift, meta],
  );

  const onTabChange = useCallback((patch: Record<string, string | undefined>) => setParams(patch), [setParams]);

  return (
    <ReportContext value={ctx}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">
              Sales Report <span className="text-base font-normal text-slate-400" dir="rtl">تقرير المبيعات</span>
            </h1>
            <p className="text-sm text-slate-500">
              {ctx.rangeLabel}
              {ctx.filterLabel && ` · ${ctx.filterLabel}`}
            </p>
          </div>
          <p className="text-xs text-slate-400 max-w-md">
            A sale counts when paid (or later refunded), on the day it was made; refunds count on the day they were given. Same rules as Finance.
          </p>
        </div>

        <Filters f={filters} meta={meta} onChange={changeFilters} />

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 -mx-1 px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`shrink-0 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.id ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "summary" && <SummaryTab query={apiQuery} single={filters.from === filters.to} />}
        {tab === "days" && <DaysTab query={apiQuery} />}
        {tab === "sellers" && <SellersTab query={apiQuery} onOpenReceipts={(id) => switchTab("receipts", { seller: id })} />}
        {tab === "receipts" && (
          <ReceiptsTab
            query={apiQuery}
            search={sp.get("q") || ""}
            page={Math.max(1, parseInt(sp.get("page") || "1") || 1)}
            scope={sp.get("scope") || ""}
            onChange={onTabChange}
          />
        )}
        {tab === "payments" && <PaymentsTab query={apiQuery} />}
        {tab === "products" && (
          <ProductsTab
            query={apiQuery}
            meta={meta}
            categoryId={sp.get("cat") || ""}
            variants={sp.get("variants") === "1"}
            search={sp.get("q") || ""}
            top={sp.get("top") || ""}
            onChange={onTabChange}
          />
        )}
        {tab === "categories" && <CategoriesTab query={apiQuery} onOpenCategory={(id) => switchTab("products", { cat: id })} />}
      </div>
    </ReportContext>
  );
}
