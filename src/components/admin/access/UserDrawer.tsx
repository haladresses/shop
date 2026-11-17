"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { LuCheck, LuKeyRound, LuLock, LuLogOut, LuMail, LuMessageCircle, LuMinus, LuPhone, LuPlus, LuRefreshCw, LuSearch, LuTrash2, LuX } from "react-icons/lu";
import {
  Avatar,
  KIND_META,
  RolePill,
  TypeBadge,
  ago,
  api,
  fmtDate,
  fmtDateTime,
  friendlyLabel,
  type AccountType,
  type PermissionGroup,
  type PermissionItem,
} from "@/components/admin/access/shared";

type RoleOption = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  color: string;
  type: AccountType;
  rank: number;
  permissions: string[];
  permissionCount: number;
  assignable: boolean;
  reason: string | null;
};

type Detail = {
  id: string;
  email: string | null;
  phone: string | null;
  nameEn: string | null;
  nameAr: string | null;
  role: AccountType;
  roleId: string | null;
  appRole: { id: string; key: string; nameEn: string; nameAr: string | null; color: string; type: AccountType; rank: number } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastSessionAt: string | null;
  posPinSet: boolean;
  posPinLockedUntil: string | null;
  overrides: { grant: string[]; revoke: string[] };
  rolePermissions: string[];
  effectivePermissions: string[];
  totalSpent: number;
  recentOrders: { id: string; orderNumber: string; total: number; status: string; source: string; createdAt: string }[];
  history: { id: string; action: string; createdAt: string; by: { id: string; nameEn: string | null } | null; details: Record<string, unknown> | null }[];
  isSelf: boolean;
  canManage: boolean;
  manageReason: string | null;
  canAssignRoles: boolean;
  viewerPermissions: string[];
  roles: RoleOption[];
  _count: { orders: number; reviews: number; addresses: number; sessions: number; posSales: number };
};

