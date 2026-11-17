"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { LuPencil, LuPlus, LuStar, LuTrash2 } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { TAX_KIND_LABEL, TAX_KINDS, rateLabel, type TaxKind } from "@/lib/taxCalc";
import { sendJson, Toggle, TypeBadge, useTaxRates, type TaxRateRow } from "./shared";

type Draft = {
  id?: string;
  code: string;
  nameEn: string;
  nameAr: string;
  rate: string;
  type: TaxKind;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: string;
};

const blank: Draft = { code: "", nameEn: "", nameAr: "", rate: "5", type: "STANDARD", description: "", isDefault: false, isActive: true, sortOrder: "0" };

export default function TaxRatesTab({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
  const { rates, loading, reload } = useTaxRates(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const refresh = () => {
    reload();
    onChanged();
  };

  const open = (r?: TaxRateRow) => {
    setErr("");
    setDraft(
      r
        ? {
            id: r.id,
            code: r.code,
            nameEn: r.nameEn,
            nameAr: r.nameAr,
            rate: String(r.rate),
            type: r.type,
            description: r.description ?? "",
            isDefault: r.isDefault,
            isActive: r.isActive,
            sortOrder: String(r.sortOrder),
          }
        : { ...blank, sortOrder: String(rates.length) },
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setErr("");
    const body = {
      code: draft.code,
      nameEn: draft.nameEn,
      nameAr: draft.nameAr,
      rate: draft.type === "STANDARD" ? parseFloat(draft.rate) || 0 : 0,
      type: draft.type,
      description: draft.description || null,
      isDefault: draft.isDefault,
      isActive: draft.isActive,
      sortOrder: parseInt(draft.sortOrder) || 0,
    };
    const d = draft.id
      ? await sendJson(`/api/tax/rates/${draft.id}`, "PATCH", body)
      : await sendJson("/api/tax/rates", "POST", body);
    setSaving(false);
    if (!d.success) return setErr(d.error || "Could not save");
    toast.success(draft.id ? "Rate updated" : "Rate added");
    setDraft(null);
    refresh();
  };

  const patch = async (r: TaxRateRow, body: Record<string, unknown>, msg: string) => {
    const d = await sendJson(`/api/tax/rates/${r.id}`, "PATCH", body);
    if (!d.success) return toast.error(d.error || "Could not update");
    toast.success(msg);
    refresh();
  };

  const remove = async (r: TaxRateRow) => {
    if (!window.confirm(`Delete “${r.nameEn}”? Past invoices keep their own copy of the rate.`)) return;
    const d = await sendJson(`/api/tax/rates/${r.id}`, "DELETE");
    if (!d.success) return toast.error(d.error || "Could not delete", { duration: 6000 });
    toast.success("Rate deleted");
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-2xl">
          Oman: standard rate 5%; zero-rated supplies (e.g. exports, listed basic foods) are taxable at 0%; exempt supplies carry no VAT.
          The <strong>default</strong> rate applies to anything without its own rate, and to delivery fees.
        </p>
        {canManage && (
          <button onClick={() => open()} className="admin-btn admin-btn-primary">
            <LuPlus size={16} /> New rate
          </button>
        )}
      </div>

      <div className="admin-card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="spinner" />
          </div>
        ) : (
          <table className="admin-table min-w-[720px]">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Used by</th>
                <th className="text-center">Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className={r.isActive ? "" : "opacity-60"}>
                  <td className="font-mono font-semibold">{r.code}</td>
                  <td>
                    <p className="font-medium text-slate-800 flex items-center gap-1.5">
                      {r.nameEn}
                      {r.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-semibold">
                          <LuStar size={11} /> Default
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500" dir="rtl">
                      {r.nameAr}
                    </p>
                    {r.description && <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>}
                  </td>
                  <td>
                    <TypeBadge type={r.type} />
                  </td>
                  <td className="text-right font-semibold tabular-nums">{rateLabel(r)}</td>
                  <td className="text-right text-xs text-slate-500 whitespace-nowrap">
                    {r.productCount} product{r.productCount === 1 ? "" : "s"}
                    <br />
                    {r.categoryCount} categor{r.categoryCount === 1 ? "y" : "ies"}
                  </td>
                  <td className="text-center">
                    <span className="inline-flex">
                      <Toggle
                        checked={r.isActive}
                        disabled={!canManage || r.isDefault}
                        onChange={(v) => patch(r, { isActive: v }, v ? "Rate activated" : "Rate deactivated")}
                        label={`${r.nameEn} active`}
                      />
                    </span>
                  </td>
                  <td>
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        {!r.isDefault && r.isActive && (
                          <button
                            onClick={() => patch(r, { isDefault: true }, `${r.nameEn} is now the default`)}
                            className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            title="Make default"
                          >
                            <LuStar size={15} />
                          </button>
                        )}
                        <button onClick={() => open(r)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit">
                          <LuPencil size={15} />
                        </button>
                        {!r.isDefault && (
                          <button onClick={() => remove(r)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                            <LuTrash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No VAT rates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <AdminModal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit VAT rate" : "New VAT rate"}
        footer={
          <>
            <button onClick={() => setDraft(null)} className="admin-btn admin-btn-secondary">
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary">
              {saving ? "Saving…" : "Save rate"}
            </button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input
                  className="admin-input font-mono uppercase"
                  maxLength={10}
                  placeholder="S"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  className="admin-input admin-select"
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as TaxKind })}
                >
                  {TAX_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {TAX_KIND_LABEL[k].en}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">{TAX_KIND_LABEL[draft.type].hint}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name (English)</label>
                <input className="admin-input" placeholder="VAT 5%" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name (Arabic)</label>
                <input
                  className="admin-input"
                  dir="rtl"
                  placeholder="ضريبة القيمة المضافة 5%"
                  value={draft.nameAr}
                  onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate (%)</label>
                <input
                  className="admin-input text-right tabular-nums"
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  disabled={draft.type !== "STANDARD"}
                  value={draft.type === "STANDARD" ? draft.rate : "0"}
                  onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
                />
                {draft.type !== "STANDARD" && <p className="text-xs text-slate-400 mt-1">Always 0% for this type.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sort order</label>
                <input className="admin-input" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                className="admin-input"
                placeholder="When to use this rate"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="rounded" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
                Active
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="rounded" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked, isActive: e.target.checked || draft.isActive })} />
                Default rate (store-wide fallback &amp; delivery fees)
              </label>
            </div>
            {draft.id && (
              <p className="text-xs text-slate-400">Changing a rate only affects new sales. Past invoices keep the rate they were issued with.</p>
            )}
            {err && <p className="text-sm text-rose-600">{err}</p>}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
