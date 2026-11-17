"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LuArrowLeft, LuCheck, LuCopy, LuLock, LuMinus, LuSearch, LuTrash2, LuTriangleAlert, LuUserPlus, LuUsers } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import {
  AREA_LABEL,
  Avatar,
  CUSTOM_TYPES,
  ColorDot,
  KIND_META,
  RolePill,
  TYPE_META,
  TypeBadge,
  ago,
  api,
  friendlyLabel,
  permissionWarnings,
  togglePermission,
  type AccountType,
  type PermissionGroup,
  type PermissionItem,
  type RoleDTO,
  type RolesPayload,
} from "@/components/admin/access/shared";

type Form = { nameEn: string; nameAr: string; description: string; color: string; type: AccountType; rank: number; permissions: Set<string> };

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every((k) => b.has(k));

export default function RoleEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const [payload, setPayload] = useState<RolesPayload | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[] | null>(null);
  const [role, setRole] = useState<RoleDTO | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [tab, setTab] = useState<"permissions" | "people">("permissions");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const toForm = (r: RoleDTO): Form => ({
    nameEn: r.nameEn,
    nameAr: r.nameAr ?? "",
    description: r.description ?? "",
    color: r.color,
    type: r.type,
    rank: r.rank,
    permissions: new Set(r.permissions),
  });

  const load = useCallback(async () => {
    const [p, c, r] = await Promise.all([
      api<RolesPayload>("/api/admin/roles"),
      api<{ groups: PermissionGroup[] }>("/api/admin/permissions"),
      id ? api<RoleDTO>(`/api/admin/roles/${id}`) : Promise.resolve(null),
    ]);
    if (!p.success || !p.data || !c.success || !c.data) return toast.error(p.error || c.error || "Could not load");
    setPayload(p.data);
    setGroups(c.data.groups);
    if (id) {
      if (!r?.success || !r.data) return setNotFound(true);
      setRole(r.data);
      setForm(toForm(r.data));
    } else {
      const v = p.data.viewer;
      setForm({ nameEn: "", nameAr: "", description: "", color: p.data.colors[2] ?? "#4f46e5", type: "STAFF", rank: Math.max(0, Math.min(50, v.maxRank)), permissions: new Set() });
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const catalog = useMemo(() => new Map((groups ?? []).flatMap((g) => g.permissions.map((p) => [p.key, p] as const))), [groups]);

  if (notFound) {
    return (
      <div className="admin-card p-10 text-center">
        <p className="font-medium text-slate-800">This role doesn&apos;t exist anymore.</p>
        <Link href="/admin/roles" className="admin-btn admin-btn-secondary mt-4">Back to roles</Link>
      </div>
    );
  }
  if (!payload || !groups || !form) return <div className="flex justify-center py-16"><span className="spinner" /></div>;

  const { viewer, colors } = payload;
  const isNew = id === null;
  const isSuperRole = role?.key === "super_admin";
  const canEditPerms = isNew ? viewer.canManageRoles && viewer.maxRank >= 0 : !!role?.editable;
  const canEditLabels = isNew ? canEditPerms : !!role?.labelsEditable;
  const isSystem = !!role?.isSystem;
  const mine = new Set(viewer.permissions);
  const grantable = (k: string) => viewer.isSuper || mine.has(k);

  const initial = role ? toForm(role) : null;
  const dirty =
    isNew ||
    !initial ||
    form.nameEn !== initial.nameEn ||
    form.nameAr !== initial.nameAr ||
    form.description !== initial.description ||
    form.color !== initial.color ||
    form.type !== initial.type ||
    form.rank !== initial.rank ||
    !sameSet(form.permissions, initial.permissions);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (form.nameEn.trim().length < 2) return toast.error("Enter a name of at least 2 characters");
    setSaving(true);
    const labels = { nameEn: form.nameEn.trim(), nameAr: form.nameAr.trim() || null, description: form.description.trim() || null, color: form.color };
    const body = isSuperRole ? labels : isSystem ? { ...labels, permissions: Array.from(form.permissions) } : { ...labels, type: form.type, rank: form.rank, permissions: Array.from(form.permissions) };
    const d = isNew ? await api<RoleDTO>("/api/admin/roles", { method: "POST", body }) : await api<RoleDTO>(`/api/admin/roles/${id}`, { method: "PATCH", body });
    setSaving(false);
    if (!d.success || !d.data) return toast.error(d.error || "Could not save");
    toast.success(isNew ? "Role created" : "Role saved. It applies right away.");
    if (isNew) router.replace(`/admin/roles/${d.data.id}`);
    else {
      setRole(d.data);
      setForm(toForm(d.data));
    }
  };

  const duplicate = async () => {
    if (!role) return;
    const d = await api<RoleDTO>(`/api/admin/roles/${role.id}/duplicate`, { method: "POST", body: {} });
    if (!d.success || !d.data) return toast.error(d.error || "Could not copy the role");
    toast.success(`Created ${d.data.nameEn}`);
    router.push(`/admin/roles/${d.data.id}`);
  };

  const warnings = isSuperRole ? [] : permissionWarnings(form.permissions);

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/roles" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-1">
            <LuArrowLeft size={14} /> Roles
          </Link>
          {/* A new role has no name yet; the top bar already says "New Role". */}
          {!isNew && (
            <div className="flex flex-wrap items-center gap-2">
              <ColorDot color={form.color} size={12} />
              <h1 className="text-xl font-semibold text-slate-800 truncate">{role?.nameEn}</h1>
              {role && <TypeBadge type={role.type} />}
              {isSystem && <span className="text-xs font-medium rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">Built-in</span>}
            </div>
          )}
          {role && (
            <p className="text-xs text-slate-500 mt-1">
              {role.userCount} {role.userCount === 1 ? "person" : "people"} · Updated {ago(role.updatedAt)}
              {role.createdBy?.nameEn ? ` · Created by ${role.createdBy.nameEn}` : ""}
            </p>
          )}
        </div>
        {role && (
          <div className="flex flex-wrap gap-2">
            {viewer.canManageRoles && viewer.maxRank >= 0 && (
              <button onClick={duplicate} className="admin-btn admin-btn-secondary"><LuCopy size={15} /> Duplicate</button>
            )}
            {role.deletable && (
              <button onClick={() => setConfirmDelete(true)} className="admin-btn admin-btn-danger"><LuTrash2 size={15} /> Delete</button>
            )}
          </div>
        )}
      </div>

      {role?.lockedReason && !role.editable && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
          <LuLock size={15} className="mt-0.5 shrink-0" />
          <span>
            {isSuperRole ? "Super admins always have every permission." : role.lockedReason} {role.labelsEditable ? "You can still change its name and colour." : "You can view it, but not change it."}
          </span>
        </p>
      )}

      {/* Tabs */}
      {role && (
        <nav className="flex gap-5 border-b border-slate-200 overflow-x-auto no-scrollbar">
          {([
            ["permissions", "Details & permissions"],
            ["people", `People with this role · ${role.userCount}`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`shrink-0 pb-2.5 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-indigo-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {label}
            </button>
          ))}
        </nav>
      )}

      {tab === "people" && role ? (
        <RoleMembers role={role} payload={payload} onChanged={load} />
      ) : (
        <>
          <Details form={form} set={set} colors={colors} canEditLabels={canEditLabels} canEditPerms={canEditPerms} isSystem={isSystem} isSuperRole={isSuperRole} viewer={viewer} />

          {warnings.map((w) => (
            <div key={w.fix} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
              <span className="flex items-start gap-2"><LuTriangleAlert size={15} className="mt-0.5 shrink-0" />{w.text}</span>
              {canEditPerms && grantable(w.fix) && (
                <button onClick={() => set({ permissions: togglePermission(form.permissions, w.fix, true, catalog, grantable) })} className="admin-btn admin-btn-secondary !py-1.5">Add it</button>
              )}
            </div>
          ))}

          <PermissionMatrix
            groups={groups}
            catalog={catalog}
            value={form.permissions}
            onChange={(permissions) => set({ permissions })}
            readOnly={!canEditPerms || isSuperRole}
            allOn={isSuperRole}
            grantable={grantable}
          />
        </>
      )}

      {/* Save bar */}
      {tab === "permissions" && (canEditPerms || canEditLabels) && dirty && (
        <div className="fixed bottom-5 inset-x-4 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 z-40 flex items-center justify-between sm:justify-start gap-3 rounded-2xl bg-slate-900 text-white ps-5 pe-2 py-2 shadow-2xl">
          <span className="text-sm">{isNew ? "New role" : "Unsaved changes"} · {isSuperRole ? "All" : form.permissions.size} permissions</span>
          <span className="flex gap-1">
            {!isNew && initial && (
              <button onClick={() => setForm(initial)} className="rounded-xl px-3 py-1.5 text-sm text-white/70 hover:text-white">Discard</button>
            )}
            <button onClick={save} disabled={saving} className="rounded-xl bg-white text-slate-900 px-4 py-1.5 text-sm font-semibold disabled:opacity-60">
              {saving ? "Saving..." : isNew ? "Create role" : "Save"}
            </button>
          </span>
        </div>
      )}

      {confirmDelete && role && (
        <DeleteRoleModal role={role} roles={payload.roles} onClose={() => setConfirmDelete(false)} onDone={() => router.push("/admin/roles")} />
      )}
    </div>
  );
}

// ───────── details card ─────────

function Details({
  form,
  set,
  colors,
  canEditLabels,
  canEditPerms,
  isSystem,
  isSuperRole,
  viewer,
}: {
  form: Form;
  set: (p: Partial<Form>) => void;
  colors: string[];
  canEditLabels: boolean;
  canEditPerms: boolean;
  isSystem: boolean;
  isSuperRole: boolean;
  viewer: RolesPayload["viewer"];
}) {
  const structureLocked = !canEditPerms || isSystem;
  return (
    <div className="admin-card p-5 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name (English)">
          <input className="admin-input" value={form.nameEn} disabled={!canEditLabels} maxLength={60} onChange={(e) => set({ nameEn: e.target.value })} placeholder="e.g. Cashier" />
        </Field>
        <Field label="Name (Arabic)">
          <input className="admin-input" dir="rtl" value={form.nameAr} disabled={!canEditLabels} maxLength={60} onChange={(e) => set({ nameAr: e.target.value })} placeholder="مثال: كاشير" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea className="admin-input min-h-[64px]" value={form.description} disabled={!canEditLabels} maxLength={300} onChange={(e) => set({ description: e.target.value })} placeholder="What people with this role do" />
        </Field>
      </div>

      <Field label="Colour">
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!canEditLabels}
              onClick={() => set({ color: c })}
              aria-label={`Colour ${c}`}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white disabled:cursor-not-allowed ${form.color === c ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
              style={{ backgroundColor: c }}
            >
              {form.color === c && <LuCheck size={15} />}
            </button>
          ))}
        </div>
      </Field>

      {!isSuperRole && (
        <div className="grid lg:grid-cols-[1fr_220px] gap-5">
          <Field label="Account type" hint="Where these people show up: staff lists, POS staff picker, customer lists and reports.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CUSTOM_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={structureLocked}
                  onClick={() => set({ type: t })}
                  className={`rounded-xl px-3 py-2 text-start ring-1 disabled:cursor-not-allowed ${form.type === t ? "ring-indigo-300 bg-indigo-50" : "ring-slate-200 enabled:hover:bg-slate-50"} ${structureLocked && form.type !== t ? "opacity-40" : ""}`}
                >
                  <span className={`block text-sm font-medium ${form.type === t ? "text-indigo-700" : "text-slate-700"}`}>{TYPE_META[t].label}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">{TYPE_META[t].hint}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Level" hint={`0 to ${isSystem ? 99 : Math.max(0, viewer.maxRank)}. Admin 80, Staff 60, Seller 40, Customer 0.${viewer.isSuper ? "" : ` Yours: ${viewer.rank}.`}`}>
            <input
              type="number"
              className="admin-input tabular-nums"
              min={0}
              max={Math.max(0, viewer.maxRank)}
              value={form.rank}
              disabled={structureLocked}
              onChange={(e) => set({ rank: Math.max(0, Math.min(viewer.maxRank, Math.round(Number(e.target.value) || 0))) })}
            />
          </Field>
        </div>
      )}
      {isSystem && !isSuperRole && <p className="text-xs text-slate-500">Built-in role: its account type and level are fixed. Its name, colour and permissions can change.</p>}
    </div>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1.5">{hint}</span>}
    </label>
  );
}

// ───────── permission matrix ─────────

type Show = "all" | "on" | "off" | "view" | "manage";

export function PermissionMatrix({
  groups,
  catalog,
  value,
  onChange,
  readOnly,
  allOn,
  grantable,
}: {
  groups: PermissionGroup[];
  catalog: Map<string, PermissionItem>;
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  readOnly: boolean;
  allOn?: boolean;
  grantable: (k: string) => boolean;
}) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("all");
  const has = (k: string) => !!allOn || value.has(k);
  const total = catalog.size;
  const count = allOn ? total : value.size;

  const term = q.trim().toLowerCase();
  const visible = groups
    .map((g) => ({
      ...g,
      items: g.permissions.filter((p) => {
        if (term && !`${friendlyLabel(p)} ${p.description} ${p.group} ${p.key}`.toLowerCase().includes(term)) return false;
        if (show === "on") return has(p.key);
        if (show === "off") return !has(p.key);
        if (show === "view") return p.kind !== "manage";
        if (show === "manage") return p.kind === "manage";
        return true;
      }),
    }))
    .filter((g) => g.items.length);

  const setMany = (keys: string[], on: boolean) => {
    let next = new Set(value);
    for (const k of keys) if (!on || grantable(k)) next = togglePermission(next, k, on, catalog, grantable);
    onChange(next);
  };

  const areas = Array.from(new Set(visible.map((g) => g.area)));

  return (
    <div className="admin-card">
      <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        <div>
          <p className="font-semibold text-slate-800">Permissions</p>
          <p className="text-xs text-slate-500">
            <span className="tabular-nums font-semibold text-slate-700">{count}</span> of {total} ticked. <span className="font-medium">View</span> lets people see a screen, <span className="font-medium">Manage</span> lets them change things on it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <LuSearch size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions" className="admin-input !py-1.5 !ps-8 !w-48" />
          </div>
          <select value={show} onChange={(e) => setShow(e.target.value as Show)} className="admin-input admin-select !py-1.5 !w-auto">
            <option value="all">All</option>
            <option value="on">Ticked</option>
            <option value="off">Not ticked</option>
            <option value="view">View & access</option>
            <option value="manage">Manage</option>
          </select>
          {!readOnly && (
            <>
              <button onClick={() => setMany(Array.from(catalog.keys()), true)} className="admin-btn admin-btn-secondary !py-1.5">Tick all</button>
              <button onClick={() => onChange(new Set())} className="admin-btn admin-btn-secondary !py-1.5">Clear</button>
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {areas.map((area) => (
          <div key={area}>
            <p className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{AREA_LABEL[area] ?? area}</p>
            <div className="grid xl:grid-cols-2 gap-3 p-4 pt-2">
              {visible
                .filter((g) => g.area === area)
                .map((g) => {
                  const keys = g.permissions.map((p) => p.key);
                  const n = keys.filter(has).length;
                  const state = n === 0 ? "none" : n === keys.length ? "all" : "some";
                  const selectable = keys.filter(grantable);
                  return (
                    <div key={g.group} className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <button
                          type="button"
                          disabled={readOnly || selectable.length === 0}
                          onClick={() => setMany(state === "all" ? keys : selectable, state !== "all")}
                          className="flex items-center gap-2 text-sm font-semibold text-slate-800 disabled:cursor-default"
                          title={readOnly ? undefined : state === "all" ? "Untick the whole group" : "Tick the whole group"}
                        >
                          <Box state={state === "all" ? "on" : state === "some" ? "some" : "off"} disabled={readOnly} />
                          {g.group}
                        </button>
                        <span className="text-[11px] tabular-nums text-slate-400">{n}/{keys.length}</span>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {g.items.map((p) => {
                          const on = has(p.key);
                          const locked = !readOnly && !on && !grantable(p.key);
                          const needs = p.requires.filter((r) => !has(r)).map((r) => catalog.get(r)).filter(Boolean) as PermissionItem[];
                          return (
                            <li key={p.key}>
                              <button
                                type="button"
                                disabled={readOnly || locked}
                                onClick={() => onChange(togglePermission(value, p.key, !on, catalog, grantable))}
                                className="w-full flex items-start gap-3 px-3 py-2.5 text-start enabled:hover:bg-slate-50 disabled:cursor-default"
                              >
                                <Box state={on ? "on" : "off"} disabled={readOnly || locked} />
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <span className={`text-sm ${locked ? "text-slate-400" : "text-slate-800"}`}>{friendlyLabel(p)}</span>
                                    <span className={`text-[10px] font-semibold rounded px-1.5 py-px ${KIND_META[p.kind].cls}`}>{KIND_META[p.kind].label}</span>
                                  </span>
                                  <span className="block text-xs text-slate-500 leading-snug">{p.description}</span>
                                  {locked && (
                                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><LuLock size={10} /> You don&apos;t have this permission, so you can&apos;t give it.</span>
                                  )}
                                  {on && needs.length > 0 && !allOn && (
                                    <span className="mt-0.5 block text-[11px] text-amber-600">Also needs: {needs.map((x) => friendlyLabel(x)).join(", ")}</span>
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No permission matches.</p>}
      </div>
    </div>
  );
}

function Box({ state, disabled }: { state: "on" | "off" | "some"; disabled?: boolean }) {
  return (
    <span
      className={`mt-0.5 w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0 ${
        state === "off" ? "ring-1 ring-inset ring-slate-300 bg-white" : disabled ? "bg-slate-400 text-white" : "bg-indigo-600 text-white"
      }`}
    >
      {state === "on" && <LuCheck size={12} strokeWidth={3} />}
      {state === "some" && <LuMinus size={12} strokeWidth={3} />}
    </span>
  );
}

// ───────── members tab ─────────

type Member = {
  id: string;
  nameEn: string | null;
  nameAr: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  canManage: boolean;
  isSelf: boolean;
};

function RoleMembers({ role, payload, onChanged }: { role: RoleDTO; payload: RolesPayload; onChanged: () => void }) {
  const [rows, setRows] = useState<Member[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const perms = new Set(payload.viewer.permissions);
  const canAssign = perms.has("admin.users.manage") && perms.has("admin.users.assign_roles");
  const targets = payload.roles.filter((r) => r.assignable && r.id !== role.id);
  const customer = payload.roles.find((r) => r.key === "customer" && r.assignable && r.id !== role.id);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ roleId: role.id, pageSize: "100", sort: "name", dir: "asc" });
    if (q.trim()) params.set("search", q.trim());
    const d = await api<{ items: Member[]; meta: { total: number } }>(`/api/users?${params}`);
    if (!d.success || !d.data) return toast.error(d.error || "Could not load people");
    setRows(d.data.items);
    setTotal(d.data.meta.total);
  }, [role.id, q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const move = async (m: Member, roleId: string) => {
    const to = payload.roles.find((r) => r.id === roleId);
    const d = await api(`/api/users/${m.id}`, { method: "PATCH", body: { roleId } });
    if (!d.success) return toast.error(d.error || "Could not change the role");
    toast.success(`Moved ${m.nameEn || "them"} to ${to?.nameEn ?? "the new role"}`);
    load();
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <LuSearch size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or mobile" className="admin-input !ps-8 sm:!w-72" />
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/users?roleId=${role.id}`} className="admin-btn admin-btn-secondary"><LuUsers size={15} /> Open in People</Link>
          {canAssign && role.assignable && (
            <button onClick={() => setAdding(true)} className="admin-btn admin-btn-primary"><LuUserPlus size={15} /> Add people</button>
          )}
        </div>
      </div>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table min-w-[680px]">
          <thead>
            <tr>
              <th>Person</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Last sign-in</th>
              {canAssign && <th className="text-right">Change role</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={5} className="text-center py-8"><span className="spinner inline-block" /></td></tr>
            )}
            {rows?.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/admin/users?id=${m.id}`} className="flex items-center gap-2.5 hover:text-indigo-600">
                    <Avatar name={m.nameEn || m.email || m.phone || "?"} color={role.color} muted={!m.isActive} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{m.nameEn || "Unnamed"}{m.isSelf && <span className="ms-1.5 text-[10px] font-semibold text-indigo-600">YOU</span>}</span>
                      {m.nameAr && <span className="block text-xs text-slate-400" dir="rtl">{m.nameAr}</span>}
                    </span>
                  </Link>
                </td>
                <td className="text-xs text-slate-600" dir="ltr">
                  <span className="block">{m.email || "-"}</span>
                  <span className="block text-slate-400">{m.phone || ""}</span>
                </td>
                <td>{m.isActive ? <span className="text-xs font-medium text-emerald-700">Active</span> : <span className="text-xs font-medium text-rose-600">Deactivated</span>}</td>
                <td className="text-xs text-slate-600 whitespace-nowrap">{ago(m.lastLoginAt)}</td>
                {canAssign && (
                  <td className="text-right whitespace-nowrap">
                    {m.canManage ? (
                      <span className="inline-flex items-center gap-1.5">
                        <select defaultValue="" onChange={(e) => e.target.value && move(m, e.target.value)} className="admin-input admin-select !py-1 !w-40 text-xs">
                          <option value="">Move to...</option>
                          {targets.map((r) => <option key={r.id} value={r.id}>{r.nameEn}</option>)}
                        </select>
                        {customer && (
                          <button onClick={() => move(m, customer.id)} className="admin-btn admin-btn-secondary !py-1 !px-2 text-xs" title="Remove from this role (becomes a customer with no admin access)">Remove</button>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400" title={m.isSelf ? "You can't change your own role" : "At or above your level"}><LuLock size={12} className="inline" /> Locked</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr><td colSpan={5} className="text-center text-sm text-slate-400 py-10">{q ? "Nobody matches." : "Nobody has this role yet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > (rows?.length ?? 0) && <p className="text-xs text-slate-500">Showing {rows?.length} of {total}. Use search or open them in People to see everyone.</p>}

      {adding && (
        <AddPeopleModal
          role={role}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

type Candidate = Member & { appRole: { id: string; nameEn: string; color: string } | null };

function AddPeopleModal({ role, onClose, onDone }: { role: RoleDTO; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ pageSize: "30", sort: "name", dir: "asc" });
      if (q.trim()) params.set("search", q.trim());
      const d = await api<{ items: Candidate[] }>(`/api/users?${params}`);
      if (d.success && d.data) setRows(d.data.items.filter((u) => u.appRole?.id !== role.id));
    }, 200);
    return () => clearTimeout(t);
  }, [q, role.id]);

  const submit = async () => {
    setBusy(true);
    const d = await api<{ updated: number; skipped: { reason: string }[] }>("/api/users/bulk", { method: "POST", body: { action: "assign_role", roleId: role.id, ids: Array.from(picked) } });
    setBusy(false);
    if (!d.success || !d.data) return toast.error(d.error || "Could not add them");
    toast.success(`${d.data.updated} added to ${role.nameEn}${d.data.skipped.length ? `. ${d.data.skipped.length} skipped: ${d.data.skipped[0].reason}` : ""}`);
    onDone();
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      className="!max-w-lg"
      title={<span className="flex items-center gap-2">Add people to <RolePill role={role} size="md" /></span>}
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={busy || picked.size === 0} className="admin-btn admin-btn-primary disabled:opacity-50">
            {busy ? "Saving..." : `Give role to ${picked.size}`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <LuSearch size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or mobile" className="admin-input !ps-8" />
        </div>
        <p className="text-xs text-slate-500">They&apos;re signed out once so the new role applies everywhere.</p>
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200 max-h-80 overflow-y-auto">
          {rows.map((u) => {
            const disabled = !u.canManage;
            const on = picked.has(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setPicked((s) => { const n = new Set(s); if (on) n.delete(u.id); else n.add(u.id); return n; })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-start enabled:hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Box state={on ? "on" : "off"} disabled={disabled} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800 truncate">{u.nameEn || "Unnamed"}</span>
                    <span className="block text-xs text-slate-500 truncate" dir="ltr">{u.email || u.phone}</span>
                  </span>
                  {disabled ? <span className="text-[11px] text-slate-400">{u.isSelf ? "You" : "Locked"}</span> : <RolePill role={u.appRole} />}
                </button>
              </li>
            );
          })}
          {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nobody found.</li>}
        </ul>
      </div>
    </AdminModal>
  );
}

// ───────── delete ─────────

export function DeleteRoleModal({ role, roles, onClose, onDone }: { role: RoleDTO; roles: RoleDTO[]; onClose: () => void; onDone: () => void }) {
  const targets = roles.filter((r) => r.id !== role.id && r.assignable);
  const [to, setTo] = useState((targets.find((r) => r.key === "customer") ?? targets[0])?.id ?? "");
  const [busy, setBusy] = useState(false);
  const needsMove = role.userCount > 0;

  const submit = async () => {
    setBusy(true);
    const d = await api<{ moved: number; movedTo: { nameEn: string } | null }>(`/api/admin/roles/${role.id}`, { method: "DELETE", body: needsMove ? { reassignToRoleId: to } : {} });
    setBusy(false);
    if (!d.success) return toast.error(d.error || "Could not delete the role");
    toast.success(d.data?.movedTo ? `Deleted. ${d.data.moved} moved to ${d.data.movedTo.nameEn}.` : "Role deleted");
    onDone();
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      className="!max-w-md"
      title={`Delete ${role.nameEn}?`}
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={busy || (needsMove && !to)} className="admin-btn admin-btn-danger disabled:opacity-50">
            <LuTrash2 size={15} /> {busy ? "Deleting..." : "Delete role"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-600">
        {needsMove ? (
          <>
            <p>
              <strong className="text-slate-800">{role.userCount} {role.userCount === 1 ? "person has" : "people have"}</strong> this role. Choose the role they should have instead. They&apos;ll be signed out so the change applies right away.
            </p>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Move them to</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="admin-input admin-select">
                {targets.length === 0 && <option value="">No role you can give</option>}
                {targets.map((r) => <option key={r.id} value={r.id}>{r.nameEn} ({r.permissionCount} permissions)</option>)}
              </select>
            </label>
          </>
        ) : (
          <p>Nobody has this role. It will be removed permanently.</p>
        )}
      </div>
    </AdminModal>
  );
}
