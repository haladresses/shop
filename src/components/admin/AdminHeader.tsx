"use client";
import { useState, useEffect } from "react";
import { LuBell, LuSearch, LuMenu } from "react-icons/lu";

type AdminUser = {
  nameEn?: string | null;
  email: string;
  role: string;
  avatar?: string | null;
};

export default function AdminHeader({ title, onMenuClick }: { title?: string; onMenuClick?: () => void }) {
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setUser(d.data); })
      .catch(() => {});
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Hamburger (mobile only) */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          title="Menu"
        >
          <LuMenu size={22} />
        </button>

        {/* Profile (top-left) */}
        {user && (
          <button className="flex items-center gap-2.5 rounded-full hover:bg-slate-100 pr-2 sm:pr-3 sm:py-1 transition-colors min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0">
              {user.nameEn?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-slate-700 leading-tight truncate max-w-[120px] sm:max-w-none">
                {user.nameEn || user.email}
              </p>
              <p className="text-xs text-slate-500 capitalize leading-tight">
                {user.role.replace("_", " ").toLowerCase()}
              </p>
            </div>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Page title */}
        {title && (
          <h2 className="hidden lg:block text-sm font-medium text-slate-400 mr-1">{title}</h2>
        )}

        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100/80 rounded-full px-4 py-2 w-40 lg:w-56 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-200 transition">
          <LuSearch className="text-slate-400 flex-shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent outline-none text-sm text-slate-700 w-full placeholder:text-slate-400"
          />
        </div>

        {/* Notifications */}
        <button
          className="relative w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Notifications"
        >
          <LuBell size={19} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
