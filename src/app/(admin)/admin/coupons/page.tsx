"use client";
import { useEffect, useState, useCallback } from "react";
import AdminModal from "@/components/admin/AdminModal";

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrder?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: "", type: "PERCENTAGE", value: "", minOrder: "", maxUses: "", isActive: true, expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/coupons");
    const data = await res.json();
    if (data.success) { setCoupons(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        value: parseFloat(form.value),
        minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined,
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
      }),
    });
    const data = await res.json();
    if (!data.success) { setError(data.error); } else {
      setShowModal(false);
      setForm({ code: "", type: "PERCENTAGE", value: "", minOrder: "", maxUses: "", isActive: true, expiresAt: "" });
      load();
    }
    setSaving(false);
  };

  const isExpired = (expiresAt?: string) => expiresAt && new Date(expiresAt) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{total} coupons total</span>
        <button className="admin-btn admin-btn-primary" onClick={() => { setError(""); setShowModal(true); }}>
          + Create Coupon
        </button>
      </div>

      <div className="admin-card">
        {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Min Order</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono font-bold text-indigo-600">{c.code}</td>
                    <td>
                      <span className={`badge ${c.type === "PERCENTAGE" ? "badge-processing" : "badge-confirmed"}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="font-medium">
                      {c.type === "PERCENTAGE" ? `${c.value}%` : `${Number(c.value).toFixed(3)} OMR`}
                    </td>
                    <td>{c.minOrder ? `${Number(c.minOrder).toFixed(3)} OMR` : "—"}</td>
                    <td>{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                    <td className={isExpired(c.expiresAt) ? "text-red-500" : "text-slate-500"}>
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                    </td>
                    <td>
                      <span className={`badge ${c.isActive && !isExpired(c.expiresAt) ? "badge-delivered" : "badge-cancelled"}`}>
                        {c.isActive && !isExpired(c.expiresAt) ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No coupons yet</td></tr>
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
          className="!max-w-md"
          title="Create Coupon"
          footer={
            <>
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Cancel</button>
              <button type="submit" form="coupon-form" disabled={saving} className="admin-btn admin-btn-primary justify-center">
                {saving ? "Creating..." : "Create Coupon"}
              </button>
            </>
          }
        >
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form id="coupon-form" onSubmit={createCoupon} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
                <input className="admin-input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select className="admin-input admin-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="PERCENTAGE">Percentage %</option>
                    <option value="FIXED">Fixed OMR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Value *</label>
                  <input type="number" step="0.001" min="0" className="admin-input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Order (OMR)</label>
                  <input type="number" step="0.001" min="0" className="admin-input" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Uses</label>
                  <input type="number" min="1" className="admin-input" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="Unlimited" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expires At</label>
                <input type="datetime-local" className="admin-input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
            </form>
        </AdminModal>
      )}
    </div>
  );
}
