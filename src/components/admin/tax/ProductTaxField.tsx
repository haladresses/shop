"use client";
import { useMemo } from "react";
import Link from "next/link";
import { LuInfo, LuPercent } from "react-icons/lu";
import { rateLabel, splitTax, type RateInfo } from "@/lib/taxCalc";
import { money, useTaxRates, useTaxSettings, type TaxRateRow } from "./shared";

type CategoryLike = { id: string; nameEn: string; parentId?: string | null; taxRateId?: string | null };

const toInfo = (r: TaxRateRow): RateInfo => ({ id: r.id, code: r.code, nameEn: r.nameEn, nameAr: r.nameAr, rate: r.rate, type: r.type });

/**
 * VAT rate picker for the product editor: "inherit from category" (showing
 * what that resolves to) or a specific rate, with a live price breakdown.
 */
export default function ProductTaxField({
  value,
  onChange,
  categoryId,
  categories,
  price,
  disabled,
}: {
  /** "" = inherit. */
  value: string;
  onChange: (taxRateId: string) => void;
  categoryId: string;
  categories: CategoryLike[];
  /** Selling price as typed (sale price if set). */
  price: string;
  disabled?: boolean;
}) {
  const { rates } = useTaxRates(true);
  const { settings } = useTaxSettings();

  const inherited = useMemo((): { rate: RateInfo | null; from: string } => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const rateById = new Map(rates.map((r) => [r.id, r]));
    let cur = categoryId ? byId.get(categoryId) : undefined;
    let guard = 0;
    while (cur && guard++ < 50) {
      const r = cur.taxRateId ? rateById.get(cur.taxRateId) : undefined;
      if (r) return { rate: toInfo(r), from: `category “${cur.nameEn}”` };
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return { rate: settings?.defaultRate ?? null, from: "the store default" };
  }, [categories, categoryId, rates, settings]);

  const chosen = value ? rates.find((r) => r.id === value) : undefined;
  // A product pointing at a rate that was since deactivated still shows it.
  const missing = value && !chosen;
  const effective: RateInfo | null = chosen ? toInfo(chosen) : inherited.rate;

  const p = parseFloat(price);
  const enabled = !!settings?.enabled;
  const inclusive = settings?.pricesIncludeTax ?? true;
  const split = effective && p > 0 ? splitTax(p, effective.rate, inclusive) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700" htmlFor="product-tax-rate">
          <LuPercent size={15} className="text-teal-600" /> VAT rate
        </label>
        {!enabled && settings && (
          <span className="text-[11px] font-medium rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">
            VAT is switched off. Applies once it is enabled
          </span>
        )}
      </div>
      <select
        id="product-tax-rate"
        className="admin-input admin-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          Inherit{inherited.rate ? `: ${inherited.rate.nameEn} (${rateLabel(inherited.rate)}) from ${inherited.from}` : ""}
        </option>
        {rates.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nameEn} · {rateLabel(r)} {r.isDefault ? "(default)" : ""}
          </option>
        ))}
        {missing && <option value={value}>Inactive rate (choose another)</option>}
      </select>

      {split && effective && (
        <p className="text-xs text-slate-600 leading-relaxed">
          {effective.rate <= 0 ? (
            <>No VAT is charged on this product ({rateLabel(effective)}).</>
          ) : inclusive ? (
            <>
              Customer pays <strong>{money(p)} OMR</strong> · includes VAT <strong>{money(split.tax)}</strong> · your net revenue{" "}
              <strong>{money(split.taxable)}</strong>
            </>
          ) : (
            <>
              Shelf price <strong>{money(p)} OMR</strong> + VAT <strong>{money(split.tax)}</strong> = customer pays{" "}
              <strong>{money(split.taxable + split.tax)} OMR</strong> at checkout
            </>
          )}
        </p>
      )}
      <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
        <LuInfo size={12} className="mt-0.5 shrink-0" />
        <span>
          Order of precedence: this product → its category → parent categories → store default.{" "}
          <Link href="/admin/tax?tab=assign" className="text-indigo-600 hover:underline" target="_blank">
            Manage rates by category
          </Link>
        </span>
      </p>
    </div>
  );
}
