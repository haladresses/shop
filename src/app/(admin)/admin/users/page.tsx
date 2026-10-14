"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuCheck,
  LuChevronRight,
  LuKeyRound,
  LuLogOut,
  LuMail,
  LuMessageCircle,
  LuPhone,
  LuUsers,
  LuMinus,
  LuPlus,
  LuSearch,
  LuShield,
  LuTrash2,
  LuUserPlus,
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
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", group: "", role: "", status: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Deep link: /admin/users?id=…
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setSelected(id);
  }, []);
  const select = (id: string | null) => {
    setSelected(id);
    window.history.replaceState(null, "", id ? `/admin/users?id=${id}` : "/admin/users");
  };

  const fetchPage = useCallback(
    async (p: number) => {
      setLoading(true);
      const q = new URLSearchParams({ page: String(p), pageSize: "30" });
      Object.entries(filters).forEach(([k, v]) => v && q.set(k, v));
      const d = await fetch(`/api/users?${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (d?.success) {
        setRows((prev) => (p === 1 ? d.data.items : [...prev, ...d.data.items]));
        setTotal(d.data.meta.total);
        setHasMore(p < d.data.meta.totalPages);
        setRoleCounts(d.data.roleCounts);
        setPage(p);
      }
      setLoading(false);
    },
    [filters],
  );
  useEffect(() => {
    const t = setTimeout(() => fetchPage(1), 200);
    return () => clearTimeout(t);
  }, [fetchPage]);

  const staffCount = (roleCounts.SUPER_ADMIN ?? 0) + (roleCounts.ADMIN ?? 0) + (roleCounts.STAFF ?? 0) + (roleCounts.SELLER ?? 0);
  const everyone = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  const segments: [string, string, number][] = [
    ["", "All", everyone],
    ["customers", "Customers", roleCounts.CUSTOMER ?? 0],
    ["staff", "Team", staffCount],
  ];

  return (
    <div className="-m-4 sm:-m-6 lg:h-[calc(100vh-64px)] flex flex-col lg:flex-row bg-white lg:overflow-hidden">
      {/* ── List ── */}
      <section className={`${selected ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-[380px] xl:w-[420px] lg:border-e border-slate-200 min-h-0`}>
        <div className="p-4 space-y-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">People</h1>
              <p className="text-xs text-slate-500">{total} {total === 1 ? "person" : "people"}</p>
            </div>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-3 py-1.5">
              <LuUserPlus size={15} /> Add
            </button>
          </div>
          <div className="relative">
            <LuSearch size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search name, email or mobile"
              className="w-full h-9 rounded-lg bg-slate-100 ps-9 pe-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {segments.map(([g, label, n]) => {
              const on = filters.group === g && !filters.role;
              return (
                <button key={label} onClick={() => setFilters((f) => ({ ...f, group: g, role: "" }))} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {label} <span className={on ? "text-white/60" : "text-slate-400"}>{n}</span>
                </button>
              );
            })}
            <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value, group: "" }))} className="shrink-0 rounded-full bg-slate-100 text-xs font-medium text-slate-600 px-3 py-1 outline-none">
              <option value="">Role…</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label} ({roleCounts[r] ?? 0})</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="shrink-0 rounded-full bg-slate-100 text-xs font-medium text-slate-600 px-3 py-1 outline-none">
              <option value="">Status…</option>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
            </select>
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {rows.map((u) => {
            const on = selected === u.id;
            return (
              <li key={u.id}>
                <button onClick={() => select(u.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-start border-s-2 transition ${on ? "bg-indigo-50/50 border-indigo-500" : "border-transparent hover:bg-slate-50"}`}>
                  <Avatar name={u.nameEn || u.email || u.phone || "?"} role={u.role} muted={!u.isActive} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium truncate ${u.isActive ? "text-slate-900" : "text-slate-400"}`}>{u.nameEn || "Unnamed"}</span>
                      {!u.isActive && <span className="text-[10px] font-semibold text-rose-600">· Off</span>}
                      {u.hasOverrides && <span title="Custom permissions"><LuShield size={12} className="text-amber-500" /></span>}
                    </span>
                    <span className="block text-xs text-slate-500 truncate" dir="ltr">{u.email || u.phone}</span>
                  </span>
                  <span className="text-end shrink-0">
                    <span className={`block text-[10px] font-semibold rounded-full px-2 py-0.5 ring-1 ${ROLE_META[u.role].cls}`}>{ROLE_META[u.role].label}</span>
                    {u.role === "CUSTOMER" && u._count.orders > 0 && <span className="block text-[11px] text-slate-400 mt-1 tabular-nums">{u._count.orders} orders</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {loading && <li className="p-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-lg bg-slate-100 animate-pulse" />)}</li>}
          {!loading && rows.length === 0 && <li className="p-10 text-center text-sm text-slate-400">No one matches these filters.</li>}
          {hasMore && !loading && (
            <li className="p-3"><button onClick={() => fetchPage(page + 1)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-900">Load more</button></li>
          )}
        </ul>
      </section>

      {/* ── Detail ── */}
      <section className={`${selected ? "flex" : "hidden lg:flex"} flex-1 min-w-0 min-h-0 bg-slate-50/60`}>
        {selected ? (
          <UserWorkspace key={selected} id={selected} onBack={() => select(null)} onChanged={() => fetchPage(1)} onDeleted={() => { select(null); fetchPage(1); }} />
        ) : (
          <div className="m-auto text-center px-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white ring-1 ring-slate-200 flex items-center justify-center text-slate-400 mb-4"><LuUsers size={26} /></div>
            <p className="font-medium text-slate-800">Select a person</p>
            <p className="text-sm text-slate-500 mt-1">Their profile, access and orders appear here.</p>
          </div>
        )}
      </section>

      {creating && <CreateUser onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); fetchPage(1); select(id); }} />}
    </div>
  );
}

const AVATAR_TONE: Record<Role, string> = {
  SUPER_ADMIN: "bg-fuchsia-100 text-fuchsia-700",
  ADMIN: "bg-violet-100 text-violet-700",
  STAFF: "bg-emerald-100 text-emerald-700",
  SELLER: "bg-sky-100 text-sky-700",
  CUSTOMER: "bg-slate-100 text-slate-600",
};

function Avatar({ name, role, muted, size = "md" }: { name: string; role: Role; muted?: boolean; size?: "md" | "lg" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
  return (
    <span className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${size === "lg" ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm"} ${muted ? "bg-slate-100 text-slate-300" : AVATAR_TONE[role]}`}>
      {initials}
    </span>
  );
}

