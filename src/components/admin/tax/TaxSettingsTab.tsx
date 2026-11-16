"use client";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { LuCircleAlert, LuFileText, LuLandmark, LuReceiptText, LuSave, LuStore, LuTruck } from "react-icons/lu";
import { isValidOmanVatNumber, rateLabel, splitTax, type TaxSettings } from "@/lib/taxCalc";
import { money, sendJson, Toggle, type TaxSettingsResponse } from "./shared";

const pick = (s: TaxSettingsResponse): TaxSettings => ({
  enabled: s.enabled,
  pricesIncludeTax: s.pricesIncludeTax,
  vatNumber: s.vatNumber,
  legalNameEn: s.legalNameEn,
  legalNameAr: s.legalNameAr,
  crNumber: s.crNumber,
  taxShipping: s.taxShipping,
  showOnStorefront: s.showOnStorefront,
  invoiceFooterEn: s.invoiceFooterEn,
  invoiceFooterAr: s.invoiceFooterAr,
});

function Section({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="admin-card p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
          <Icon size={18} />
        </span>
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function SwitchRow({ title, desc, checked, onChange, disabled }: { title: string; desc: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}

export default function TaxSettingsTab({
  settings,
  canManage,
  onSaved,
}: {
  settings: TaxSettingsResponse;
  canManage: boolean;
  onSaved: (s: TaxSettingsResponse) => void;
}) {
  const [form, setForm] = useState<TaxSettings>(() => pick(settings));
  const [saving, setSaving] = useState(false);
  const [samplePrice, setSamplePrice] = useState("10.500");
  const set = <K extends keyof TaxSettings>(k: K, v: TaxSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(pick(settings)), [form, settings]);
  const vatOk = isValidOmanVatNumber(form.vatNumber.trim());
  const rate = settings.defaultRate;
  const sample = parseFloat(samplePrice) || 0;
  const ex = splitTax(sample, rate.rate, form.pricesIncludeTax);
  const ro = !canManage;

  const save = async () => {
    if (!vatOk) return toast.error("VAT number must be OM followed by 10 digits");
    if (form.enabled && !form.vatNumber.trim()) {
      if (!window.confirm("VAT is being switched on without a VAT number. Tax invoices must show it. Save anyway?")) return;
    }
    setSaving(true);
    const d = await sendJson<TaxSettingsResponse>("/api/tax/settings", "PUT", form);
    setSaving(false);
    if (!d.success || !d.data) return toast.error(d.error || "Could not save");
    onSaved(d.data);
    setForm(pick(d.data));
    toast.success("Tax settings saved");
  };

  return (
    <div className="space-y-5 pb-20">
      {ro && (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          You can view these settings. Changing them needs the “Manage Tax &amp; VAT” permission.
        </p>
      )}

      <Section icon={LuLandmark} title="VAT" desc="The master switch and how your prices are entered.">
        <div className="divide-y divide-slate-100">
          <SwitchRow
            title="Charge VAT"
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
            disabled={ro}
            desc={
              <ul className="list-disc pl-4 space-y-0.5 mt-1">
                <li>Every new sale (online &amp; POS) records VAT per line, using each product&apos;s rate.</li>
                <li>Receipts and invoices become bilingual tax invoices with your VAT number and a VAT breakdown.</li>
                <li>VAT on supplier invoices becomes reclaimable input VAT (it is no longer added to stock cost).</li>
                <li>Finance reports show revenue excluding VAT. Past orders are never changed.</li>
              </ul>
            }
          />
          <SwitchRow
            title="My prices include VAT"
            checked={form.pricesIncludeTax}
            onChange={(v) => set("pricesIncludeTax", v)}
            disabled={ro}
            desc={
              form.pricesIncludeTax
                ? "Recommended for retail. The price on the tag is what customers pay; VAT is worked out inside it."
                : "Prices are before VAT. VAT is added on top at checkout and at the POS, so totals are higher than the shelf price."
            }
          />
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Example: shelf price</span>
            <input
              className="admin-input !w-28 !py-1 text-right tabular-nums"
              type="number"
              min="0"
              step="0.001"
              value={samplePrice}
              onChange={(e) => setSamplePrice(e.target.value)}
              aria-label="Example shelf price"
            />
            <span className="text-slate-500">
              OMR at {rate.nameEn} ({rateLabel(rate)})
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-800">
            {form.pricesIncludeTax ? (
              <>
                Customer pays <strong>{money(sample)}</strong> → VAT <strong>{money(ex.tax)}</strong>, your net revenue{" "}
                <strong>{money(ex.taxable)}</strong>
              </>
            ) : (
              <>
                {money(sample)} <strong>+ {money(ex.tax)} VAT</strong> → customer pays <strong>{money(ex.taxable + ex.tax)}</strong>
              </>
            )}
          </p>
        </div>
      </Section>

      <Section icon={LuFileText} title="Registration details" desc="Printed on every tax invoice, receipt and the VAT report.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">VAT registration number (VATIN)</label>
            <input
              className={`admin-input font-mono uppercase ${!vatOk ? "!border-rose-300" : ""}`}
              placeholder="OM1234567890"
              value={form.vatNumber}
              disabled={ro}
              onChange={(e) => set("vatNumber", e.target.value.toUpperCase())}
            />
            <p className={`text-xs mt-1 ${vatOk ? "text-slate-400" : "text-rose-600"}`}>
              {vatOk ? "Format: OM followed by 10 digits." : "Must be OM followed by exactly 10 digits."}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Commercial registration (CR) number</label>
            <input className="admin-input font-mono" value={form.crNumber} disabled={ro} onChange={(e) => set("crNumber", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Legal name (English)</label>
            <input
              className="admin-input"
              placeholder="Leave blank to use the store name"
              value={form.legalNameEn}
              disabled={ro}
              onChange={(e) => set("legalNameEn", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Legal name (Arabic)</label>
            <input
              className="admin-input"
              dir="rtl"
              placeholder="اتركه فارغاً لاستخدام اسم المتجر"
              value={form.legalNameAr}
              disabled={ro}
              onChange={(e) => set("legalNameAr", e.target.value)}
            />
          </div>
        </div>
        {form.enabled && !form.vatNumber.trim() && (
          <p className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <LuCircleAlert size={14} /> VAT is on but no VAT number is set. Invoices will be printed without it.
          </p>
        )}
      </Section>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section icon={LuTruck} title="Delivery fees">
          <SwitchRow
            title="Charge VAT on delivery fees"
            checked={form.taxShipping}
            onChange={(v) => set("taxShipping", v)}
            disabled={ro}
            desc={`Delivery is taxed at the default rate (${rate.nameEn}, ${rateLabel(rate)}).`}
          />
        </Section>
        <Section icon={LuStore} title="Storefront">
          <SwitchRow
            title="Show VAT to shoppers"
            checked={form.showOnStorefront}
            onChange={(v) => set("showOnStorefront", v)}
            disabled={ro}
            desc="Shows “incl. VAT” notes and the VAT line in the cart and checkout."
          />
        </Section>
      </div>

      <Section icon={LuReceiptText} title="Invoice footer" desc="Printed at the bottom of every customer bill. E.g. your returns policy.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">English</label>
            <textarea
              className="admin-input"
              rows={3}
              maxLength={500}
              placeholder="Exchanges within 7 days with this receipt."
              value={form.invoiceFooterEn}
              disabled={ro}
              onChange={(e) => set("invoiceFooterEn", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Arabic</label>
            <textarea
              className="admin-input"
              dir="rtl"
              rows={3}
              maxLength={500}
              placeholder="الاستبدال خلال 7 أيام مع هذه الفاتورة."
              value={form.invoiceFooterAr}
              disabled={ro}
              onChange={(e) => set("invoiceFooterAr", e.target.value)}
            />
          </div>
        </div>
      </Section>

      {canManage && dirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl admin-slide-up">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl">
            <span className="text-sm">You have unsaved changes</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(pick(settings))} className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white">
                Discard
              </button>
              <button type="button" onClick={save} disabled={saving} className="admin-btn admin-btn-primary">
                <LuSave size={15} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
