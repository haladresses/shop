"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { LuArrowDown, LuArrowUp, LuCheck, LuChevronLeft, LuChevronRight, LuChevronsUpDown, LuKeyRound, LuMinus, LuSearch, LuShield, LuUserPlus } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import UserDrawer from "@/components/admin/access/UserDrawer";
import {
  Avatar,
  ColorDot,
  RolePill,
  TYPE_META,
  ago,
  api,
  fmtDate,
  type AccountType,
  type RoleDTO,
  type RolesPayload,
} from "@/components/admin/access/shared";

type Row = {
  id: string;
  email: string | null;
  phone: string | null;
  nameEn: string | null;
  nameAr: string | null;
  role: AccountType;
  roleId: string | null;
  appRole: { id: string; key: string; nameEn: string; nameAr: string | null; color: string; rank: number } | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  posPinSet: boolean;
  hasOverrides: boolean;
  overrideCount: number;
  totalSpent: number;
  isSelf: boolean;
  canManage: boolean;
  _count: { orders: number };
};
type ListResponse = {
  items: Row[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  roleCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  statusCounts: { active: number; inactive: number };
};
type Filters = { search: string; roleId: string; type: string; status: string; sort: string; dir: "asc" | "desc"; page: number };

const PAGE_SIZE = 25;
const TYPES: AccountType[] = ["SUPER_ADMIN", "ADMIN", "STAFF", "SELLER", "CUSTOMER"];

export default function UsersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500 py-10 text-center">Loading...</p>}>
      <People />
    </Suspense>
  );
}

