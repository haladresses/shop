"use client";

import { useEffect, useMemo, useState } from "react";

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
    for (const permission of data.permissions) {
      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [data]);

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
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="admin-card p-6 space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Roles & Permissions</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Control exactly which menus, pages, and operational sections each built-in role can access.
          Super Admin always keeps full access so the panel cannot be locked accidentally.
        </p>
      </div>

      {groupedPermissions.map((group) => (
        <div key={group.group} className="admin-card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">{group.group}</h3>
            <p className="text-sm text-slate-500">Set access for each role in this section.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Permission</th>
                  {data.roles.map((role) => (
                    <th key={role.key}>{role.labelEn}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.map((permission) => (
                  <tr key={permission.key}>
                    <td>
                      <div className="font-medium text-slate-800">{permission.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{permission.description}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{permission.key}</div>
                    </td>
                    {data.roles.map((role) => {
                      const checked = (matrix[role.key] ?? []).includes(permission.key);
                      return (
                        <td key={`${permission.key}-${role.key}`}>
                          <label className="inline-flex items-center justify-center w-full">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!role.editable || saving}
                              onChange={() => togglePermission(role.key, permission.key)}
                              className="w-4 h-4 rounded border-slate-300"
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary min-w-40 justify-center">
          {saving ? "Saving..." : "Save Permissions"}
        </button>
      </div>
    </div>
  );
}