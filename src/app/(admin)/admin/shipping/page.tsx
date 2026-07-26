"use client";
import { useEffect, useState, useCallback } from "react";
import { LuCheck, LuPencil, LuTrash2, LuPlus } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

type Branch = {
  id: string;
  cityEn: string;
  cityAr: string;
  regionEn: string;
  regionAr: string;
  phone: string;
  homeDeliveryCost: number;
  officePickupCost: number;
  isActive: boolean;
  sortOrder: number;
};

type Rate = {
  id: string;
  countryEn: string;
  countryAr: string;
  countryCode: string;
  baseWeightKg: number;
  baseCost: number;
  additionalKgCost: number;
  isActive: boolean;
  sortOrder: number;
};

type WaselleeSettings = {
  isNotifyEnabled: boolean;
  companyNameEn: string;
  companyNameAr: string;
  brandNameEn: string;
  website: string | null;
  instagram: string | null;
  bousherOfficePhone: string;
  bousherContactPhone: string | null;
  bousherDriverPhone: string | null;
  notifyChatId: string | null;
  wahaBaseUrl: string | null;
  wahaApiKey: string | null;
  wahaSession: string;
};

const emptyBranchForm = {
  cityEn: "",
  cityAr: "",
  regionEn: "",
  regionAr: "",
  phone: "",
  homeDeliveryCost: "",
  officePickupCost: "",
  isActive: true,
  sortOrder: "0",
};

const emptyRateForm = {
  countryEn: "",
  countryAr: "",
  countryCode: "",
  baseWeightKg: "1",
  baseCost: "",
  additionalKgCost: "",
  isActive: true,
  sortOrder: "0",
};

const omr = (v: number | string) => `${Number(v).toFixed(3)} OMR`;

const TABS = ["branches", "international", "whatsapp"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  branches: "Wasellee Branches",
  international: "International Rates",
  whatsapp: "WhatsApp (WAHA)",
};

export default function ShippingPage() {
  const [tab, setTab] = useState<Tab>("branches");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "branches" && <BranchesTab />}
      {tab === "international" && <RatesTab />}
      {tab === "whatsapp" && <WhatsAppTab />}
    </div>
  );
}

function BranchesTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyBranchForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/wasellee/branches");
    const data = await res.json();
    if (data.success) setBranches(data.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyBranchForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      cityEn: b.cityEn,
      cityAr: b.cityAr,
      regionEn: b.regionEn,
      regionAr: b.regionAr,
      phone: b.phone,
      homeDeliveryCost: String(b.homeDeliveryCost),
      officePickupCost: String(b.officePickupCost),
      isActive: b.isActive,
      sortOrder: String(b.sortOrder),
    });
    setError("");
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      cityEn: form.cityEn,
      cityAr: form.cityAr,
      regionEn: form.regionEn,
      regionAr: form.regionAr,
      phone: form.phone,
      homeDeliveryCost: parseFloat(form.homeDeliveryCost) || 0,
      officePickupCost: parseFloat(form.officePickupCost) || 0,
      isActive: form.isActive,
      sortOrder: parseInt(form.sortOrder) || 0,
    };
    const res = await fetch(editing ? `/api/wasellee/branches/${editing.id}` : "/api/wasellee/branches", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      setError(data.error);
    } else {
      setShowModal(false);
      load();
    }
    setSaving(false);
  };

  const remove = async (b: Branch) => {
    if (!confirm(`Delete branch "${b.cityEn}"? Orders already using it are unaffected.`)) return;
    const res = await fetch(`/api/wasellee/branches/${b.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) load();
    else alert(data.error || "Could not delete this branch (it may be used by existing orders).");
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2.5">
        Prices are assumed in OMR — confirm the real domestic rates with Wasellee and adjust each branch here.
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{branches.length} branches</span>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          <LuPlus size={15} /> Add Branch
        </button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th>Region</th>
                  <th>Phone</th>
                  <th className="text-right">Home Delivery</th>
                  <th className="text-right">Office Pickup</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.cityEn} <span className="text-slate-400">/ {b.cityAr}</span></td>
                    <td className="text-slate-500">{b.regionEn}</td>
                    <td className="font-mono text-slate-600">{b.phone}</td>
                    <td className="text-right">{omr(b.homeDeliveryCost)}</td>
                    <td className="text-right">{omr(b.officePickupCost)}</td>
                    <td>
                      <span className={`badge ${b.isActive ? "badge-delivered" : "badge-cancelled"}`}>
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(b)} className="admin-btn admin-btn-secondary text-xs py-1"><LuPencil size={13} /></button>
                        <button onClick={() => remove(b)} className="admin-btn admin-btn-secondary text-xs py-1 text-red-600 hover:bg-red-50"><LuTrash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No branches yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AdminModal
          open={showModal}
          onClose={() => setShowModal(false)}
          className="!max-w-lg"
          title={editing ? "Edit Branch" : "Add Branch"}
          footer={
            <>
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Cancel</button>
              <button type="submit" form="branch-form" disabled={saving} className="admin-btn admin-btn-primary justify-center">
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Branch"}
              </button>
            </>
          }
        >
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
          <form id="branch-form" onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City (English) *</label>
                <input className="admin-input" value={form.cityEn} onChange={(e) => setForm({ ...form, cityEn: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City (Arabic) *</label>
                <input className="admin-input" dir="rtl" value={form.cityAr} onChange={(e) => setForm({ ...form, cityAr: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region (English) *</label>
                <input className="admin-input" value={form.regionEn} onChange={(e) => setForm({ ...form, regionEn: e.target.value })} placeholder="Muscat" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region (Arabic) *</label>
                <input className="admin-input" dir="rtl" value={form.regionAr} onChange={(e) => setForm({ ...form, regionAr: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch Phone *</label>
              <input className="admin-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="74186126" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Home Delivery Cost (OMR) *</label>
                <input type="number" step="0.001" min="0" className="admin-input" value={form.homeDeliveryCost} onChange={(e) => setForm({ ...form, homeDeliveryCost: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Office Pickup Cost (OMR) *</label>
                <input type="number" step="0.001" min="0" className="admin-input" value={form.officePickupCost} onChange={(e) => setForm({ ...form, officePickupCost: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                <input type="number" className="admin-input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${form.isActive ? "bg-indigo-600" : "bg-slate-200"}`}
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-slate-600">{form.isActive ? "Active" : "Inactive"}</span>
                </label>
              </div>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}

