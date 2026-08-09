"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LuCheck,
  LuChevronDown,
  LuLock,
  LuSave,
  LuSearch,
  LuShield,
  LuUsers,
  LuX,
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

const AREA_META: Record<PermissionInfo["area"], { badge: string; icon: typeof LuShield }> = {
  admin: { badge: "bg-sky-50 text-sky-600", icon: LuShield },
  seller: { badge: "bg-emerald-50 text-emerald-600", icon: LuUsers },
  system: { badge: "bg-violet-50 text-violet-600", icon: LuLock },
};

export default function RolesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<"all" | PermissionInfo["area"]>("all");
  const [activeRole, setActiveRole] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || "Failed to load roles");
        setData(json.data);
        setMatrix(json.data.matrix);
        const roles: RoleInfo[] = json.data.roles ?? [];
        const firstEditable = roles.find((role) => role.editable) ?? roles[0];
        if (firstEditable) setActiveRole(firstEditable.key);
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

  const activeRoleInfo = useMemo(
    () => data?.roles.find((role) => role.key === activeRole) ?? null,
    [activeRole, data],
  );

  const activeRoleCount = (matrix[activeRole] ?? []).length;

  const togglePermission = (role: string, permission: string) => {
    setMatrix((current) => {
      const next = new Set(current[role] ?? []);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return { ...current, [role]: Array.from(next).sort() };
    });
  };

  const setGroupForRole = (role: string, permissionKeys: string[], value: boolean) => {
    setMatrix((current) => {
      const next = new Set(current[role] ?? []);
      permissionKeys.forEach((key) => {
        if (value) next.add(key);
        else next.delete(key);
      });
      return { ...current, [role]: Array.from(next).sort() };
    });
  };

  const resetFilters = () => {
    setQuery("");
    setArea("all");
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

  const hasFilters = query.trim() !== "" || area !== "all";

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {message && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-black/5">
            <LuX size={14} />
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="admin-card border border-slate-200 p-5 sm:p-6">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
            <LuShield size={14} /> Roles &amp; Permissions
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Define exactly what every team role can access
          </h1>
          <p className="text-sm leading-6 text-slate-500">
            Control menu visibility, page entry, and operational capabilities from one central matrix. Super Admin always keeps full
            access so the control surface cannot be locked accidentally.
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="admin-card p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="group relative min-w-0 flex-1">
            <LuSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-slate-700" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ paddingLeft: "2.5rem", paddingRight: query ? "2.25rem" : "0.875rem" }}
              className="admin-input !rounded-full border-slate-200 bg-white transition-colors duration-200 focus:border-slate-300"
              placeholder="Search permissions"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear search"
              >
                <LuX size={14} />
              </button>
            ) : null}
          </div>

          {/* Area filter */}
          <div className="w-28 shrink-0 sm:w-44">
            <select
              value={area}
              onChange={(event) => setArea(event.target.value as "all" | PermissionInfo["area"])}
              className="admin-input admin-select w-full !rounded-full border-slate-200 bg-white transition-colors duration-200 focus:border-slate-300"
            >
              <option value="all">All areas</option>
              <option value="admin">Admin</option>
              <option value="seller">Seller</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* Reset */}
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              aria-label="Reset filters"
              title="Reset filters"
            >
              <LuX size={16} />
            </button>
          ) : null}
        </div>
      </section>

      {groupedPermissions.length === 0 ? (
        <section className="admin-card p-10 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <LuSearch size={22} />
          </div>
          <div className="text-lg font-semibold text-slate-800">No matching permissions</div>
          <div className="mt-2 text-sm text-slate-500">Try a broader search term or switch the area filter back to all.</div>
        </section>
      ) : (
        <>
          {/* Mobile / tablet: role-focused view */}
          <div className="space-y-4 lg:hidden">
            <section className="admin-card border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Select a role to edit</div>
                {activeRoleInfo ? (
                  <span className="text-xs font-semibold text-slate-500">
                    {activeRoleCount} granted
                  </span>
                ) : null}
              </div>
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {data.roles.map((role) => {
                  const isActive = role.key === activeRole;
                  return (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => setActiveRole(role.key)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span>{role.labelEn}</span>
                      {!role.editable ? <LuLock size={12} className={isActive ? "text-white/70" : "text-slate-400"} /> : null}
                    </button>
                  );
                })}
              </div>
              {activeRoleInfo && !activeRoleInfo.editable ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <LuLock size={14} className="mt-0.5 shrink-0" />
                  <span>{activeRoleInfo.labelEn} is locked and always keeps its permissions. Choose an editable role to make changes.</span>
                </div>
              ) : null}
            </section>

            {activeRoleInfo
              ? groupedPermissions.map((group) => {
                  const groupKeys = group.items.map((item) => item.key);
                  const grantedInGroup = groupKeys.filter((key) => (matrix[activeRole] ?? []).includes(key)).length;
                  const allGranted = grantedInGroup === groupKeys.length;
                  const editable = activeRoleInfo.editable;

                  return (
                    <section key={group.group} className="admin-card border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{group.group}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {grantedInGroup} of {groupKeys.length} granted
                          </p>
                        </div>
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => setGroupForRole(activeRole, groupKeys, !allGranted)}
                            disabled={saving}
                            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {allGranted ? "Clear all" : "Grant all"}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 divide-y divide-slate-100">
                        {group.items.map((permission) => {
                          const checked = (matrix[activeRole] ?? []).includes(permission.key);
                          const areaMeta = AREA_META[permission.area];
                          const AreaIcon = areaMeta.icon;
                          return (
                            <div key={permission.key} className="flex items-start justify-between gap-3 py-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${areaMeta.badge}`}>
                                  <AreaIcon size={15} />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-800">{permission.label}</div>
                                  <div className="mt-0.5 text-xs leading-5 text-slate-500">{permission.description}</div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                      {permission.area}
                                    </span>
                                    <span className="truncate text-[10px] text-slate-400">{permission.key}</span>
                                  </div>
                                </div>
                              </div>
                              <ToggleSwitch
                                checked={checked}
                                disabled={!editable || saving}
                                onChange={() => togglePermission(activeRole, permission.key)}
                                label={`${permission.label} for ${activeRoleInfo.labelEn}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              : null}
          </div>

          {/* Desktop: full matrix */}
          <div className="hidden space-y-6 lg:block">
            {groupedPermissions.map((group) => (
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
                  <table className="admin-table min-w-[900px]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-slate-50">Permission</th>
                        {data.roles.map((role) => (
                          <th key={role.key}>
                            <div className="flex flex-col items-center gap-1 text-center">
                              <span>{role.labelEn}</span>
                              <span className="text-[11px] font-medium normal-case tracking-normal text-slate-400">
                                {role.editable ? "Editable" : "Locked"}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((permission) => {
                        const areaMeta = AREA_META[permission.area];
                        const AreaIcon = areaMeta.icon;
                        return (
                          <tr key={permission.key} className="transition-colors duration-200 hover:bg-slate-50/70">
                            <td className="sticky left-0 z-10 bg-white">
                              <div className="flex items-start gap-3">
                                <span className={`mt-1 inline-flex h-9 w-9 items-center justify-center rounded-2xl ${areaMeta.badge}`}>
                                  <AreaIcon size={16} />
                                </span>
                                <div>
                                  <div className="font-medium text-slate-800">{permission.label}</div>
                                  <div className="mt-1 text-xs text-slate-500">{permission.description}</div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                      {permission.area}
                                    </span>
                                    <span className="text-[11px] text-slate-400">{permission.key}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            {data.roles.map((role) => {
                              const checked = (matrix[role.key] ?? []).includes(permission.key);
                              return (
                                <td key={`${permission.key}-${role.key}`}>
                                  <div className="flex items-center justify-center">
                                    <CheckToggle
                                      checked={checked}
                                      disabled={!role.editable || saving}
                                      onChange={() => togglePermission(role.key, permission.key)}
                                      label={`${permission.label} for ${role.labelEn}`}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-30">
        <div className="admin-card flex flex-col gap-3 border border-slate-200 p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dirty ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
              {dirty ? <LuChevronDown size={18} className="rotate-0" /> : <LuCheck size={18} />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                {dirty ? "You have unsaved permission changes" : "All permission changes are saved"}
              </div>
              <div className="hidden text-xs text-slate-500 sm:block">
                Changes apply across menus, routes, and protected APIs. Review carefully before saving.
              </div>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto sm:min-w-48"
          >
            <LuSave size={16} /> {saving ? "Saving..." : dirty ? "Save permissions" : "No changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        disabled ? "cursor-not-allowed bg-slate-200" : checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function CheckToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors duration-200 ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
          : checked
            ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
            : "border-slate-200 bg-white text-transparent hover:bg-slate-50"
      }`}
    >
      <LuCheck size={18} className={checked ? "opacity-100" : "opacity-0"} />
    </button>
  );
}
