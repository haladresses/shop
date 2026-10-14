"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LuEye, LuEyeOff, LuLoaderCircle, LuLock, LuShieldCheck } from "react-icons/lu";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Invalid email or password");
        return;
      }
      // Same rule as the admin layout: access comes from the role's permissions.
      const permissions: string[] = data.data.user.permissions || [];
      if (!permissions.includes("panel.admin.access")) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        setError("This account doesn't have access to the admin panel.");
        return;
      }
      router.push("/admin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";

  return (
    <div className="min-h-[100dvh] bg-[#F7F2EE] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 flex items-center justify-center mb-4">
            <Image src="/logo.svg" alt="Hala Dresses" width={36} height={36} priority />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin panel</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage Hala Dresses</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-[0_20px_60px_-30px_rgba(47,36,31,.35)] ring-1 ring-black/5 p-6 sm:p-8 space-y-5">
          {error && (
            <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">
              {error}
            </div>
          )}
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Email</span>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={input}
              placeholder="you@haladresses.com"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">Password</span>
            <span className="relative block">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`${input} pe-12`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute end-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              >
                {show ? <LuEyeOff size={18} /> : <LuEye size={18} />}
              </button>
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-slate-900 hover:bg-[#8C3B49] text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
          >
            {loading ? <LuLoaderCircle size={18} className="animate-spin" /> : <LuLock size={16} />}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-6">
          <LuShieldCheck size={14} /> Staff-only area
        </p>
      </div>
    </div>
  );
}
