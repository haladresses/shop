"use client";
import { useState, useEffect } from "react";

type AdminUser = {
  nameEn?: string | null;
  email: string;
  role: string;
  avatar?: string | null;
};

export default function AdminHeader({ title }: { title?: string }) {
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setUser(d.data); })
      .catch(() => {});
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        {title && <h2 className="text-lg font-semibold text-slate-800">{title}</h2>}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
              {user.nameEn?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-700">{user.nameEn || user.email}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role.replace("_", " ").toLowerCase()}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
