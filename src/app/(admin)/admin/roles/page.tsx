"use client";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LuCheck, LuLock, LuMinus, LuSearch } from "react-icons/lu";

type RoleKey = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "SELLER" | "CUSTOMER";
type RoleInfo = { key: RoleKey; labelEn: string; labelAr: string; editable: boolean; users?: number };
type Perm = { key: string; label: string; description: string; area: "admin" | "seller" | "system"; group: string };
type Payload = { roles: RoleInfo[]; permissions: Perm[]; matrix: Record<string, string[]> };

// Plain-language sections instead of the internal permission groups.
const SECTIONS: { title: string; hint: string; groups: string[] }[] = [
  { title: "Sign-in", hint: "Which panels this role can open", groups: ["Admin Panel", "Seller Portal"] },
  { title: "Sales", hint: "Orders, till, payments and delivery", groups: ["Dashboard", "Orders", "Point of Sale", "Payments", "Shipping", "Marketing"] },
  { title: "Money", hint: "Profit & loss and expenses", groups: ["Finance"] },
  { title: "Products & stock", hint: "Catalog and warehouse", groups: ["Products", "Catalog", "Inventory"] },
  { title: "Website", hint: "Homepage, pages and messages", groups: ["Content", "Contact"] },
  { title: "People & security", hint: "Accounts and permissions", groups: ["Users", "Roles & Permissions"] },
  { title: "System", hint: "Settings, backups and help", groups: ["Settings", "Backups", "Help & Onboarding"] },
  { title: "Seller portal", hint: "For marketplace sellers", groups: ["Seller Dashboard", "Seller Products", "Seller Orders", "Seller Inventory", "Seller Analytics", "Seller Operations"] },
];

// Shorter, friendlier wording for the row labels.
function friendly(p: Perm): string {
  const l = p.label
    .replace(/^Admin Panel Access$/, "Open the admin panel")
    .replace(/^Seller Portal Access$/, "Open the seller portal")
    .replace(/^Use POS$/, "Sell at the till (POS)")
    .replace(/^View /, "See ")
    .replace(/^Manage /, "Edit ")
    .replace(/^Seller /, "");
  return l.charAt(0).toUpperCase() + l.slice(1);
}

const COLUMN_TONE: Record<RoleKey, string> = {
  SUPER_ADMIN: "text-fuchsia-700",
  ADMIN: "text-violet-700",
  STAFF: "text-emerald-700",
  SELLER: "text-sky-700",
  CUSTOMER: "text-slate-600",
};

