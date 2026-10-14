"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuCheck,
  LuChevronRight,
  LuKeyRound,
  LuLogOut,
  LuMinus,
  LuPlus,
  LuSearch,
  LuShield,
  LuTrash2,
  LuUserPlus,
  LuX,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "SELLER" | "CUSTOMER";
type Row = {
  id: string;
  email: string | null;
  phone: string | null;
  nameEn: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  posPinSet: boolean;
  hasOverrides: boolean;
  totalSpent: number;
  _count: { orders: number };
};
type Perm = { key: string; label: string; description: string; area: string; group: string };
type Detail = Row & {
  nameAr: string | null;
  overrides: { grant: string[]; revoke: string[] };
  rolePermissions: string[];
  effectivePermissions: string[];
  recentOrders: { id: string; orderNumber: string; total: number; status: string; createdAt: string }[];
  canManage: boolean;
  isSelf: boolean;
  assignableRoles: Role[];
  viewerPermissions: string[];
  catalog: Perm[];
  _count: { orders: number; addresses: number; sessions: number; reviews: number };
};

const ROLE_META: Record<Role, { label: string; cls: string }> = {
  SUPER_ADMIN: { label: "Super admin", cls: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" },
  ADMIN: { label: "Admin", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  STAFF: { label: "Staff", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  SELLER: { label: "Seller", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  CUSTOMER: { label: "Customer", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};
const ROLES = Object.keys(ROLE_META) as Role[];
const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString("en-GB");
};

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", group: "", role: "", status: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    const d = await fetch(`/api/users?${p}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (d?.success) {
      setRows(d.data.items);
      setTotal(d.data.meta.total);
      setTotalPages(Math.max(1, d.data.meta.totalPages));
      setRoleCounts(d.data.roleCounts);
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const setF = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };
  const staffCount = (roleCounts.SUPER_ADMIN ?? 0) + (roleCounts.ADMIN ?? 0) + (roleCounts.STAFF ?? 0) + (roleCounts.SELLER ?? 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 p-3 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <LuSearch size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filters.search} onChange={(e) => setF("search", e.target.value)} placeholder="Search name, email or mobile" className="admin-input !py-2 !ps-9 text-sm" />
        </div>
        <select
          value={filters.group ? `group:${filters.group}` : filters.role}
          onChange={(e) => {
            const v = e.target.value;
            setPage(1);
            setFilters((f) => ({ ...f, group: v.startsWith("group:") ? v.slice(6) : "", role: v.startsWith("group:") ? "" : v }));
          }}
          className="admin-input admin-select !py-2 text-sm md:!w-48"
        >
          <option value="">Everyone ({Object.values(roleCounts).reduce((a, b) => a + b, 0)})</option>
          <option value="group:customers">Customers ({roleCounts.CUSTOMER ?? 0})</option>
          <option value="group:staff">Team ({staffCount})</option>
          <optgroup label="By role">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label} ({roleCounts[r] ?? 0})</option>)}
          </optgroup>
        </select>
        <select value={filters.status} onChange={(e) => setF("status", e.target.value)} className="admin-input admin-select !py-2 text-sm md:!w-40">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </select>
        <button onClick={() => setCreating(true)} className="admin-btn admin-btn-primary !py-2 text-sm shrink-0">
          <LuUserPlus size={16} /> Add user
        </button>
      </div>

      <div className="admin-card overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-14"><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-14">No users match these filters.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((u) => (
              <li key={u.id}>
                <button onClick={() => setSelected(u.id)} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-start hover:bg-slate-50 transition">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold shrink-0 ${u.isActive ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-300"}`}>
                    {(u.nameEn || u.email || u.phone || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`font-medium truncate ${u.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>{u.nameEn || "—"}</span>
                      {u.hasOverrides && <span title="Custom permissions"><LuShield size={13} className="text-amber-500 shrink-0" /></span>}
                    </span>
                    <span className="block text-xs text-slate-500 truncate" dir="ltr">{[u.email, u.phone].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={`hidden sm:inline-flex text-[11px] font-semibold rounded-full px-2.5 py-1 ring-1 ${ROLE_META[u.role].cls}`}>{ROLE_META[u.role].label}</span>
                  <span className="hidden md:block w-28 text-end text-xs text-slate-500">
                    {u.role === "CUSTOMER" ? <>{u._count.orders} orders<br /><span className="text-slate-800 font-medium tabular-nums">{num(u.totalSpent)}</span></> : <>Last login<br />{ago(u.lastLoginAt)}</>}
                  </span>
                  <LuChevronRight size={16} className="text-slate-300 rtl:rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
            <span className="text-slate-500">{total} users</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Prev</button>
              <span className="text-slate-500">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {selected && <UserPanel id={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {creating && <CreateUser onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); setSelected(id); }} />}
    </div>
  );
}