function UserWorkspace({ id, onBack, onChanged, onDeleted }: { id: string; onBack: () => void; onChanged: () => void; onDeleted: () => void }) {
  const [u, setU] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"overview" | "access" | "security" | "orders">("overview");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/users/${id}`, { cache: "no-store" }).then((r) => r.json()).then((d) => d.success && setU(d.data));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const patch = async (body: object, okText = "Saved") => {
    const d = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    setMsg(d.success ? { ok: true, text: okText } : { ok: false, text: d.error });
    if (d.success) {
      load();
      onChanged();
    }
    return d.success as boolean;
  };

  if (!u) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <div className="h-36 rounded-2xl bg-white animate-pulse" />
        <div className="h-64 rounded-2xl bg-white animate-pulse" />
      </div>
    );
  }

  const locked = !u.canManage && !u.isSelf;
  const digits = (u.phone || "").replace(/\D/g, "");
  const tabs: [typeof tab, string][] = [
    ["overview", "Overview"],
    ["access", "Role & access"],
    ["security", "Security"],
    ["orders", `Orders · ${u._count.orders}`],
  ];

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 sm:px-8 pt-5 pb-0">
          <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-sm text-slate-500 mb-3">
            <LuChevronRight size={15} className="rotate-180 rtl:rotate-0" /> People
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar name={u.nameEn || u.email || "?"} role={u.role} muted={!u.isActive} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900 truncate">{u.nameEn || "Unnamed"}</h2>
                {u.nameAr && <span className="text-sm text-slate-400" dir="rtl">{u.nameAr}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ring-1 ${ROLE_META[u.role].cls}`}>{ROLE_META[u.role].label}</span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {u.isActive ? "Active" : "Deactivated"}
                </span>
                {u.isSelf && <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">You</span>}
                {u.overrides.grant.length + u.overrides.revoke.length > 0 && (
                  <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-700">Custom permissions</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {u.phone && (
                <>
                  <a href={`tel:${u.phone}`} className="w-9 h-9 rounded-lg ring-1 ring-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50" title="Call"><LuPhone size={16} /></a>
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg ring-1 ring-slate-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-50" title="WhatsApp"><LuMessageCircle size={16} /></a>
                </>
              )}
              {u.email && <a href={`mailto:${u.email}`} className="w-9 h-9 rounded-lg ring-1 ring-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50" title="Email"><LuMail size={16} /></a>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 rounded-xl overflow-hidden ring-1 ring-slate-200 mt-5">
            {[
              ["Orders", String(u._count.orders)],
              ["Total spent", `${num(u.totalSpent)}`],
              ["Member since", new Date(u.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })],
              ["Last sign-in", ago(u.lastLoginAt)],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{k}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          <nav className="flex gap-5 mt-4 -mb-px overflow-x-auto no-scrollbar">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 pb-3 text-sm font-medium border-b-2 transition ${tab === k ? "border-indigo-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-8 py-6 space-y-4">
        {locked && <p className="rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3">This account is at or above your level — view only.</p>}
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
          {tab === "overview" && <ProfileTab u={u} locked={locked} onSave={patch} />}
          {tab === "access" && <AccessTab u={u} onSave={patch} />}
          {tab === "security" && <SecurityTab u={u} locked={locked} onDone={(m) => { setMsg(m); load(); onChanged(); }} onClose={onDeleted} />}
          {tab === "orders" && <ActivityTab u={u} />}
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`fixed bottom-5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${msg.ok ? "bg-slate-900 text-white" : "bg-rose-600 text-white"}`}>
          {msg.text}
        </div>
      )}
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
              <button key={r} disabled={!allowed} onClick={() => setRole(r)} className={`rounded-xl px-3 py-2.5 text-sm font-medium ring-1 text-start transition ${role === r ? "ring-1 ring-indigo-300 bg-indigo-50 text-indigo-700" : "ring-slate-200"} disabled:opacity-40`}>
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
function Box({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl ring-1 ring-slate-200 p-4">
      <p className="font-medium text-slate-800 text-sm">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">{desc}</p>
      {children}
    </div>
  );
}