type Tab = "profile" | "access" | "security" | "activity";
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [u, setU] = useState<Detail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [tab, setTab] = useState<Tab>("profile");
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    const d = await api<Detail>(`/api/users/${id}`);
    if (!d.success || !d.data) return setFailed(d.error || "Could not load this account");
    setU(d.data);
  }, [id]);

  useEffect(() => {
    setMounted(true);
    load();
    api<{ groups: PermissionGroup[] }>("/api/admin/permissions").then((d) => d.success && d.data && setGroups(d.data.groups));
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const refresh = () => {
    load();
    onChanged();
  };

  const patch = async (body: object, okText: string) => {
    const d = await api(`/api/users/${id}`, { method: "PATCH", body });
    if (!d.success) {
      toast.error(d.error || "Could not save");
      return false;
    }
    toast.success(okText);
    refresh();
    return true;
  };

  if (!mounted) return null;

  const locked = !!u && !u.canManage && !u.isSelf;
  const name = u ? u.nameEn || u.email || u.phone || "Unnamed" : "";
  const digits = (u?.phone || "").replace(/\D/g, "");
  const tabs: [Tab, string][] = [
    ["profile", "Profile"],
    ["access", "Role & permissions"],
    ["security", "Security"],
    ["activity", "Activity"],
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="relative w-full sm:max-w-2xl h-full bg-slate-50 shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-label={name || "Account"}>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-4">
          <div className="flex items-start gap-3">
            {u ? <Avatar name={name} color={u.appRole?.color} muted={!u.isActive} size="lg" /> : <span className="w-14 h-14 rounded-full bg-slate-100" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <h2 className="text-lg font-semibold text-slate-900 truncate">{u ? u.nameEn || "Unnamed" : "Loading..."}</h2>
                {u?.nameAr && <span className="text-sm text-slate-400" dir="rtl">{u.nameAr}</span>}
              </div>
              {u && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <RolePill role={u.appRole} size="md" />
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {u.isActive ? "Active" : "Deactivated"}
                  </span>
                  {u.isSelf && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-700">You</span>}
                  {u.overrides.grant.length + u.overrides.revoke.length > 0 && (
                    <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700">Personal permissions</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {u?.phone && (
                <>
                  <a href={`tel:${u.phone}`} className="hidden sm:flex w-9 h-9 rounded-lg ring-1 ring-slate-200 items-center justify-center text-slate-600 hover:bg-slate-50" title="Call"><LuPhone size={16} /></a>
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="hidden sm:flex w-9 h-9 rounded-lg ring-1 ring-slate-200 items-center justify-center text-emerald-600 hover:bg-emerald-50" title="WhatsApp"><LuMessageCircle size={16} /></a>
                </>
              )}
              {u?.email && <a href={`mailto:${u.email}`} className="hidden sm:flex w-9 h-9 rounded-lg ring-1 ring-slate-200 items-center justify-center text-slate-600 hover:bg-slate-50" title="Email"><LuMail size={16} /></a>}
              <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"><LuX size={18} /></button>
            </div>
          </div>
          <nav className="flex gap-5 mt-4 -mb-px overflow-x-auto no-scrollbar">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 pb-2.5 text-sm font-medium border-b-2 ${tab === k ? "border-indigo-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {failed && <p className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{failed}</p>}
          {!u && !failed && <p className="text-sm text-slate-500">Loading...</p>}
          {u && locked && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
              <LuLock size={15} className="mt-0.5 shrink-0" /> {u.manageReason ?? "You can't change this account."} View only.
            </p>
          )}
          {u && tab === "profile" && <ProfileTab key={u.updatedAt} u={u} locked={locked} onSave={patch} />}
          {u && tab === "access" && <AccessTab key={`${u.updatedAt}-${u.roleId}`} u={u} groups={groups} onSave={patch} />}
          {u && tab === "security" && <SecurityTab u={u} locked={locked} onChanged={refresh} onDeleted={() => { onChanged(); onClose(); }} />}
          {u && tab === "activity" && <ActivityTab u={u} />}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ───────── profile ─────────

function ProfileTab({ u, locked, onSave }: { u: Detail; locked: boolean; onSave: (b: object, t: string) => Promise<boolean> }) {
  const [f, setF] = useState({ nameEn: u.nameEn || "", nameAr: u.nameAr || "", email: u.email || "", phone: u.phone || "" });
  const dirty = f.nameEn !== (u.nameEn || "") || f.nameAr !== (u.nameAr || "") || f.email !== (u.email || "") || f.phone !== (u.phone || "");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.email.trim() && !f.phone.trim()) return toast.error("Keep a mobile number or an email on the account.");
    onSave({ nameEn: f.nameEn, nameAr: f.nameAr || null, email: f.email.trim() || null, phone: f.phone.trim() || null }, "Profile saved");
  };
  return (
    <>
      <form onSubmit={submit} className="admin-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <L label="Name (English)"><input className="admin-input" required minLength={2} disabled={locked} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></L>
          <L label="Name (Arabic)"><input className="admin-input" dir="rtl" disabled={locked} value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} /></L>
          <L label="Mobile"><input className="admin-input" dir="ltr" inputMode="tel" disabled={locked} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="9123 4567" /></L>
          <L label="Email"><input className="admin-input" dir="ltr" type="email" disabled={locked} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" /></L>
        </div>
        <p className="text-xs text-slate-500">They can sign in with either the mobile number or the email. At least one is needed.</p>
        {!locked && <button disabled={!dirty} className="admin-btn admin-btn-primary disabled:opacity-50">Save profile</button>}
      </form>

      <div className="admin-card">
        <table className="admin-table">
          <tbody>
            {[
              ["Orders", String(u._count.orders)],
              ["Total spent (paid)", money(u.totalSpent)],
              ["POS sales rung up", String(u._count.posSales)],
              ["Saved addresses", String(u._count.addresses)],
              ["Reviews", String(u._count.reviews)],
              ["Member since", fmtDate(u.createdAt)],
              ["Last sign-in", u.lastLoginAt ? `${fmtDateTime(u.lastLoginAt)} (${ago(u.lastLoginAt)})` : "Never"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="text-slate-500">{k}</td>
                <td className="text-right tabular-nums font-medium">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────── role & permissions ─────────

type PermState = "role" | "extra" | "removed" | "off";

function AccessTab({ u, groups, onSave }: { u: Detail; groups: PermissionGroup[]; onSave: (b: object, t: string) => Promise<boolean> }) {
  const canEdit = u.canManage && !u.isSelf && u.canAssignRoles;
  const [roleId, setRoleId] = useState(u.roleId ?? "");
  const [grant, setGrant] = useState<string[]>(u.overrides.grant);
  const [revoke, setRevoke] = useState<string[]>(u.overrides.revoke);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "changes" | "effective">("all");
  const [saving, setSaving] = useState(false);

  const role = u.roles.find((r) => r.id === roleId) ?? null;
  const isSuper = role?.type === "SUPER_ADMIN";
  const rolePerms = useMemo(() => new Set(role ? role.permissions : u.rolePermissions), [role, u.rolePermissions]);
  const viewer = useMemo(() => new Set(u.viewerPermissions), [u.viewerPermissions]);

  // Overrides only mean something relative to the role: drop the ones the new role makes redundant.
  const cleanGrant = grant.filter((k) => !rolePerms.has(k));
  const cleanRevoke = revoke.filter((k) => rolePerms.has(k));
  const stateOf = (k: string): PermState => (cleanGrant.includes(k) ? "extra" : cleanRevoke.includes(k) ? "removed" : rolePerms.has(k) ? "role" : "off");
  const effective = isSuper ? groups.reduce((n, g) => n + g.permissions.length, 0) : rolePerms.size + cleanGrant.length - cleanRevoke.length;

  const toggle = (k: string) => {
    const s = stateOf(k);
    if (s === "role") setRevoke((r) => [...r, k]);
    else if (s === "removed") setRevoke((r) => r.filter((x) => x !== k));
    else if (s === "extra") setGrant((g) => g.filter((x) => x !== k));
    else if (viewer.has(k)) setGrant((g) => [...g, k]);
  };

  const roleChanged = roleId !== (u.roleId ?? "");
  const sorted = (a: string[]) => [...a].sort().join();
  const dirty = roleChanged || sorted(cleanGrant) !== sorted(u.overrides.grant) || sorted(cleanRevoke) !== sorted(u.overrides.revoke);

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = { overrides: { grant: cleanGrant, revoke: cleanRevoke } };
    if (roleChanged) body.roleId = roleId;
    await onSave(body, roleChanged ? `Role changed to ${role?.nameEn}. They've been signed out so it applies everywhere.` : "Permissions saved");
    setSaving(false);
  };

  const term = q.trim().toLowerCase();
  const visible = groups
    .map((g) => ({
      ...g,
      items: g.permissions.filter((p) => {
        if (term && !`${friendlyLabel(p)} ${p.description} ${p.group}`.toLowerCase().includes(term)) return false;
        const s = stateOf(p.key);
        if (show === "changes") return s === "extra" || s === "removed";
        if (show === "effective") return s === "role" || s === "extra";
        return true;
      }),
    }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="admin-card p-4">
        <p className="text-sm font-semibold text-slate-800">Role</p>
        <p className="text-xs text-slate-500 mb-3">
          {u.isSelf ? "You can't change your own role or permissions." : !u.canAssignRoles ? "You don't have permission to change roles." : "Each person has one role. Roles you can't give are greyed out."}
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {u.roles.map((r) => {
            const selected = r.id === roleId;
            const disabled = !canEdit || (!r.assignable && !selected);
            return (
              <button
                key={r.id}
                type="button"
                disabled={disabled}
                onClick={() => setRoleId(r.id)}
                title={!r.assignable && r.reason ? r.reason : undefined}
                className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-start ring-1 disabled:cursor-not-allowed ${selected ? "ring-2 ring-indigo-400 bg-indigo-50/60" : "ring-slate-200 enabled:hover:bg-slate-50"} ${disabled && !selected ? "opacity-45" : ""}`}
              >
                <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800">{r.nameEn}</span>
                    <TypeBadge type={r.type} />
                  </span>
                  <span className="block text-[11px] text-slate-500">{r.type === "SUPER_ADMIN" ? "Every permission" : `${r.permissionCount} permissions`} · level {r.rank}</span>
                  {!r.assignable && !selected && r.reason && <span className="block text-[11px] text-slate-400"><LuLock size={9} className="inline" /> {r.reason}</span>}
                </span>
                {selected && <LuCheck size={16} className="text-indigo-600 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {isSuper ? (
        <p className="rounded-xl bg-fuchsia-50 text-fuchsia-800 text-sm px-4 py-3">Super admins always have every permission. Personal changes don&apos;t apply.</p>
      ) : (
        <div className="admin-card">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Personal permissions</p>
              <p className="text-xs text-slate-500">
                Exceptions for this person only, on top of the role. Tick to add (<LuPlus className="inline" size={11} />), untick a role permission to remove it (<LuMinus className="inline" size={11} />).
              </p>
            </div>
            <table className="admin-table text-sm">
              <tbody>
                <tr><td className="!py-1.5 text-slate-500">From role{role ? ` (${role.nameEn})` : ""}</td><td className="!py-1.5 text-right tabular-nums font-medium">{rolePerms.size}</td></tr>
                <tr><td className="!py-1.5 text-emerald-700">Extra for this person</td><td className="!py-1.5 text-right tabular-nums font-medium text-emerald-700">+{cleanGrant.length}</td></tr>
                <tr><td className="!py-1.5 text-rose-700">Removed for this person</td><td className="!py-1.5 text-right tabular-nums font-medium text-rose-700">{cleanRevoke.length ? `-${cleanRevoke.length}` : "0"}</td></tr>
                <tr><td className="!py-1.5 font-semibold text-slate-800">Effective</td><td className="!py-1.5 text-right tabular-nums font-bold">{effective}</td></tr>
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <LuSearch size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions" className="admin-input !py-1.5 !ps-8" />
              </div>
              <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className="admin-input admin-select !py-1.5 !w-auto">
                <option value="all">All permissions</option>
                <option value="effective">What they can do</option>
                <option value="changes">Only personal changes</option>
              </select>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {visible.map((g) => (
              <div key={g.group}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{g.group}</p>
                <ul className="rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100 bg-white">
                  {g.items.map((p) => (
                    <PermRow key={p.key} p={p} state={stateOf(p.key)} disabled={!canEdit || (stateOf(p.key) === "off" && !viewer.has(p.key))} onClick={() => toggle(p.key)} />
                  ))}
                </ul>
              </div>
            ))}
            {visible.length === 0 && <p className="text-sm text-slate-400 text-center py-6">{show === "changes" ? "No personal changes. They have exactly what the role gives." : "Nothing matches."}</p>}
          </div>
        </div>
      )}

      {canEdit && dirty && (
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center gap-2">
          <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary disabled:opacity-60">{saving ? "Saving..." : "Save access"}</button>
          <button onClick={() => { setRoleId(u.roleId ?? ""); setGrant(u.overrides.grant); setRevoke(u.overrides.revoke); }} className="admin-btn admin-btn-secondary">Discard</button>
          {roleChanged && <span className="text-xs text-slate-500">They&apos;ll be signed out once so the new role applies.</span>}
        </div>
      )}
    </div>
  );
}

function PermRow({ p, state, disabled, onClick }: { p: PermissionItem; state: PermState; disabled: boolean; onClick: () => void }) {
  const on = state === "role" || state === "extra";
  return (
    <li>
      <button type="button" disabled={disabled} onClick={onClick} className="w-full flex items-start gap-3 px-3 py-2.5 text-start enabled:hover:bg-slate-50 disabled:cursor-not-allowed">
        <span
          className={`mt-0.5 w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0 ${
            state === "extra" ? "bg-emerald-600 text-white" : state === "role" ? "bg-slate-800 text-white" : state === "removed" ? "bg-rose-50 ring-1 ring-inset ring-rose-300 text-rose-600" : "ring-1 ring-inset ring-slate-300"
          }`}
        >
          {on && <LuCheck size={12} strokeWidth={3} />}
          {state === "removed" && <LuMinus size={12} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm ${state === "removed" ? "text-slate-400 line-through" : "text-slate-800"}`}>{friendlyLabel(p)}</span>
            <span className={`text-[10px] font-semibold rounded px-1.5 py-px ${KIND_META[p.kind].cls}`}>{KIND_META[p.kind].label}</span>
          </span>
          <span className="block text-xs text-slate-500 leading-snug">{p.description}</span>
        </span>
        {state === "role" && <span className="text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 whitespace-nowrap">From role</span>}
        {state === "extra" && <span className="text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">Extra</span>}
        {state === "removed" && <span className="text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 px-2 py-0.5">Removed</span>}
      </button>
    </li>
  );
}

// ───────── security ─────────

function SecurityTab({ u, locked, onChanged, onDeleted }: { u: Detail; locked: boolean; onChanged: () => void; onDeleted: () => void }) {
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const run = async (url: string, method: string, body: object | undefined, okText: string) => {
    const d = await api<{ signedOut?: number }>(url, { method, body });
    if (!d.success) {
      toast.error(d.error || "Failed");
      return false;
    }
    toast.success(typeof d.data?.signedOut === "number" ? `Signed out of ${d.data.signedOut} session${d.data.signedOut === 1 ? "" : "s"}` : okText);
    onChanged();
    return true;
  };

  if (locked) return <p className="text-sm text-slate-500">Security actions aren&apos;t available for this account.</p>;
  const canUsePos = u.effectivePermissions.includes("pos.access") || u.role !== "CUSTOMER";

  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint32Array(10));
    setPw(Array.from(bytes, (b) => chars[b % chars.length]).join(""));
    setShowPw(true);
  };

  return (
    <div className="space-y-3">
      {!u.isSelf && (
        <Box title={u.isActive ? "Deactivate account" : "Reactivate account"} desc={u.isActive ? "They're signed out right away and can't sign in. Orders and history are kept." : "Allow this person to sign in again."}>
          <button
            onClick={() => run(`/api/users/${u.id}`, "PATCH", { isActive: !u.isActive }, u.isActive ? "Account deactivated" : "Account reactivated")}
            className={`admin-btn ${u.isActive ? "admin-btn-danger" : "admin-btn-primary"}`}
          >
            {u.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </Box>
      )}

      {!u.isSelf && (
        <Box title="Set a new password" desc="At least 6 characters. Signs them out on every device.">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(`/api/users/${u.id}/password`, "POST", { password: pw }, "Password updated")) setPw("");
            }}
          >
            <input type={showPw ? "text" : "password"} minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="admin-input !py-2 flex-1 min-w-[160px]" dir="ltr" autoComplete="new-password" />
            <button type="button" onClick={generate} className="admin-btn admin-btn-secondary" title="Generate a strong password"><LuRefreshCw size={14} /> Generate</button>
            <button className="admin-btn admin-btn-primary"><LuKeyRound size={15} /> Set</button>
          </form>
        </Box>
      )}

      {canUsePos && (
        <Box title={`POS PIN: ${u.posPinSet ? "set" : "not set"}`} desc={`4-digit PIN to sign in at the till.${u.effectivePermissions.includes("pos.access") ? "" : " Their role doesn't allow the POS yet."}${u.posPinLockedUntil && new Date(u.posPinLockedUntil) > new Date() ? ` Locked until ${fmtDateTime(u.posPinLockedUntil)} after wrong attempts; saving a new PIN unlocks it.` : ""}`}>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(`/api/users/${u.id}/pos-pin`, "PATCH", { pin }, "POS PIN saved")) setPin("");
            }}
          >
            <input inputMode="numeric" pattern="\d{4}" maxLength={4} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="0000" className="admin-input !py-2 !w-28 tracking-[.4em] tabular-nums" dir="ltr" />
            <button className="admin-btn admin-btn-secondary">Save PIN</button>
            {u.posPinSet && (
              <button type="button" onClick={() => run(`/api/users/${u.id}/pos-pin`, "PATCH", { pin: null }, "PIN removed")} className="admin-btn admin-btn-secondary !text-rose-600">Remove</button>
            )}
          </form>
        </Box>
      )}

      {!u.isSelf && (
        <Box title={`Signed in on ${u._count.sessions} device${u._count.sessions === 1 ? "" : "s"}`} desc={u.lastSessionAt ? `Latest sign-in session started ${fmtDateTime(u.lastSessionAt)}.` : "No active sessions."}>
          <button onClick={() => run(`/api/users/${u.id}/sessions`, "DELETE", undefined, "Signed out")} disabled={u._count.sessions === 0} className="admin-btn admin-btn-secondary disabled:opacity-50">
            <LuLogOut size={15} /> Sign out everywhere
          </button>
        </Box>
      )}

      {!u.isSelf && (
        <Box title="Delete account" desc="Only for accounts without orders, reviews or POS history. Otherwise deactivate it.">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-rose-700">Delete permanently?</span>
              <button
                onClick={async () => {
                  if (await run(`/api/users/${u.id}`, "DELETE", undefined, "Account deleted")) onDeleted();
                  setConfirmDelete(false);
                }}
                className="admin-btn admin-btn-danger"
              >
                <LuTrash2 size={15} /> Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="admin-btn admin-btn-secondary">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="admin-btn admin-btn-danger"><LuTrash2 size={15} /> Delete</button>
          )}
        </Box>
      )}
    </div>
  );
}

// ───────── activity ─────────

function describeChange(action: string, d: Record<string, unknown> | null): string {
  if (action === "user.create") return "Account created";
  if (action === "user.password_reset") return "Password reset";
  if (action !== "user.update" || !d) return action.replace(/^user\./, "").replace(/_/g, " ");
  const parts: string[] = [];
  if (typeof d.roleName === "string") parts.push(`Role set to ${d.roleName}`);
  if (d.isActive === false) parts.push("Deactivated");
  if (d.isActive === true) parts.push("Reactivated");
  if (d.overrides) parts.push("Personal permissions changed");
  if (["nameEn", "nameAr", "email", "phone"].some((k) => k in d)) parts.push("Profile updated");
  return parts.join(", ") || "Updated";
}

function ActivityTab({ u }: { u: Detail }) {
  return (
    <div className="space-y-4">
      <div className="admin-card">
        <table className="admin-table">
          <tbody>
            <tr><td className="text-slate-500">Last sign-in</td><td className="text-right">{u.lastLoginAt ? `${fmtDateTime(u.lastLoginAt)} (${ago(u.lastLoginAt)})` : "Never"}</td></tr>
            <tr><td className="text-slate-500">Latest session started</td><td className="text-right">{fmtDateTime(u.lastSessionAt)}</td></tr>
            <tr><td className="text-slate-500">Account created</td><td className="text-right">{fmtDateTime(u.createdAt)}</td></tr>
            <tr><td className="text-slate-500">Last changed</td><td className="text-right">{fmtDateTime(u.updatedAt)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="admin-card overflow-x-auto">
        <p className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">Account changes</p>
        <table className="admin-table min-w-[480px]">
          <thead>
            <tr><th>When</th><th>Change</th><th>By</th></tr>
          </thead>
          <tbody>
            {u.history.map((h) => (
              <tr key={h.id}>
                <td className="whitespace-nowrap text-xs text-slate-600">{fmtDateTime(h.createdAt)}</td>
                <td>{describeChange(h.action, h.details)}</td>
                <td className="text-slate-600">{h.by?.nameEn || "-"}</td>
              </tr>
            ))}
            {u.history.length === 0 && <tr><td colSpan={3} className="text-center text-sm text-slate-400 py-6">No changes recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="admin-card overflow-x-auto">
        <p className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">Recent orders · {u._count.orders}</p>
        <table className="admin-table min-w-[480px]">
          <thead>
            <tr><th>Order</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr>
          </thead>
          <tbody>
            {u.recentOrders.map((o) => (
              <tr key={o.id}>
                <td><a href={`/admin/orders?search=${o.orderNumber}`} className="font-medium text-indigo-600 hover:underline">{o.orderNumber}</a></td>
                <td className="text-xs text-slate-600 whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                <td className="text-xs capitalize">{o.status.toLowerCase().replace(/_/g, " ")}{o.source === "POS" ? " · POS" : ""}</td>
                <td className="text-right tabular-nums font-medium">{money(o.total)}</td>
              </tr>
            ))}
            {u.recentOrders.length === 0 && <tr><td colSpan={4} className="text-center text-sm text-slate-400 py-6">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
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
    <div className="admin-card p-4">
      <p className="font-medium text-slate-800 text-sm">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">{desc}</p>
      {children}
    </div>
  );
}