// ───────── User detail slide-over ─────────

function UserPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [u, setU] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"profile" | "access" | "security" | "activity">("profile");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/users/${id}`, { cache: "no-store" }).then((r) => r.json()).then((d) => d.success && setU(d.data));
  }, [id]);
  useEffect(load, [load]);

  const patch = async (body: object, okText = "Saved") => {
    setMsg(null);
    const d = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    setMsg(d.success ? { ok: true, text: okText } : { ok: false, text: d.error });
    if (d.success) {
      load();
      onChanged();
    }
    return d.success as boolean;
  };

  const locked = !!u && !u.canManage && !u.isSelf;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="relative w-full max-w-[560px] h-full bg-white shadow-2xl flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100 flex items-start gap-3">
          {u ? (
            <>
              <span className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 text-lg font-semibold flex items-center justify-center">{(u.nameEn || "?").charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">{u.nameEn}</p>
                <p className="text-xs text-slate-500 truncate" dir="ltr">{[u.email, u.phone].filter(Boolean).join(" · ")}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ring-1 ${ROLE_META[u.role].cls}`}>{ROLE_META[u.role].label}</span>
                  {!u.isActive && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-rose-50 text-rose-700">Deactivated</span>}
                  {u.isSelf && <span className="text-[11px] text-slate-400">You</span>}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 h-12 rounded-xl bg-slate-100 animate-pulse" />
          )}
          <button onClick={onClose} className="p-2 -m-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close"><LuX size={18} /></button>
        </header>

        {u && (
          <>
            <nav className="flex gap-1 px-5 pt-3 border-b border-slate-100">
              {(["profile", "access", "security", "activity"] as const).map((k) => (
                <button key={k} onClick={() => { setTab(k); setMsg(null); }} className={`px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === k ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"}`}>
                  {k === "access" ? "Role & access" : k}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {locked && <p className="rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3">This account is at or above your level — view only.</p>}
              {msg && <p className={`rounded-xl text-sm px-4 py-3 ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
              {tab === "profile" && <ProfileTab u={u} locked={locked} onSave={patch} />}
              {tab === "access" && <AccessTab u={u} onSave={patch} />}
              {tab === "security" && <SecurityTab u={u} locked={locked} onDone={(t) => { setMsg(t); load(); onChanged(); }} onClose={onClose} />}
              {tab === "activity" && <ActivityTab u={u} />}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function ProfileTab({ u, locked, onSave }: { u: Detail; locked: boolean; onSave: (b: object, t?: string) => Promise<boolean> }) {
  const [f, setF] = useState({ nameEn: u.nameEn || "", nameAr: u.nameAr || "", email: u.email || "", phone: u.phone || "" });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f, "Profile saved"); }} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <L label="Name (English)"><input className="admin-input" disabled={locked} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></L>
        <L label="Name (Arabic)"><input className="admin-input" dir="rtl" disabled={locked} value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} /></L>
        <L label="Email"><input className="admin-input" dir="ltr" disabled={locked} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="—" /></L>
        <L label="Mobile"><input className="admin-input" dir="ltr" disabled={locked} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="—" /></L>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Mini label="Orders" value={String(u._count.orders)} />
        <Mini label="Spent" value={num(u.totalSpent)} />
        <Mini label="Last login" value={ago(u.lastLoginAt)} />
      </div>
      {!locked && <button className="admin-btn admin-btn-primary">Save profile</button>}
    </form>
  );
}

function AccessTab({ u, onSave }: { u: Detail; onSave: (b: object, t?: string) => Promise<boolean> }) {
  const [role, setRole] = useState<Role>(u.role);
  const [grant, setGrant] = useState<string[]>(u.overrides.grant);
  const [revoke, setRevoke] = useState<string[]>(u.overrides.revoke);
  const [q, setQ] = useState("");
  const canEdit = u.canManage && !u.isSelf;
  const isSuper = u.role === "SUPER_ADMIN";

  const groups = useMemo(() => {
    const m = new Map<string, Perm[]>();
    for (const p of u.catalog) {
      if (q && !`${p.label} ${p.description} ${p.group}`.toLowerCase().includes(q.toLowerCase())) continue;
      m.set(p.group, [...(m.get(p.group) ?? []), p]);
    }
    return Array.from(m);
  }, [u.catalog, q]);

  // State per permission: from role (inherit), extra grant, or revoked.
  const stateOf = (k: string) => (grant.includes(k) ? "grant" : revoke.includes(k) ? "revoke" : u.rolePermissions.includes(k) ? "role" : "off");
  const toggle = (k: string) => {
    const s = stateOf(k);
    if (s === "role") setRevoke((r) => [...r, k]);
    else if (s === "revoke") setRevoke((r) => r.filter((x) => x !== k));
    else if (s === "grant") setGrant((g) => g.filter((x) => x !== k));
    else if (u.viewerPermissions.includes(k)) setGrant((g) => [...g, k]);
  };
  const dirty = role !== u.role || grant.join() !== u.overrides.grant.join() || revoke.join() !== u.overrides.revoke.join();

  const save = async () => {
    const body: Record<string, unknown> = { overrides: { grant, revoke } };
    if (role !== u.role) body.role = role;
    await onSave(body, role !== u.role ? "Role updated — they've been signed out to apply it" : "Permissions saved");
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Role</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ROLES.map((r) => {
            const allowed = canEdit && (u.assignableRoles.includes(r) || r === u.role);
            return (
              <button key={r} disabled={!allowed} onClick={() => setRole(r)} className={`rounded-xl px-3 py-2.5 text-sm font-medium ring-1 text-start transition ${role === r ? "ring-2 ring-slate-900 bg-slate-50" : "ring-slate-200"} disabled:opacity-40`}>
                {ROLE_META[r].label}
              </button>
            );
          })}
        </div>
        {u.isSelf && <p className="text-xs text-slate-400 mt-2">You can&apos;t change your own role or permissions.</p>}
      </div>

      {isSuper ? (
        <p className="rounded-xl bg-fuchsia-50 text-fuchsia-800 text-sm px-4 py-3">Super admins always have every permission.</p>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-medium text-slate-700">Individual permissions</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="admin-input !py-1.5 !w-40 text-sm" />
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Start from the role, then add (<LuPlus className="inline" size={11} />) or remove (<LuMinus className="inline" size={11} />) single permissions for just this person.
          </p>
          <div className="space-y-4">
            {groups.map(([group, perms]) => (
              <div key={group}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{group}</p>
                <ul className="rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
                  {perms.map((p) => {
                    const s = stateOf(p.key);
                    const on = s === "role" || s === "grant";
                    const disabled = !canEdit || (s === "off" && !u.viewerPermissions.includes(p.key));
                    return (
                      <li key={p.key}>
                        <button disabled={disabled} onClick={() => toggle(p.key)} className="w-full flex items-center gap-3 px-3 py-2.5 text-start disabled:cursor-not-allowed">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${on ? "bg-slate-900 text-white" : "ring-1 ring-slate-300"} ${s === "grant" ? "!bg-emerald-600" : ""} ${s === "revoke" ? "!bg-rose-50 !ring-rose-300" : ""}`}>
                            {on && <LuCheck size={13} />}
                            {s === "revoke" && <LuMinus size={12} className="text-rose-600" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${s === "revoke" ? "text-slate-400 line-through" : "text-slate-800"}`}>{p.label}</span>
                            <span className="block text-xs text-slate-400 truncate">{p.description}</span>
                          </span>
                          {s === "grant" && <span className="text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">Extra</span>}
                          {s === "revoke" && <span className="text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 px-2 py-0.5">Removed</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {canEdit && dirty && (
        <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-white border-t border-slate-100 flex gap-2">
          <button onClick={save} className="admin-btn admin-btn-primary">Save access</button>
          <button onClick={() => { setRole(u.role); setGrant(u.overrides.grant); setRevoke(u.overrides.revoke); }} className="admin-btn admin-btn-secondary">Discard</button>
        </div>
      )}
    </div>
  );
}

function SecurityTab({ u, locked, onDone, onClose }: { u: Detail; locked: boolean; onDone: (m: { ok: boolean; text: string }) => void; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [pin, setPin] = useState("");
  const call = async (url: string, method: string, body?: object) => {
    const d = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
    return d as { success: boolean; error?: string; data?: { signedOut?: number } };
  };
  if (locked) return <p className="text-sm text-slate-500">Security actions aren&apos;t available for this account.</p>;

  return (
    <div className="space-y-4">
      {!u.isSelf && (
        <Box title={u.isActive ? "Deactivate account" : "Reactivate account"} desc={u.isActive ? "They're signed out immediately and can't sign in. History is kept." : "Allow this person to sign in again."}>
          <button
            onClick={async () => {
              const d = await call(`/api/users/${u.id}`, "PATCH", { isActive: !u.isActive });
              onDone(d.success ? { ok: true, text: u.isActive ? "Account deactivated" : "Account reactivated" } : { ok: false, text: d.error || "Failed" });
            }}
            className={`admin-btn ${u.isActive ? "admin-btn-danger" : "admin-btn-primary"}`}
          >
            {u.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </Box>
      )}

      <Box title="Set a new password" desc="Signs them out on every device.">
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const d = await call(`/api/users/${u.id}/password`, "POST", { password: pw }); onDone(d.success ? { ok: true, text: "Password updated" } : { ok: false, text: d.error || "Failed" }); if (d.success) setPw(""); }}>
          <input type="text" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="admin-input !py-2" />
          <button className="admin-btn admin-btn-secondary whitespace-nowrap"><LuKeyRound size={15} /> Set</button>
        </form>
      </Box>

      {u.role !== "CUSTOMER" && (
        <Box title={`POS PIN ${u.posPinSet ? "· set" : "· not set"}`} desc="4-digit PIN to sign in at the till.">
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const d = await call(`/api/users/${u.id}/pos-pin`, "PATCH", { pin }); onDone(d.success ? { ok: true, text: "POS PIN saved" } : { ok: false, text: d.error || "Failed" }); if (d.success) setPin(""); }}>
            <input inputMode="numeric" pattern="\d{4}" maxLength={4} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="admin-input !py-2 !w-28 tracking-[.4em]" />
            <button className="admin-btn admin-btn-secondary">Save PIN</button>
            {u.posPinSet && (
              <button type="button" onClick={async () => { const d = await call(`/api/users/${u.id}/pos-pin`, "PATCH", { pin: null }); onDone(d.success ? { ok: true, text: "PIN removed" } : { ok: false, text: d.error || "Failed" }); }} className="admin-btn admin-btn-secondary text-rose-600">Remove</button>
            )}
          </form>
        </Box>
      )}

      {!u.isSelf && (
        <Box title={`Active sessions · ${u._count.sessions}`} desc="Sign them out of every browser and device.">
          <button onClick={async () => { const d = await call(`/api/users/${u.id}/sessions`, "DELETE"); onDone(d.success ? { ok: true, text: `Signed out of ${d.data?.signedOut ?? 0} session(s)` } : { ok: false, text: d.error || "Failed" }); }} className="admin-btn admin-btn-secondary">
            <LuLogOut size={15} /> Sign out everywhere
          </button>
        </Box>
      )}

      {!u.isSelf && (
        <Box title="Delete account" desc="Only for accounts without orders or POS history — otherwise deactivate.">
          <button
            onClick={async () => {
              if (!confirm("Delete this account permanently?")) return;
              const d = await call(`/api/users/${u.id}`, "DELETE");
              if (d.success) { onDone({ ok: true, text: "Deleted" }); onClose(); } else onDone({ ok: false, text: d.error || "Failed" });
            }}
            className="admin-btn admin-btn-danger"
          >
            <LuTrash2 size={15} /> Delete
          </button>
        </Box>
      )}
    </div>
  );
}

function ActivityTab({ u }: { u: Detail }) {
  return u.recentOrders.length === 0 ? (
    <p className="text-sm text-slate-400">No orders yet.</p>
  ) : (
    <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
      {u.recentOrders.map((o) => (
        <li key={o.id}>
          <a href={`/admin/orders?search=${o.orderNumber}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-sm">
            <span>
              <span className="font-medium text-slate-800">{o.orderNumber}</span>
              <span className="block text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString("en-GB")} · {o.status.toLowerCase()}</span>
            </span>
            <span className="font-semibold tabular-nums">{num(o.total)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ nameEn: "", identifier: "", password: "", role: "CUSTOMER" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const d = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).then((r) => r.json());
    setBusy(false);
    if (!d.success) return setErr(d.error);
    onCreated(d.data.id);
  };
  return (
    <AdminModal
      open
      onClose={onClose}
      className="!max-w-md"
      title="Add user"
      footer={
        <>
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button type="submit" form="create-user" disabled={busy} className="admin-btn admin-btn-primary">{busy ? "Creating..." : "Create user"}</button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} className="space-y-4">
        <L label="Full name"><input className="admin-input" required value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></L>
        <L label="Email or mobile number"><input className="admin-input" dir="ltr" required value={f.identifier} onChange={(e) => setF({ ...f, identifier: e.target.value })} placeholder="name@email.com or 9944 0312" /></L>
        <L label="Password"><input className="admin-input" dir="ltr" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></L>
        <L label="Role">
          <select className="admin-input admin-select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
        </L>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </form>
    </AdminModal>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2.5">
      <p className="text-sm font-semibold text-slate-800 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
function Box({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl ring-1 ring-slate-200 p-4">
      <p className="font-medium text-slate-800 text-sm">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">{desc}</p>
      {children}
    </div>
  );
}
