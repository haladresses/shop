"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LuStore,
  LuLogOut,
  LuChevronLeft,
  LuChevronRight,
  LuX,
} from "react-icons/lu";
import { ADMIN_NAV_ITEMS } from "@/lib/permissions";
import { ADMIN_NAVIGATION_META, ADMIN_NAVIGATION_SECTION_ORDER } from "@/lib/adminNavigationMeta";

type AdminSidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
  permissions?: string[];
};

export default function AdminSidebar({ mobileOpen = false, onClose, permissions = [] }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const allowedKeys = new Set(permissions.length > 0 ? permissions : ADMIN_NAV_ITEMS.map((item) => item.permission));

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`admin-sidebar flex flex-col transition-all duration-300
          fixed inset-y-0 left-0 z-50 lg:static lg:z-auto lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "lg:w-16 w-64" : "w-64"}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-700/60">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg p-1">
                <Image src="/logo.svg" alt="Hala Dresses" width={28} height={28} />
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">Hala Dresses</h1>
                <p className="text-slate-400 text-[11px]">Admin Panel</p>
              </div>
            </div>
          )}
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:inline-flex text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <LuChevronRight size={18} /> : <LuChevronLeft size={18} />}
          </button>
          {/* Close button (mobile only) */}
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <LuX size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {ADMIN_NAVIGATION_SECTION_ORDER.map((section) => {
            const items = ADMIN_NAVIGATION_META.filter((item) => item.section === section && allowedKeys.has(item.permission));
            if (items.length === 0) return null;

            return (
              <div key={section} className="space-y-1.5">
                {!collapsed && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {section}
                  </div>
                )}
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`admin-nav-link ${active ? "active" : ""} ${collapsed ? "lg:justify-center" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={19} className={`flex-shrink-0 ${item.color}`} />
                      <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="shrink-0 px-3 py-4 border-t border-slate-700/60 space-y-1">
          <Link
            href="/"
            className={`admin-nav-link ${collapsed ? "lg:justify-center" : ""}`}
            target="_blank"
            title={collapsed ? "View Store" : undefined}
          >
            <LuStore size={19} className="flex-shrink-0 text-teal-400" />
            <span className={collapsed ? "lg:hidden" : ""}>View Store</span>
          </Link>          <button
            onClick={handleLogout}
            className={`admin-nav-link w-full text-left ${collapsed ? "lg:justify-center" : ""}`}
            title={collapsed ? "Logout" : undefined}
          >
            <LuLogOut size={19} className="flex-shrink-0 text-red-400" />
            <span className={collapsed ? "lg:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