function People() {
  const sp = useSearchParams();
  const [filters, setFilters] = useState<Filters>({
    search: sp.get("search") ?? "",
    roleId: sp.get("roleId") ?? "",
    type: sp.get("type") ?? "",
    status: sp.get("status") ?? "",
    sort: "createdAt",
    dir: "desc",
    page: 1,
  });
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RolesPayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(sp.get("id"));
  const [creating, setCreating] = useState(false);

  const perms = new Set(roles?.viewer.permissions ?? []);
  const canManage = perms.has("admin.users.manage");
  const canAssign = canManage && perms.has("admin.users.assign_roles");

  const loadRoles = useCallback(() => {
    api<RolesPayload>("/api/admin/roles").then((d) => d.success && d.data && setRoles(d.data));
  }, []);
  useEffect(loadRoles, [loadRoles]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(filters.page), pageSize: String(PAGE_SIZE), sort: filters.sort, dir: filters.dir });
    if (filters.search.trim()) q.set("search", filters.search.trim());
    if (filters.roleId) q.set("roleId", filters.roleId);
    if (filters.type) q.set("type", filters.type);
    if (filters.status) q.set("status", filters.status);
    const d = await api<ListResponse>(`/api/users?${q}`);
    setLoading(false);
    if (!d.success || !d.data) return toast.error(d.error || "Could not load people");
    setData(d.data);
  }, [filters]);
  useEffect(() => {
    const t = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  const change = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, page: 1, ...patch }));
    setSelected(new Set());
  };
  const sortBy = (key: string) =>
    setFilters((f) => ({ ...f, page: 1, sort: key, dir: f.sort === key ? (f.dir === "asc" ? "desc" : "asc") : key === "name" || key === "email" ? "asc" : "desc" }));

  const open = (id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("id", id);
    else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
  };

  const changed = () => {
    load();
    loadRoles();
  };

  const rows = data?.items ?? [];
  const selectable = rows.filter((r) => r.canManage);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const everyone = data ? data.statusCounts.active + data.statusCounts.inactive : 0;
  const meta = data?.meta;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Customers, staff and sellers. Each person has one role that decides what they can do.</p>
        </div>
        {canManage && (
          <button onClick={() => setCreating(true)} className="admin-btn admin-btn-primary"><LuUserPlus size={16} /> Add person</button>
        )}
      </div>

      {/* Role chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <Chip on={!filters.roleId} onClick={() => change({ roleId: "" })} label="Everyone" count={everyone} />
        {roles?.roles.map((r) => (
          <Chip key={r.id} on={filters.roleId === r.id} onClick={() => change({ roleId: filters.roleId === r.id ? "" : r.id })} label={r.nameEn} color={r.color} count={data?.roleCounts[r.id] ?? r.userCount} />
        ))}
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <LuSearch size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filters.search} onChange={(e) => change({ search: e.target.value })} placeholder="Search name, email or mobile" className="admin-input !ps-9" />
        </div>
        <select value={filters.type} onChange={(e) => change({ type: e.target.value })} className="admin-input admin-select !w-auto">
          <option value="">All account types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_META[t].label} ({data?.typeCounts[t] ?? 0})</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => change({ status: e.target.value })} className="admin-input admin-select !w-auto">
          <option value="">Active and deactivated</option>
          <option value="active">Active ({data?.statusCounts.active ?? 0})</option>
          <option value="inactive">Deactivated ({data?.statusCounts.inactive ?? 0})</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-card overflow-x-auto">
        <table className="admin-table min-w-[960px]">
          <thead>
            <tr>
              <th className="w-10">
                {canManage && (
                  <CheckBox
                    state={allSelected ? "on" : selectable.some((r) => selected.has(r.id)) ? "some" : "off"}
                    disabled={selectable.length === 0}
                    label="Select all on this page"
                    onClick={() => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))}
                  />
                )}
              </th>
              <SortTh k="name" label="Person" f={filters} onSort={sortBy} />
              <th>Contact</th>
              <SortTh k="role" label="Role" f={filters} onSort={sortBy} />
              <SortTh k="status" label="Status" f={filters} onSort={sortBy} />
              <SortTh k="lastLogin" label="Last sign-in" f={filters} onSort={sortBy} />
              <th className="text-center">POS PIN</th>
              <SortTh k="orders" label="Orders" f={filters} onSort={sortBy} align="right" />
              <SortTh k="createdAt" label="Joined" f={filters} onSort={sortBy} />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const on = selected.has(u.id);
              return (
                <tr key={u.id} onClick={() => open(u.id)} className={`cursor-pointer ${on ? "[&>td]:!bg-indigo-50/60" : ""}`}>
                  <td onClick={(e) => e.stopPropagation()}>
                    {canManage && (
                      <CheckBox
                        state={on ? "on" : "off"}
                        disabled={!u.canManage}
                        label={u.canManage ? `Select ${u.nameEn || "person"}` : u.isSelf ? "This is you" : "At or above your level"}
                        onClick={() => setSelected((s) => { const n = new Set(s); if (on) n.delete(u.id); else n.add(u.id); return n; })}
                      />
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.nameEn || u.email || u.phone || "?"} color={u.appRole?.color} muted={!u.isActive} />
                      <div className="min-w-0">
                        <p className={`font-medium truncate max-w-[200px] ${u.isActive ? "text-slate-800" : "text-slate-400"}`}>
                          {u.nameEn || "Unnamed"}
                          {u.isSelf && <span className="ms-1.5 text-[10px] font-semibold text-indigo-600">YOU</span>}
                        </p>
                        {u.nameAr && <p className="text-xs text-slate-400 truncate max-w-[200px]" dir="rtl">{u.nameAr}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="text-xs" dir="ltr">
                    <span className="block text-slate-700">{u.phone || "-"}</span>
                    <span className="block text-slate-400 truncate max-w-[200px]">{u.email || ""}</span>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <RolePill role={u.appRole} />
                      {u.hasOverrides && (
                        <span title={`${u.overrideCount} personal permission change${u.overrideCount === 1 ? "" : "s"}`} className="text-amber-500"><LuShield size={13} /></span>
                      )}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? "text-emerald-700" : "text-rose-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {u.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="text-xs text-slate-600 whitespace-nowrap">{ago(u.lastLoginAt)}</td>
                  <td className="text-center">{u.posPinSet ? <LuKeyRound size={14} className="inline text-emerald-600" aria-label="PIN set" /> : <span className="text-slate-300">-</span>}</td>
                  <td className="text-right tabular-nums">{u._count.orders || <span className="text-slate-300">-</span>}</td>
                  <td className="text-xs text-slate-600 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                </tr>
              );
            })}
            {loading && rows.length === 0 && (
              <tr><td colSpan={9} className="text-center text-sm text-slate-400 py-10">Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="text-center text-sm text-slate-400 py-10">Nobody matches these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span className="tabular-nums">
            {(meta.page - 1) * meta.pageSize + 1}-{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
          </span>
          <span className="flex items-center gap-1">
            <button disabled={meta.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} className="admin-btn admin-btn-secondary !px-2.5 disabled:opacity-40" aria-label="Previous page"><LuChevronLeft size={16} /></button>
            <span className="px-2 tabular-nums">Page {meta.page} of {Math.max(1, meta.totalPages)}</span>
            <button disabled={meta.page >= meta.totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} className="admin-btn admin-btn-secondary !px-2.5 disabled:opacity-40" aria-label="Next page"><LuChevronRight size={16} /></button>
          </span>
        </div>
      )}

      {selected.size > 0 && (
        <BulkBar
          ids={Array.from(selected)}
          roles={roles?.roles ?? []}
          canAssign={canAssign}
          onClear={() => setSelected(new Set())}
          onDone={() => {
            setSelected(new Set());
            changed();
          }}
        />
      )}

      {openId && <UserDrawer key={openId} id={openId} onClose={() => open(null)} onChanged={changed} />}

      {creating && roles && (
        <CreateUser
          roles={roles.roles}
          canAssign={canAssign}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            changed();
            open(id);
          }}
        />
      )}
    </div>
  );
}

function Chip({ on, onClick, label, count, color }: { on: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button onClick={onClick} className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${on ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>
      {color && <ColorDot color={color} size={8} />}
      {label}
      <span className={`tabular-nums ${on ? "text-white/60" : "text-slate-400"}`}>{count}</span>
    </button>
  );
}

function SortTh({ k, label, f, onSort, align }: { k: string; label: string; f: Filters; onSort: (k: string) => void; align?: "right" }) {
  const active = f.sort === k;
  const Icon = active ? (f.dir === "asc" ? LuArrowUp : LuArrowDown) : LuChevronsUpDown;
  return (
    <th className={align === "right" ? "text-right" : undefined} aria-sort={active ? (f.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wider ${active ? "text-slate-800" : "hover:text-slate-700"}`}>
        {label}
        <Icon size={12} className={active ? "" : "text-slate-300"} />
      </button>
    </th>
  );
}

function CheckBox({ state, disabled, label, onClick }: { state: "on" | "off" | "some"; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "some" ? "mixed" : state === "on"}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`w-[18px] h-[18px] rounded-md flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${state === "off" ? "ring-1 ring-inset ring-slate-300 bg-white" : "bg-indigo-600 text-white"}`}
    >
      {state === "on" && <LuCheck size={12} strokeWidth={3} />}
      {state === "some" && <LuMinus size={12} strokeWidth={3} />}
    </button>
  );
}

function BulkBar({ ids, roles, canAssign, onClear, onDone }: { ids: string[]; roles: RoleDTO[]; canAssign: boolean; onClear: () => void; onDone: () => void }) {
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const assignable = roles.filter((r) => r.assignable);

  const run = async (action: "assign_role" | "activate" | "deactivate") => {
    setBusy(true);
    const d = await api<{ updated: number; skipped: { name: string | null; reason: string }[] }>("/api/users/bulk", { method: "POST", body: { ids, action, roleId: roleId || undefined } });
    setBusy(false);
    if (!d.success || !d.data) return toast.error(d.error || "Could not apply the change");
    const { updated, skipped } = d.data;
    const verb = action === "assign_role" ? `given ${roles.find((r) => r.id === roleId)?.nameEn ?? "the role"}` : action === "activate" ? "activated" : "deactivated";
    toast.success(`${updated} ${updated === 1 ? "person" : "people"} ${verb}.`);
    if (skipped.length) toast.error(`${skipped.length} skipped. ${skipped[0].name ? `${skipped[0].name}: ` : ""}${skipped[0].reason}`, { duration: 6000 });
    onDone();
  };

  return (
    <div className="fixed bottom-4 inset-x-4 lg:inset-x-auto lg:start-1/2 lg:-translate-x-1/2 rtl:lg:translate-x-1/2 z-40 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-2.5 shadow-2xl">
      <span className="text-sm font-medium tabular-nums">{ids.length} selected</span>
      {canAssign && (
        <span className="flex items-center gap-1.5">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-8 rounded-lg bg-white/10 text-sm text-white px-2 outline-none [&>option]:text-slate-900">
            <option value="">Give role...</option>
            {assignable.map((r) => <option key={r.id} value={r.id}>{r.nameEn}</option>)}
          </select>
          <button disabled={!roleId || busy} onClick={() => run("assign_role")} className="h-8 rounded-lg bg-white text-slate-900 px-3 text-sm font-semibold disabled:opacity-50">Apply</button>
        </span>
      )}
      <button disabled={busy} onClick={() => run("activate")} className="h-8 rounded-lg px-3 text-sm hover:bg-white/10 disabled:opacity-50">Activate</button>
      <button disabled={busy} onClick={() => run("deactivate")} className="h-8 rounded-lg px-3 text-sm text-rose-300 hover:bg-white/10 disabled:opacity-50">Deactivate</button>
      <button onClick={onClear} className="h-8 rounded-lg px-3 text-sm text-white/60 hover:text-white">Clear</button>
    </div>
  );
}

function CreateUser({ roles, canAssign, onClose, onCreated }: { roles: RoleDTO[]; canAssign: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const options = roles.filter((r) => r.assignable && (canAssign || r.key === "customer"));
  const [f, setF] = useState({ nameEn: "", nameAr: "", phone: "", email: "", password: "", roleId: (options.find((r) => r.key === "customer") ?? options[0])?.id ?? "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.phone.trim() && !f.email.trim()) return setErr("Enter a mobile number or an email.");
    setBusy(true);
    setErr("");
    const d = await api<{ id: string }>("/api/users", {
      method: "POST",
      body: { nameEn: f.nameEn, nameAr: f.nameAr || null, phone: f.phone.trim() || null, email: f.email.trim() || null, password: f.password, roleId: f.roleId || null },
    });
    setBusy(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not create the account");
    toast.success("Account created");
    onCreated(d.data.id);
  };

  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    setF((x) => ({ ...x, password: Array.from(crypto.getRandomValues(new Uint32Array(10)), (b) => chars[b % chars.length]).join("") }));
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      className="!max-w-lg"
      title="Add person"
      footer={
        <>
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button type="submit" form="create-user" disabled={busy} className="admin-btn admin-btn-primary disabled:opacity-60">{busy ? "Creating..." : "Create account"}</button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <L label="Name (English)"><input className="admin-input" required minLength={2} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></L>
          <L label="Name (Arabic)"><input className="admin-input" dir="rtl" value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} /></L>
          <L label="Mobile"><input className="admin-input" dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="9123 4567" /></L>
          <L label="Email"><input className="admin-input" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" /></L>
        </div>
        <p className="text-xs text-slate-500 -mt-2">Mobile or email, at least one. They sign in with either.</p>
        <L label="Password">
          <div className="flex gap-2">
            <input className="admin-input" dir="ltr" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="At least 6 characters" autoComplete="new-password" />
            <button type="button" onClick={generate} className="admin-btn admin-btn-secondary whitespace-nowrap">Generate</button>
          </div>
        </L>
        <L label="Role">
          <select className="admin-input admin-select" value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}>
            {options.map((r) => (
              <option key={r.id} value={r.id}>{r.nameEn} · {TYPE_META[r.type].label} · {r.key === "super_admin" ? "every permission" : `${r.permissionCount} permissions`}</option>
            ))}
          </select>
          {!canAssign && <span className="block text-xs text-slate-500 mt-1.5">You can only create customer accounts.</span>}
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