export default function RolesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/roles", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!d?.success) return setToast({ ok: false, text: d?.error || "Could not load roles" });
    setData(d.data);
    setMatrix(d.data.matrix);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const has = (role: RoleKey, key: string) => role === "SUPER_ADMIN" || (matrix[role] ?? []).includes(key);
  const set = (role: RoleKey, keys: string[], on: boolean) =>
    setMatrix((prev) => {
      const s = new Set(prev[role] ?? []);
      keys.forEach((k) => (on ? s.add(k) : s.delete(k)));
      return { ...prev, [role]: Array.from(s).sort() };
    });

  const sections = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    const used = new Set<string>();
    const out = SECTIONS.map((sec) => {
      const perms = data.permissions.filter((p) => sec.groups.includes(p.group));
      perms.forEach((p) => used.add(p.key));
      return { ...sec, perms };
    });
    // Anything not mapped above still shows up, never silently hidden.
    const rest = data.permissions.filter((p) => !used.has(p.key));
    if (rest.length) out.push({ title: "Other", hint: "", groups: [], perms: rest });
    return out
      .map((s) => ({ ...s, perms: term ? s.perms.filter((p) => `${friendly(p)} ${p.description}`.toLowerCase().includes(term)) : s.perms }))
      .filter((s) => s.perms.length);
  }, [data, q]);

  const dirty = useMemo(
    () => (data ? data.roles.filter((r) => (matrix[r.key] ?? []).slice().sort().join() !== (data.matrix[r.key] ?? []).slice().sort().join()) : []),
    [data, matrix],
  );

  const save = async () => {
    setSaving(true);
    const d = await fetch("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matrix }) }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (!d?.success) return setToast({ ok: false, text: d?.error || "Could not save" });
    setData(d.data);
    setMatrix(d.data.matrix);
    setToast({ ok: true, text: "Saved" });
  };

  if (!data) return <div className="h-[60vh] rounded-2xl bg-white ring-1 ring-slate-200 animate-pulse" />;

  const roles = data.roles;
  const cols = `minmax(220px,1.6fr) repeat(${roles.length}, minmax(84px,1fr))`;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Roles & permissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tick what each role may do. For one person only, use{" "}
            <Link href="/admin/users" className="text-slate-900 underline underline-offset-2">People</Link>.
          </p>
        </div>
        <div className="relative sm:w-72">
          <LuSearch size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full h-10 rounded-xl bg-white ring-1 ring-slate-200 ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/15" />
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-auto max-h-[calc(100vh-210px)]">
        <div role="table" className="min-w-[640px]">
          {/* Column headers */}
          <div role="row" className="grid sticky top-0 z-20 bg-white border-b border-slate-200" style={{ gridTemplateColumns: cols }}>
            <div className="sticky start-0 bg-white px-5 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Permission</div>
            {roles.map((r) => (
              <div key={r.key} className="px-2 py-3 text-center">
                <p className={`text-sm font-semibold inline-flex items-center gap-1 ${COLUMN_TONE[r.key]}`}>
                  {r.labelEn}
                  {!r.editable && <LuLock size={11} className="text-slate-400" />}
                  {dirty.some((d) => d.key === r.key) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </p>
                <p className="text-[11px] text-slate-400">{r.users ?? 0} {r.users === 1 ? "person" : "people"}</p>
              </div>
            ))}
          </div>

          {sections.map((sec) => (
            <Fragment key={sec.title}>
              {/* Section row — click a cell to switch the whole section for that role */}
              <div role="row" className="grid bg-slate-50 border-y border-slate-100" style={{ gridTemplateColumns: cols }}>
                <div className="sticky start-0 bg-slate-50 px-5 py-2.5">
                  <p className="text-sm font-semibold text-slate-800">{sec.title}</p>
                  {sec.hint && <p className="text-[11px] text-slate-400">{sec.hint}</p>}
                </div>
                {roles.map((r) => {
                  const keys = sec.perms.map((p) => p.key);
                  const n = keys.filter((k) => has(r.key, k)).length;
                  const state = n === 0 ? "none" : n === keys.length ? "all" : "some";
                  return (
                    <div key={r.key} className="flex items-center justify-center">
                      <button
                        disabled={!r.editable}
                        onClick={() => set(r.key, keys, state !== "all")}
                        title={r.editable ? (state === "all" ? "Turn the whole section off" : "Turn the whole section on") : undefined}
                        className="text-[11px] tabular-nums font-medium text-slate-400 rounded-md px-2 py-1 enabled:hover:bg-white enabled:hover:text-slate-800 disabled:cursor-default"
                      >
                        {n}/{keys.length}
                      </button>
                    </div>
                  );
                })}
              </div>

              {sec.perms.map((p) => (
                <div key={p.key} role="row" className="grid border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 group" style={{ gridTemplateColumns: cols }}>
                  <div className="sticky start-0 bg-white group-hover:bg-slate-50/70 px-5 py-3 text-sm text-slate-700" title={p.description}>
                    {friendly(p)}
                  </div>
                  {roles.map((r) => {
                    const on = has(r.key, p.key);
                    return (
                      <div key={r.key} className="flex items-center justify-center">
                        <button
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${friendly(p)} — ${r.labelEn}`}
                          disabled={!r.editable}
                          onClick={() => set(r.key, [p.key], !on)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                            on ? "bg-slate-900 text-white" : "ring-1 ring-inset ring-slate-200 text-transparent enabled:hover:ring-slate-400"
                          } disabled:cursor-not-allowed ${!r.editable && on ? "bg-slate-300" : ""}`}
                        >
                          {on ? <LuCheck size={15} /> : <LuMinus size={12} className="text-slate-200" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </Fragment>
          ))}

          {sections.length === 0 && <p className="text-sm text-slate-400 text-center py-12">Nothing matches “{q}”.</p>}
        </div>
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <LuLock size={12} /> Locked columns: Super Admin always has everything; roles at or above your own level can only be changed by someone more senior.
      </p>

      {dirty.length > 0 && (
        <div className="fixed bottom-5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl bg-slate-900 text-white ps-5 pe-2 py-2 shadow-2xl">
          <span className="text-sm">Changes to <strong>{dirty.map((r) => r.labelEn).join(", ")}</strong></span>
          <button onClick={() => setMatrix(data.matrix)} className="rounded-xl px-3 py-1.5 text-sm text-white/70 hover:text-white">Discard</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-white text-slate-900 px-4 py-1.5 text-sm font-semibold disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {toast && (
        <div className={`fixed top-20 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
