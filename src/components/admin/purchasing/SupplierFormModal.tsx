"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LuStar } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { Field, api } from "./shared";

export type SupplierFormValue = {
  id?: string;
  code?: string;
  nameEn: string;
  nameAr: string;
  category: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  city: string;
  country: string;
  vatNumber: string;
  crNumber: string;
  paymentTermsDays: string;
  creditLimit: string;
  openingBalance: string;
  bankName: string;
  bankAccountName: string;
  iban: string;
  rating: number | null;
  notes: string;
  isActive: boolean;
};

export const EMPTY_SUPPLIER: SupplierFormValue = {
  nameEn: "",
  nameAr: "",
  category: "",
  contactPerson: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  address: "",
  city: "",
  country: "OM",
  vatNumber: "",
  crNumber: "",
  paymentTermsDays: "0",
  creditLimit: "",
  openingBalance: "0",
  bankName: "",
  bankAccountName: "",
  iban: "",
  rating: null,
  notes: "",
  isActive: true,
};

type SupplierLike = Partial<Record<keyof SupplierFormValue, unknown>> & { id?: string };

/** Fills the form from an API supplier object. */
export function supplierToForm(s: SupplierLike): SupplierFormValue {
  const str = (v: unknown) => (v == null ? "" : String(v));
  return {
    id: s.id,
    code: str(s.code),
    nameEn: str(s.nameEn),
    nameAr: str(s.nameAr),
    category: str(s.category),
    contactPerson: str(s.contactPerson),
    phone: str(s.phone),
    whatsapp: str(s.whatsapp),
    email: str(s.email),
    website: str(s.website),
    address: str(s.address),
    city: str(s.city),
    country: str(s.country) || "OM",
    vatNumber: str(s.vatNumber),
    crNumber: str(s.crNumber),
    paymentTermsDays: str(s.paymentTermsDays ?? 0),
    creditLimit: str(s.creditLimit),
    openingBalance: str(s.openingBalance ?? 0),
    bankName: str(s.bankName),
    bankAccountName: str(s.bankAccountName),
    iban: str(s.iban),
    rating: typeof s.rating === "number" ? s.rating : null,
    notes: str(s.notes),
    isActive: s.isActive !== false,
  };
}

const TERMS = [
  { days: 0, label: "Cash on delivery" },
  { days: 7, label: "Net 7" },
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
  { days: 90, label: "Net 90" },
];

