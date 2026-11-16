"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LuCopy, LuLock, LuPencil, LuPlus, LuSearch, LuShieldCheck, LuTrash2, LuUsers } from "react-icons/lu";
import { DeleteRoleModal } from "@/components/admin/access/RoleEditor";
import { ColorDot, TypeBadge, api, type RoleDTO, type RolesPayload } from "@/components/admin/access/shared";

export default function RolesPage() {
  const router = useRouter();
  const [data, setData] = useState<RolesPayload | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<RoleDTO | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [roles, perms] = await Promise.all([api<RolesPayload>("/api/admin/roles"), api<{ total: number }>("/api/admin/permissions")]);
    if (!roles.success || !roles.data) return toast.error(roles.error || "Could not load roles");
    setData(roles.data);
    setTotal(perms.data?.total ?? 0);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!data) return [];
    return term ? data.roles.filter((r) => `${r.nameEn} ${r.nameAr ?? ""} ${r.description ?? ""} ${r.type}`.toLowerCase().includes(term)) : data.roles;
  }, [data, q]);

  const duplicate = async (r: RoleDTO) => {
    setBusy(r.id);
    const d = await api<RoleDTO>(`/api/admin/roles/${r.id}/duplicate`, { method: "POST", body: {} });
    setBusy(null);
    if (!d.success || !d.data) return toast.error(d.error || "Could not copy the role");
    toast.success(`Created ${d.data.nameEn}`);
    router.push(`/admin/roles/${d.data.id}`);
  };

  if (!data) return <div className="flex justify-center py-16"><span className="spinner" /></div>;

  const { viewer } = data;
  const canCreate = viewer.canManageRoles && viewer.maxRank >= 0;
  const people = data.roles.reduce((n, r) => n + r.userCount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Roles & permissions</h1>
          <p className="text-sm text-slate-500">
            {data.roles.length} roles, {people} {people === 1 ? "person" : "people"}. A role is a set of permissions; give it to people on the{" "}
            <Link href="/admin/users" className="text-indigo-600 hover:underline">People</Link> page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <LuSearch size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles" className="admin-input !ps-9 sm:!w-56" />
          </div>
          {canCreate && (
            <Link href="/admin/roles/new" className="admin-btn admin-btn-primary"><LuPlus size={16} /> New role</Link>
          )}
        </div>
      </div>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table min-w-[760px]">
          <thead>
            <tr>
              <th>Role</th>
              <th>Account type</th>
              <th className="text-right">Level</th>
              <th className="text-right">People</th>
              <th className="text-right">Permissions</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/roles/${r.id}`} className="flex items-start gap-2.5 group">
                    <span className="mt-1.5"><ColorDot color={r.color} /></span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-800 group-hover:text-indigo-600">{r.nameEn}</span>
                        {r.nameAr && <span className="text-xs text-slate-400" dir="rtl">{r.nameAr}</span>}
                        {r.isSystem && <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">Built-in</span>}
                        {viewer.roleId === r.id && <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-indigo-50 text-indigo-600">Your role</span>}
                      </span>
                      {r.description && <span className="block text-xs text-slate-500 mt-0.5 max-w-md">{r.description}</span>}
                    </span>
                  </Link>
                </td>
                <td><TypeBadge type={r.type} /></td>
                <td className="text-right tabular-nums text-slate-600">{r.rank}</td>
                <td className="text-right tabular-nums">
                  <Link href={`/admin/users?roleId=${r.id}`} className="inline-flex items-center gap-1 text-slate-700 hover:text-indigo-600" title="See these people">
                    <LuUsers size={13} className="text-slate-400" /> {r.userCount}
                  </Link>
                  {r.userCount !== r.activeUserCount && <span className="block text-[11px] text-slate-400">{r.activeUserCount} active</span>}
                </td>
                <td className="text-right tabular-nums text-slate-700">
                  {r.key === "super_admin" ? "All" : `${r.permissionCount} / ${total}`}
                </td>
                <td className="text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <Link href={`/admin/roles/${r.id}`} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" title={r.editable ? "Edit" : "View"}>
                      {r.editable || r.labelsEditable ? <LuPencil size={15} /> : <LuShieldCheck size={15} />}
                    </Link>
                    {canCreate && (
                      <button onClick={() => duplicate(r)} disabled={busy === r.id} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40" title="Duplicate">
                        <LuCopy size={15} />
                      </button>
                    )}
                    {viewer.canManageRoles && !r.isSystem && (
                      <button
                        onClick={() => (r.deletable ? setDeleting(r) : toast.error(r.lockedReason || "You can't delete this role"))}
                        className={`w-8 h-8 inline-flex items-center justify-center rounded-lg ${r.deletable ? "text-rose-500 hover:bg-rose-50" : "text-slate-300 cursor-not-allowed"}`}
                        title={r.deletable ? "Delete" : r.lockedReason ?? ""}
                      >
                        <LuTrash2 size={15} />
                      </button>
                    )}
                    {!r.editable && !r.labelsEditable && r.lockedReason && <span title={r.lockedReason} className="w-8 h-8 inline-flex items-center justify-center text-slate-300"><LuLock size={14} /></span>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-sm text-slate-400 py-10">No role matches &quot;{q}&quot;.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 flex items-start gap-1.5">
        <LuLock size={12} className="mt-0.5 shrink-0" />
        Level decides who can manage whom: people can only edit, give or delete roles below their own level ({viewer.isSuper ? "you're a super admin, so no limit" : `yours is ${viewer.rank}`}), and only with permissions they have themselves.
      </p>

      {deleting && (
        <DeleteRoleModal
          role={deleting}
          roles={data.roles}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}
