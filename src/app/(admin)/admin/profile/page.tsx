"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LuKeyRound, LuLogOut, LuSave, LuUserRound } from "react-icons/lu";
import { humanize } from "@/components/admin/labels";

type Me = {
  nameEn: string | null;
  nameAr: string | null;
  email: string | null;
  phone: string | null;
  createdAt?: string;
};
type AuthMe = { role: string; appRole?: { nameEn: string } | null; lastLoginAt?: string | null };

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
  </label>
);

/** The signed-in staff member's own profile: details, password, sign out. */
export default function MyProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [form, setForm] = useState({ nameEn: "", nameAr: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setMe(d.data);
        setForm({ nameEn: d.data.nameEn ?? "", nameAr: d.data.nameAr ?? "", email: d.data.email ?? "", phone: d.data.phone ?? "" });
      })
      .catch(() => {});
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setAuth(d.data))
      .catch(() => {});
  }, []);

  const dirty =
    !!me &&
    (form.nameEn !== (me.nameEn ?? "") || form.nameAr !== (me.nameAr ?? "") || form.email !== (me.email ?? "") || form.phone !== (me.phone ?? ""));

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) return toast.error("Keep a mobile number or an email so you can sign in.");
    setSaving(true);
    const d = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameEn: form.nameEn.trim(), nameAr: form.nameAr.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!d?.success) return toast.error(d?.error || "Could not save your details.");
    setMe((m) => (m ? { ...m, ...form } : m));
    toast.success("Your details are saved.");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast.error("The new password needs at least 6 characters.");
    if (pw.next !== pw.confirm) return toast.error("The two new passwords don't match.");
    setSavingPw(true);
    const d = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSavingPw(false);
    if (!d?.success) return toast.error(d?.error || "Could not change your password.");
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password changed.");
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/signin");
  };

  if (!me) {
    return <div className="flex justify-center py-16"><span className="spinner" /></div>;
  }

  const role = auth?.appRole?.nameEn ?? (auth?.role ? humanize(auth.role) : undefined);

  return (
    <div className="max-w-3xl space-y-5">
      {/* Who you are */}
      <div className="admin-card p-5 flex items-center gap-4">
        <span className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-semibold shrink-0">
          {(me.nameEn || me.email || me.phone || "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-800 truncate">{me.nameEn || "My account"}</p>
          <p className="text-sm text-slate-500">
            {role && <span className="font-medium text-slate-600">{role}</span>}
            {auth?.lastLoginAt && <span> · last signed in {new Date(auth.lastLoginAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>}
          </p>
        </div>
      </div>

      {/* Details */}
      <form onSubmit={saveProfile} className="admin-card p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2"><LuUserRound size={18} /> My details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name (English)">
            <input className="admin-input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required minLength={2} />
          </Field>
          <Field label="Name (Arabic)">
            <input className="admin-input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          </Field>
          <Field label="Mobile number" hint="You can sign in with your mobile number or your email.">
            <input className="admin-input" dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 9944 0312" />
          </Field>
          <Field label="Email" hint="Optional.">
            <input className="admin-input" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={!dirty || saving} className="admin-btn admin-btn-primary disabled:opacity-40">
            {saving ? <span className="spinner !w-4 !h-4 !border-2" /> : <LuSave size={16} />} Save details
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={changePassword} className="admin-card p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2"><LuKeyRound size={18} /> Change password</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Current password">
            <input className="admin-input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </Field>
          <Field label="New password" hint="At least 6 characters.">
            <input className="admin-input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={6} />
          </Field>
          <Field label="New password again">
            <input className="admin-input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
          </Field>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={savingPw || !pw.current || !pw.next} className="admin-btn admin-btn-primary disabled:opacity-40">
            {savingPw ? <span className="spinner !w-4 !h-4 !border-2" /> : <LuKeyRound size={16} />} Change password
          </button>
        </div>
      </form>

      {/* Sign out */}
      <div className="admin-card p-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Finished for now? Sign out of the admin on this device.</p>
        <button onClick={signOut} className="admin-btn admin-btn-danger">
          <LuLogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