export default function SupplierFormModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: SupplierFormValue | null;
  onSaved: (supplier: { id: string; nameEn: string; code: string }) => void;
}) {
  const [f, setF] = useState<SupplierFormValue>(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const editing = !!initial?.id;

  useEffect(() => {
    if (open) {
      setF(initial ?? EMPTY_SUPPLIER);
      setErr("");
    }
  }, [open, initial]);

  const set = <K extends keyof SupplierFormValue>(k: K, v: SupplierFormValue[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (f.nameEn.trim().length < 2) return setErr("Supplier name is required.");
    setSaving(true);
    setErr("");
    const body = {
      nameEn: f.nameEn.trim(),
      nameAr: f.nameAr,
      category: f.category,
      contactPerson: f.contactPerson,
      phone: f.phone,
      whatsapp: f.whatsapp,
      email: f.email,
      website: f.website,
      address: f.address,
      city: f.city,
      country: (f.country || "OM").toUpperCase(),
      vatNumber: f.vatNumber,
      crNumber: f.crNumber,
      paymentTermsDays: parseInt(f.paymentTermsDays) || 0,
      creditLimit: f.creditLimit === "" ? null : parseFloat(f.creditLimit) || 0,
      openingBalance: parseFloat(f.openingBalance) || 0,
      bankName: f.bankName,
      bankAccountName: f.bankAccountName,
      iban: f.iban,
      rating: f.rating,
      notes: f.notes,
      isActive: f.isActive,
    };
    const d = await api<{ id: string; nameEn: string; code: string }>(editing ? `/api/suppliers/${f.id}` : "/api/suppliers", {
      method: editing ? "PATCH" : "POST",
      body,
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not save the supplier.");
    toast.success(editing ? "Supplier updated" : `Supplier ${d.data.code} created`);
    onSaved(d.data);
    onClose();
  };

  const text = (k: keyof SupplierFormValue, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className="admin-input" value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} {...props} />
  );

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={editing ? `Edit supplier · ${f.code}` : "New supplier"}
      className="!max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="admin-btn admin-btn-primary">
            {saving ? "Saving…" : editing ? "Save changes" : "Create supplier"}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <Section title="Supplier">
          <Field label="Name (English) *">{text("nameEn", { autoFocus: true, placeholder: "e.g. Al Noor Textiles LLC" })}</Field>
          <Field label="Name (Arabic)">{text("nameAr", { dir: "rtl", placeholder: "مثال: النور للأقمشة" })}</Field>
          <Field label="What they supply" hint="Used to group and search suppliers">{text("category", { placeholder: "Fabrics, Abayas, Packaging…" })}</Field>
          <Field label="Rating">
            <div className="flex items-center gap-1 h-[38px]">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => set("rating", f.rating === n ? null : n)} className="p-0.5" aria-label={`${n} star`}>
                  <LuStar size={22} className={f.rating != null && n <= f.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                </button>
              ))}
              {f.rating != null && <span className="text-xs text-slate-400 ml-1">{f.rating}/5</span>}
            </div>
          </Field>
        </Section>

        <Section title="Contact">
          <Field label="Contact person">{text("contactPerson")}</Field>
          <Field label="Phone">{text("phone", { inputMode: "tel", placeholder: "+968 …" })}</Field>
          <Field label="WhatsApp" hint="Leave empty to use the phone number">{text("whatsapp", { inputMode: "tel" })}</Field>
          <Field label="Email">{text("email", { type: "email" })}</Field>
          <Field label="Website">{text("website", { placeholder: "https://" })}</Field>
          <Field label="City">{text("city")}</Field>
          <Field label="Country code" hint="OM, AE, CN, TR, IN …">{text("country", { maxLength: 3 })}</Field>
          <Field label="Address" className="sm:col-span-2">
            <textarea className="admin-input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </Section>

        <Section title="Tax & registration">
          <Field label="VAT number" hint="Needed to reclaim the VAT on their invoices">{text("vatNumber", { placeholder: "OM1100…" })}</Field>
          <Field label="Commercial registration (CR)">{text("crNumber")}</Field>
        </Section>

        <Section title="Terms & balance">
          <Field label="Payment terms" hint="When their invoices fall due after delivery">
            <div className="flex gap-2">
              <select className="admin-input admin-select" value={TERMS.some((t) => String(t.days) === f.paymentTermsDays) ? f.paymentTermsDays : "custom"} onChange={(e) => e.target.value !== "custom" && set("paymentTermsDays", e.target.value)}>
                {TERMS.map((t) => (
                  <option key={t.days} value={t.days}>{t.label}</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              <input type="number" min="0" max="365" className="admin-input !w-24 text-right" value={f.paymentTermsDays} onChange={(e) => set("paymentTermsDays", e.target.value)} aria-label="Days" />
            </div>
          </Field>
          <Field label="Credit limit (OMR)" hint="Warns when what you owe goes above it">{text("creditLimit", { type: "number", min: 0, step: "0.001", placeholder: "No limit" })}</Field>
          <Field label="Opening balance (OMR)" hint="What you already owed them before using this system (negative = they owe you)">
            {text("openingBalance", { type: "number", step: "0.001" })}
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 h-[38px] text-sm text-slate-700">
              <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} className="rounded" />
              Active: can be used on new purchase orders
            </label>
          </Field>
        </Section>

        <Section title="Bank details">
          <Field label="Bank">{text("bankName")}</Field>
          <Field label="Account name">{text("bankAccountName")}</Field>
          <Field label="IBAN / account no." className="sm:col-span-2">{text("iban", { className: "admin-input font-mono" })}</Field>
        </Section>

        <Field label="Internal notes">
          <textarea className="admin-input" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Minimum order, delivery days, quality notes…" />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</h4>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}
