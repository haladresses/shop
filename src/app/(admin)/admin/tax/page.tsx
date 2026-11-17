"use client";
import { useEffect, useState } from "react";
import { LuChartColumn, LuFolderTree, LuListOrdered, LuSettings2, LuShieldCheck, LuShieldOff } from "react-icons/lu";
import { rateLabel } from "@/lib/taxCalc";
import TaxSettingsTab from "@/components/admin/tax/TaxSettingsTab";
import TaxRatesTab from "@/components/admin/tax/TaxRatesTab";
import TaxAssignmentTab from "@/components/admin/tax/TaxAssignmentTab";
import VatReportTab from "@/components/admin/tax/VatReportTab";
import { useTaxSettings } from "@/components/admin/tax/shared";

type Tab = "settings" | "rates" | "assign" | "report";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "settings", label: "Settings", icon: LuSettings2 },
  { id: "rates", label: "VAT rates", icon: LuListOrdered },
  { id: "assign", label: "Products & categories", icon: LuFolderTree },
  { id: "report", label: "VAT report", icon: LuChartColumn },
];

export default function TaxPage() {
  const [tab, setTab] = useState<Tab>("settings");
  const [canManage, setCanManage] = useState(false);
  const { settings, setSettings, reload } = useTaxSettings();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q && TABS.some((t) => t.id === q)) setTab(q as Tab);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCanManage(!!d.data?.permissions?.includes("admin.tax.manage")))
      .catch(() => {});
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  const on = !!settings?.enabled;

  return (
    <div className="space-y-5">
      {settings && (
        <div
          className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
            on ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
          }`}
        >
          <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${on ? "bg-emerald-500 text-white" : "bg-amber-400 text-white"}`}>
            {on ? <LuShieldCheck size={22} /> : <LuShieldOff size={22} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`font-semibold ${on ? "text-emerald-900" : "text-amber-900"}`}>
              {on ? "VAT is on" : "VAT is off"}
            </p>
            <p className={`text-sm ${on ? "text-emerald-800/80" : "text-amber-800/80"}`}>
              {on
                ? `Charged on every sale (online and POS) at ${settings.defaultRate.nameEn} (${rateLabel(settings.defaultRate)}) unless a product or category says otherwise. Prices ${
                    settings.pricesIncludeTax ? "already include VAT" : "are shown before VAT. VAT is added at checkout"
                  }.`
                : "No VAT is added to sales and invoices don't show VAT. Set up your rates and VAT number, then switch it on in Settings."}
            </p>
          </div>
          {on && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs shrink-0">
              <dt className="text-emerald-800/70">VAT number</dt>
              <dd className="font-mono font-semibold text-emerald-900">{settings.vatNumber || "Not set"}</dd>
              <dt className="text-emerald-800/70">Prices</dt>
              <dd className="font-semibold text-emerald-900">{settings.pricesIncludeTax ? "Incl. VAT" : "Excl. VAT"}</dd>
            </dl>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => pick(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              tab === id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "settings" && settings && (
        <TaxSettingsTab settings={settings} canManage={canManage} onSaved={(s) => setSettings(s)} />
      )}
      {tab === "settings" && !settings && (
        <div className="flex justify-center py-16">
          <span className="spinner" />
        </div>
      )}
      {tab === "rates" && <TaxRatesTab canManage={canManage} onChanged={reload} />}
      {tab === "assign" && <TaxAssignmentTab canManage={canManage} />}
      {tab === "report" && <VatReportTab />}
    </div>
  );
}
