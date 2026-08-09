"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LuBadgeCheck,
  LuFilter,
  LuKeyRound,
  LuLayoutGrid,
  LuLock,
  LuSave,
  LuSearch,
  LuShield,
  LuUsers,
} from "react-icons/lu";

type RoleInfo = {
  key: string;
  labelEn: string;
  labelAr: string;
  editable: boolean;
};

type PermissionInfo = {
  key: string;
  label: string;
  description: string;
  area: "admin" | "seller" | "system";
  group: string;
};

type Payload = {
  roles: RoleInfo[];
  permissions: PermissionInfo[];
  matrix: Record<string, string[]>;
};

export default function RolesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<"all" | PermissionInfo["area"]>("all");

  useEffect(() => {
    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Failed to load roles");
        setData(json.data);
        setMatrix(json.data.matrix);
      })
      .catch((e: Error) => setMessage({ type: "error", text: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const groupedPermissions = useMemo(() => {
    if (!data) return [] as Array<{ group: string; items: PermissionInfo[] }>;
    const map = new Map<string, PermissionInfo[]>();
    const normalizedQuery = query.trim().toLowerCase();
    for (const permission of data.permissions) {
      if (area !== "all" && permission.area !== area) continue;

      if (normalizedQuery) {
        const haystack = [permission.label, permission.description, permission.group, permission.key, permission.area]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) continue;
      }

      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [area, data, query]);

  const totalAssignments = useMemo(
    () => Object.values(matrix).reduce((sum, permissions) => sum + permissions.length, 0),
    [matrix],
  );

  const visiblePermissionCount = useMemo(
    () => groupedPermissions.reduce((sum, group) => sum + group.items.length, 0),
    [groupedPermissions],
  );

  const dirty = useMemo(() => {
    if (!data) return false;

    const roleKeys = new Set([...Object.keys(data.matrix), ...Object.keys(matrix)]);
    for (const roleKey of roleKeys) {
      const before = [...(data.matrix[roleKey] ?? [])].sort();
      const after = [...(matrix[roleKey] ?? [])].sort();
      if (before.length !== after.length) return true;
      for (let index = 0; index < before.length; index += 1) {
        if (before[index] !== after[index]) return true;
      }
    }

    return false;
  }, [data, matrix]);

  const togglePermission = (role: string, permission: string) => {
    setMatrix((current) => {
      const next = new Set(current[role] ?? []);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return { ...current, [role]: Array.from(next).sort() };
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save roles");
      setData(json.data);
      setMatrix(json.data.matrix);
      setMessage({ type: "success", text: "Role permissions updated." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save roles" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return <div className="admin-card p-6 text-sm text-red-600">Failed to load roles configuration.</div>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium shadow-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <section className="admin-card border border-slate-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <LuShield size={14} /> Roles & Permissions
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Define exactly what every team role can access across the admin platform</h1>
            <p className="text-sm leading-6 text-slate-500">
              Control menu visibility, page entry, and operational capabilities from one central matrix.
              Super Admin always keeps full access so the control surface cannot be locked accidentally.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-slate-500">Editable Roles</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{data.roles.filter((role) => role.editable).length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-slate-500">Live Assignments</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{totalAssignments}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <LuUsers size={14} /> Roles
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{data.roles.length}</div>
            <div className="mt-1 text-sm text-slate-500">Built-in role profiles</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <LuKeyRound size={14} /> Permissions
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{data.permissions.length}</div>
            <div className="mt-1 text-sm text-slate-500">Available permission keys</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <LuLayoutGrid size={14} /> Groups
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{groupedPermissions.length}</div>
            <div className="mt-1 text-sm text-slate-500">Permission clusters in view</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <LuBadgeCheck size={14} /> Visible Rows
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{visiblePermissionCount}</div>
            <div className="mt-1 text-sm text-slate-500">Filtered permission rows</div>
          </div>
        </div>
      </section>

      <section className="admin-card p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <label className="group relative block">
            <LuSearch size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-slate-700" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="admin-input rounded-[20px] border-slate-200 bg-white pl-11 transition-colors duration-200 focus:border-slate-300"
              placeholder="Search by permission, key, group, or workflow"
            />
          </label>

          <div className="relative">
            <LuFilter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={area}
              onChange={(event) => setArea(event.target.value as "all" | PermissionInfo["area"])}
              className="admin-input admin-select rounded-[20px] border-slate-200 bg-white pl-11 transition-colors duration-200 focus:border-slate-300"
            >
              <option value="all">All Areas</option>
              <option value="admin">Admin</option>
              <option value="seller">Seller</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{visiblePermissionCount}</span> of <span className="font-semibold text-slate-700">{data.permissions.length}</span> permissions.
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`} /> Changes {dirty ? "pending" : "synced"}
          </div>
        </div>
      </section>

      {groupedPermissions.length === 0 ? (
        <section className="admin-card p-10 text-center">
          <div className="text-lg font-semibold text-slate-800">No matching permissions</div>
          <div className="mt-2 text-sm text-slate-500">Try a broader search term or switch the area filter back to all.</div>
        </section>
      ) : (
        groupedPermissions.map((group) => (
          <section key={group.group} className="admin-card border border-slate-200 p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  Permission Group
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{group.group}</h3>
                <p className="mt-1 text-sm text-slate-500">Set access for each role in this section.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                {group.items.length} permissions
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="admin-table min-w-[1040px]">
                <thead>
                  <tr>
                    <th>Permission</th>
                    {data.roles.map((role) => (
                      <th key={role.key}>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <span>{role.labelEn}</span>
                          <span className="text-[11px] font-medium normal-case tracking-normal text-slate-400">{role.editable ? "Editable" : "Locked"}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((permission) => (
                    <tr key={permission.key} className="transition-colors duration-200 hover:bg-slate-50/70">
                      <td>
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 inline-flex h-9 w-9 items-center justify-center rounded-2xl ${permission.area === "admin" ? "bg-sky-50 text-sky-600" : permission.area === "seller" ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"}`}>
                            {permission.area === "admin" ? <LuShield size={16} /> : permission.area === "seller" ? <LuUsers size={16} /> : <LuLock size={16} />}
                          </span>
                          <div>
                            <div className="font-medium text-slate-800">{permission.label}</div>
                            <div className="mt-1 text-xs text-slate-500">{permission.description}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{permission.area}</span>
                              <span className="text-[11px] text-slate-400">{permission.key}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {data.roles.map((role) => {
                        const checked = (matrix[role.key] ?? []).includes(permission.key);
                        return (
                          <td key={`${permission.key}-${role.key}`}>
                            <label className="inline-flex w-full items-center justify-center">
                              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors duration-200 ${!role.editable ? "border-slate-200 bg-slate-100 text-slate-300" : checked ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!role.editable || saving}
                                  onChange={() => togglePermission(role.key, permission.key)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                              </span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <section className="admin-card border border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Permission changes are applied across menus, routes, and protected APIs.</div>
            <div className="mt-1 text-sm text-slate-500">Review the filtered matrix carefully before saving live access changes.</div>
          </div>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex min-w-48 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <LuSave size={16} /> {saving ? "Saving..." : dirty ? "Save Permissions" : "No Changes to Save"}
          </button>
        </div>
      </section>
    </div>
  );
}