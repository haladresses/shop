"use client";
import { useEffect, useState, useCallback } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

type User = {
  id: string;
  email: string;
  phone?: string;
  nameEn?: string;
  nameAr?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  posPinSet: boolean;
  _count: { orders: number };
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "badge-super_admin", ADMIN: "badge-admin",
  SELLER: "badge-seller", STAFF: "badge-staff", CUSTOMER: "badge-customer",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nameEn: "", nameAr: "", phone: "", role: "CUSTOMER" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pinUser, setPinUser] = useState<User | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search, ...(roleFilter && { role: roleFilter }) });
    const res = await fetch(`/api/users?${params}`);
    const data = await res.json();
    if (data.success) {
      setUsers(data.data);
      setTotal(data.meta.total);
    }
    setLoading(false);
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  const changeRole = async (id: string, role: string) => {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  };

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinUser) return;
    setPinSaving(true);
    setPinError("");
    const res = await fetch(`/api/users/${pinUser.id}/pos-pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinValue }),
    });
    const data = await res.json();
    if (!data.success) {
      setPinError(data.error);
    } else {
      setPinUser(null);
      setPinValue("");
      load();
    }
    setPinSaving(false);
  };

  const clearPin = async () => {
    if (!pinUser) return;
    setPinSaving(true);
    await fetch(`/api/users/${pinUser.id}/pos-pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: null }),
    });
    setPinUser(null);
    setPinValue("");
    setPinSaving(false);
    load();
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!data.success) {
      setError(data.error);
    } else {
      setShowModal(false);
      setForm({ email: "", password: "", nameEn: "", nameAr: "", phone: "", role: "CUSTOMER" });
      load();
    }
    setSaving(false);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <input
            className="admin-input w-64"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            className="admin-input admin-select w-40"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Roles</option>
            {["SUPER_ADMIN", "ADMIN", "SELLER", "STAFF", "CUSTOMER"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowModal(true)}>
          + Add User
        </button>
      </div>

      {/* Table */}
      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Orders</th>
                  <th>Status</th>
                  <th>POS PIN</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.nameEn || "—"}</td>
                    <td className="text-slate-600">{u.email}</td>
                    <td className="text-slate-600">{u.phone || "—"}</td>
                    <td>
                      <select
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white"
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                      >
                        {["SUPER_ADMIN", "ADMIN", "SELLER", "STAFF", "CUSTOMER"].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-center">{u._count.orders}</td>
                    <td>
                      <button
                        onClick={() => toggleActive(u.id, u.isActive)}
                        className={`badge ${u.isActive ? "badge-delivered" : "badge-cancelled"} cursor-pointer`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => { setPinUser(u); setPinValue(""); setPinError(""); }}
                        className={`admin-btn text-xs py-1 ${u.posPinSet ? "admin-btn-secondary" : "admin-btn-primary"}`}
                      >
                        {u.posPinSet ? "Change PIN" : "Set PIN"}
                      </button>
                    </td>
                    <td className="text-slate-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        onClick={() => toggleActive(u.id, u.isActive)}
                        className="admin-btn admin-btn-secondary text-xs py-1"
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Total: {total} users</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40"><LuChevronLeft size={14} /> Prev</button>
              <span className="text-sm text-slate-600 self-center">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next <LuChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <AdminModal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Create New User"
          footer={
            <>
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn admin-btn-secondary">Cancel</button>
              <button type="submit" form="user-form" disabled={saving} className="admin-btn admin-btn-primary justify-center">
                {saving ? "Creating..." : "Create User"}
              </button>
            </>
          }
        >
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
            <form id="user-form" onSubmit={createUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (EN)</label>
                  <input className="admin-input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (AR)</label>
                  <input className="admin-input" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" className="admin-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input type="password" className="admin-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input className="admin-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select className="admin-input admin-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {["SUPER_ADMIN", "ADMIN", "SELLER", "STAFF", "CUSTOMER"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </form>
        </AdminModal>
      )}

      {/* Set/Change POS PIN Modal */}
      {pinUser && (
        <AdminModal
          open={!!pinUser}
          onClose={() => setPinUser(null)}
          title={`POS PIN — ${pinUser.nameEn || pinUser.email}`}
          footer={
            <>
              {pinUser.posPinSet && (
                <button type="button" onClick={clearPin} disabled={pinSaving} className="admin-btn admin-btn-secondary text-rose-600">
                  Remove PIN
                </button>
              )}
              <button type="button" onClick={() => setPinUser(null)} className="admin-btn admin-btn-secondary">Cancel</button>
              <button type="submit" form="pin-form" disabled={pinSaving} className="admin-btn admin-btn-primary justify-center">
                {pinSaving ? "Saving..." : "Save PIN"}
              </button>
            </>
          }
        >
          {pinError && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{pinError}</div>}
          <p className="text-sm text-slate-500 mb-3">
            Used to sign in at the in-store POS terminal (only works if this user&apos;s role has POS access — see Roles &amp; Permissions).
          </p>
          <form id="pin-form" onSubmit={savePin}>
            <label className="block text-sm font-medium text-slate-700 mb-1">4-digit PIN</label>
            <input
              className="admin-input text-center text-lg tracking-[0.5em]"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
              autoFocus
            />
          </form>
        </AdminModal>
      )}
    </div>
  );
}
