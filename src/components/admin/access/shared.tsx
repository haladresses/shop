"use client";
import { useEffect, useState } from "react";

// ───────── types (mirror the API responses) ─────────

export type AccountType = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "SELLER" | "CUSTOMER";
export type PermissionKind = "access" | "view" | "manage";

export type PermissionItem = {
  key: string;
  label: string;
  description: string;
  area: "admin" | "seller" | "system";
  group: string;
  kind: PermissionKind;
  requires: string[];
};
export type PermissionGroup = { group: string; area: string; permissions: PermissionItem[] };

export type RoleDTO = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  description: string | null;
  color: string;
  type: AccountType;
  permissions: string[];
  permissionCount: number;
  isSystem: boolean;
  rank: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; nameEn: string | null } | null;
  userCount: number;
  activeUserCount: number;
  editable: boolean;
  labelsEditable: boolean;
  deletable: boolean;
  lockedReason: string | null;
  assignable: boolean;
  assignReason: string | null;
};

export type RolesViewer = {
  isSuper: boolean;
  rank: number;
  roleId: string | null;
  canManageRoles: boolean;
  maxRank: number;
  permissions: string[];
};
export type RolesPayload = { roles: RoleDTO[]; viewer: RolesViewer; colors: string[] };

export type RoleRef = { id: string; key: string; nameEn: string; nameAr: string | null; color: string; rank?: number; type?: AccountType };

// ───────── fetch helper ─────────

export type ApiResult<T> = { success: boolean; data?: T; error?: string };

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

/** The signed-in user's effective permissions (null while loading). */
export function useMyPermissions(): { id: string | null; permissions: string[] | null } {
  const [me, setMe] = useState<{ id: string | null; permissions: string[] | null }>({ id: null, permissions: null });
  useEffect(() => {
    api<{ id: string; permissions: string[] }>("/api/auth/me").then((d) =>
      setMe({ id: d.data?.id ?? null, permissions: d.success && d.data ? d.data.permissions : [] }),
    );
  }, []);
  return me;
}

// ───────── labels ─────────

export const TYPE_META: Record<AccountType, { label: string; hint: string; cls: string }> = {
  SUPER_ADMIN: { label: "Super admin", hint: "Owner level, everything", cls: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" },
  ADMIN: { label: "Admin", hint: "Runs the store, shows in staff lists", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  STAFF: { label: "Staff", hint: "Team member, shows in staff lists", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  SELLER: { label: "Seller", hint: "Marketplace seller", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  CUSTOMER: { label: "Customer", hint: "Shopper account", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};
export const CUSTOM_TYPES: AccountType[] = ["ADMIN", "STAFF", "SELLER", "CUSTOMER"];

export const KIND_META: Record<PermissionKind, { label: string; cls: string }> = {
  access: { label: "Access", cls: "bg-indigo-50 text-indigo-700" },
  view: { label: "View", cls: "bg-slate-100 text-slate-600" },
  manage: { label: "Manage", cls: "bg-amber-50 text-amber-700" },
};

export const AREA_LABEL: Record<string, string> = { system: "Sign-in", admin: "Admin panel", seller: "Seller portal" };

export function TypeBadge({ type }: { type: AccountType }) {
  return <span className={`inline-flex text-[11px] font-semibold rounded-full px-2 py-0.5 ring-1 whitespace-nowrap ${TYPE_META[type].cls}`}>{TYPE_META[type].label}</span>;
}

export function RolePill({ role, size = "sm" }: { role: Pick<RoleRef, "nameEn" | "color"> | null | undefined; size?: "sm" | "md" }) {
  if (!role) return <span className="text-slate-400">-</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${size === "md" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5"}`}
      style={{ color: role.color, backgroundColor: `${role.color}14`, boxShadow: `inset 0 0 0 1px ${role.color}33` }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
      {role.nameEn}
    </span>
  );
}

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, backgroundColor: color }} />;
}

export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

export function Avatar({ name, color, muted, size = "md" }: { name: string; color?: string; muted?: boolean; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";
  const c = muted ? "#cbd5e1" : color ?? "#64748b";
  return (
    <span className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${dim}`} style={{ color: c, backgroundColor: `${c}1f` }}>
      {initials(name)}
    </span>
  );
}

/** Shorter, friendlier wording for a permission row. */
export function friendlyLabel(p: Pick<PermissionItem, "label">): string {
  const l = p.label
    .replace(/^Admin Panel Access$/, "Open the admin panel")
    .replace(/^Seller Portal Access$/, "Open the seller portal")
    .replace(/^Use POS$/, "Sell at the till (POS)");
  return l.charAt(0).toUpperCase() + l.slice(1);
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-");
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
export function ago(iso: string | null | undefined) {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtDate(iso);
}

/** Adding a permission also adds what it needs; removing one removes what depends on it. */
export function togglePermission(current: Set<string>, key: string, on: boolean, catalog: Map<string, PermissionItem>, allowed?: (k: string) => boolean): Set<string> {
  const next = new Set(current);
  if (on) {
    const stack = [key];
    while (stack.length) {
      const k = stack.pop()!;
      if (next.has(k) || (allowed && !allowed(k))) continue;
      next.add(k);
      stack.push(...(catalog.get(k)?.requires ?? []));
    }
  } else {
    const stack = [key];
    while (stack.length) {
      const k = stack.pop()!;
      if (!next.has(k)) continue;
      next.delete(k);
      for (const p of catalog.values()) if (p.requires.includes(k) && next.has(p.key)) stack.push(p.key);
    }
  }
  return next;
}

/** Plain-language warnings about a permission set that can't work as intended. */
export function permissionWarnings(perms: Set<string>): { text: string; fix: string }[] {
  const out: { text: string; fix: string }[] = [];
  const hasAdmin = Array.from(perms).some((p) => p.startsWith("admin."));
  const hasSeller = Array.from(perms).some((p) => p.startsWith("seller."));
  if (hasAdmin && !perms.has("panel.admin.access")) out.push({ text: "Admin permissions are ticked, but not \"Open the admin panel\", so they can't be used.", fix: "panel.admin.access" });
  if (hasSeller && !perms.has("panel.seller.access")) out.push({ text: "Seller permissions are ticked, but not \"Open the seller portal\", so they can't be used.", fix: "panel.seller.access" });
  return out;
}