function RatesTab() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Rate | null>(null);
  const [form, setForm] = useState(emptyRateForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/wasellee/international-rates");
    const data = await res.json();
    if (data.success) setRates(data.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyRateForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (r: Rate) => {
    setEditing(r);
    setForm({
      countryEn: r.countryEn,
      countryAr: r.countryAr,
      countryCode: r.countryCode,
      baseWeightKg: String(r.baseWeightKg),
      baseCost: String(r.baseCost),
      additionalKgCost: String(r.additionalKgCost),
      isActive: r.isActive,
      sortOrder: String(r.sortOrder),
    });
    setError("");
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      countryEn: form.countryEn,
      countryAr: form.countryAr,
      countryCode: form.countryCode,
      baseWeightKg: parseFloat(form.baseWeightKg) || 1,
      baseCost: parseFloat(form.baseCost) || 0,
      additionalKgCost: parseFloat(form.additionalKgCost) || 0,
      isActive: form.isActive,
      sortOrder: parseInt(form.sortOrder) || 0,
    };
    const res = await fetch(
      editing ? `/api/wasellee/international-rates/${editing.id}` : "/api/wasellee/international-rates",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!data.success) {
      setError(data.error);
    } else {
      setShowModal(false);
      load();
    }
    setSaving(false);
  };

  const remove = async (r: Rate) => {
    if (!confirm(`Delete the rate for "${r.countryEn}"?`)) return;
    const res = await fetch(`/api/wasellee/international-rates/${r.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) load();
    else alert(data.error || "Could not delete this rate.");
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2.5">
        Prices are assumed in OMR (Wasellee&apos;s currency for this table wasn&apos;t confirmed) — verify and edit here. Not currently wired into checkout (Oman-only checkout); reference data for manual/international quotes.
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{rates.length} countries</span>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          <LuPlus size={15} /> Add Country
        </button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th className="text-right">Base Weight</th>
                  <th className="text-right">Base Cost</th>
                  <th className="text-right">Per Extra Kg</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.countryEn} <span className="text-slate-400 font-mono text-xs">({r.countryCode})</span></td>
                    <td className="text-right">{r.baseWeightKg} kg</td>
                    <td className="text-right">{omr(r.baseCost)}</td>
                    <td className="text-right">{omr(r.additionalKgCost)}</td>
                    <td>
                      <span className={`badge ${r.isActive ? "badge-delivered" : "badge-cancelled"}`}>
                        {r.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(r)} className="admin-btn admin-btn-secondary text-xs py-1"><LuPencil size={13} /></button>
                        <button onClick={() => remove(r)} className="admin-btn admin-btn-secondary text-xs py-1 text-red-600 hover:bg-red-50"><LuTrash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rates.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">No international rates yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AdminModal
          open={showModal}
          onClose={() => setShowModal(false)}
          className="!max-w-lg"
          title={editing ? "Edit International Rate" : "Add International Rate"}
          footer={
            <>
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Cancel</button>
              <button type="submit" form="rate-form" disabled={saving} className="admin-btn admin-btn-primary justify-center">
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Rate"}
              </button>
            </>
          }
        >
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
          <form id="rate-form" onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country (English) *</label>
                <input className="admin-input" value={form.countryEn} onChange={(e) => setForm({ ...form, countryEn: e.target.value })} placeholder="Saudi Arabia" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country (Arabic) *</label>
                <input className="admin-input" dir="rtl" value={form.countryAr} onChange={(e) => setForm({ ...form, countryAr: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country Code (ISO2/3) *</label>
              <input className="admin-input uppercase" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} placeholder="SA" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Weight (kg) *</label>
                <input type="number" step="0.1" min="0.1" className="admin-input" value={form.baseWeightKg} onChange={(e) => setForm({ ...form, baseWeightKg: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Cost (OMR) *</label>
                <input type="number" step="0.001" min="0" className="admin-input" value={form.baseCost} onChange={(e) => setForm({ ...form, baseCost: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Per Extra Kg (OMR) *</label>
                <input type="number" step="0.001" min="0" className="admin-input" value={form.additionalKgCost} onChange={(e) => setForm({ ...form, additionalKgCost: e.target.value })} required />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${form.isActive ? "bg-indigo-600" : "bg-slate-200"}`}
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-slate-600">{form.isActive ? "Active" : "Inactive"}</span>
              </label>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}

function WhatsAppTab() {
  const [values, setValues] = useState<WaselleeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/wasellee/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setValues(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!values) return;
    setSaving(true);
    const res = await fetch("/api/wasellee/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (data.success) {
      setValues(data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading || !values) return <div className="flex justify-center py-12"><div className="spinner" /></div>;

  const set = <K extends keyof WaselleeSettings>(key: K, v: WaselleeSettings[K]) =>
    setValues((prev) => (prev ? { ...prev, [key]: v } : prev));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg px-4 py-2.5">
        Every order placed with Wasellee shipping is automatically sent to the Bousher office over WhatsApp via a
        self-hosted <strong>WAHA</strong> (WhatsApp HTTP API) instance — no Meta Business API or template approval
        needed. Point this at your own WAHA server URL below and turn notifications on.
      </div>

      <div className="admin-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800">Automatic WhatsApp Notifications</p>
            <p className="text-sm text-slate-500">Send a message to the Bousher office on every Wasellee order.</p>
          </div>
          <div
            className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${values.isNotifyEnabled ? "bg-indigo-600" : "bg-slate-200"}`}
            onClick={() => set("isNotifyEnabled", !values.isNotifyEnabled)}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${values.isNotifyEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">WAHA Base URL</label>
            <input className="admin-input" placeholder="https://waha.example.com" value={values.wahaBaseUrl || ""} onChange={(e) => set("wahaBaseUrl", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">WAHA API Key</label>
            <input className="admin-input" type="password" value={values.wahaApiKey || ""} onChange={(e) => set("wahaApiKey", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">WAHA Session Name</label>
            <input className="admin-input" value={values.wahaSession} onChange={(e) => set("wahaSession", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Override Chat ID (optional)</label>
            <input className="admin-input" placeholder="96874186126@c.us" value={values.notifyChatId || ""} onChange={(e) => set("notifyChatId", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="admin-card p-6 space-y-5">
        <p className="font-medium text-slate-800">Wasellee / LO Express — Bousher Office</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Office Phone (WhatsApp target)</label>
            <input className="admin-input" value={values.bousherOfficePhone} onChange={(e) => set("bousherOfficePhone", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Concerned Person Phone</label>
            <input className="admin-input" value={values.bousherContactPhone || ""} onChange={(e) => set("bousherContactPhone", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Delivery Driver Phone</label>
            <input className="admin-input" value={values.bousherDriverPhone || ""} onChange={(e) => set("bousherDriverPhone", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
            <input className="admin-input" value={values.website || ""} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Instagram</label>
            <input className="admin-input" value={values.instagram || ""} onChange={(e) => set("instagram", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand Name</label>
            <input className="admin-input" value={values.brandNameEn} onChange={(e) => set("brandNameEn", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary px-8">
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            <LuCheck size={16} /> Settings saved!
          </span>
        )}
      </div>
    </div>
  );
}
