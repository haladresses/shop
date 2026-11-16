"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuChevronDown, LuLogOut, LuMenu, LuStore, LuUserRound } from "react-icons/lu";

type AdminUser = {
  nameEn?: string | null;
  nameAr?: string | null;
  email: string | null;
  phone?: string | null;
  role: string;
  appRole?: { nameEn: string; color?: string | null } | null;
};

const PLACEHOLDER_DOMAIN = "@phone.haladresses.local";
const roleName = (u: AdminUser) => u.appRole?.nameEn ?? u.role.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * Top bar of the admin: page title on the left, the signed-in person on the
 * right. Clicking your name opens a small menu with your details, your
 * profile page, the store and sign out.
 */
export default function AdminHeader({ title, onMenuClick }: { title?: string; onMenuClick?: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && setUser(d.data))
      .catch(() => {});
  }, []);

  // Close on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/signin");
  };

  const email = user?.email && !user.email.endsWith(PLACEHOLDER_DOMAIN) ? user.email : null;
  const name = user ? user.nameEn || email || user.phone || "My account" : "";

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 flex-shrink-0"
          title="Menu"
          aria-label="Open menu"
        >
          <LuMenu size={22} />
        </button>
        {title && <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{title}</h1>}
      </div>

      {user && (
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex items-center gap-2.5 rounded-xl pl-1.5 pr-2 py-1 hover:bg-slate-100 ${open ? "bg-slate-100" : ""}`}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="hidden sm:block text-left min-w-0">
              <span className="block text-sm font-medium text-slate-800 leading-tight truncate max-w-[180px]">{name}</span>
              <span className="block text-xs text-slate-500 leading-tight">{roleName(user)}</span>
            </span>
            <LuChevronDown size={16} className="text-slate-400" />
          </button>

          {open && (
            <div role="menu" className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden z-50">
              <div className="px-4 py-3.5 border-b border-slate-100">
                <p className="font-semibold text-slate-800 truncate">{name}</p>
                {user.nameAr && <p dir="rtl" className="text-sm text-slate-600 truncate text-left">{user.nameAr}</p>}
                {email && <p className="text-sm text-slate-500 truncate">{email}</p>}
                {user.phone && <p className="text-sm text-slate-500 truncate" dir="ltr">{user.phone}</p>}
                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{roleName(user)}</span>
              </div>
              <div className="py-1.5">
                <Link href="/admin/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50" role="menuitem">
                  <LuUserRound size={17} className="text-slate-400" /> My profile
                </Link>
                <a href="/" target="_blank" rel="noopener" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50" role="menuitem">
                  <LuStore size={17} className="text-slate-400" /> View store
                </a>
                <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50" role="menuitem">
                  <LuLogOut size={17} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
