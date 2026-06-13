"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LuLayoutDashboard,
  LuPackage,
  LuShirt,
  LuTags,
  LuWarehouse,
  LuUsers,
  LuCreditCard,
  LuTicket,
  LuStar,
  LuSettings,
  LuStore,
  LuImage,
  LuLogOut,
  LuChevronLeft,
  LuChevronRight,
  LuX,
} from "react-icons/lu";
import type { IconType } from "react-icons";

type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  color: string;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LuLayoutDashboard, color: "text-sky-400", exact: true },
  { href: "/admin/orders", label: "Orders", icon: LuPackage, color: "text-amber-400" },
  { href: "/admin/products", label: "Products", icon: LuShirt, color: "text-rose-400" },
  { href: "/admin/categories", label: "Categories", icon: LuTags, color: "text-emerald-400" },
  { href: "/admin/inventory", label: "Inventory", icon: LuWarehouse, color: "text-orange-400" },
  { href: "/admin/users", label: "Users", icon: LuUsers, color: "text-violet-400" },
  { href: "/admin/payments", label: "Payments", icon: LuCreditCard, color: "text-green-400" },
  { href: "/admin/coupons", label: "Coupons", icon: LuTicket, color: "text-pink-400" },
  { href: "/admin/reviews", label: "Reviews", icon: LuStar, color: "text-yellow-400" },
  { href: "/admin/hero", label: "Homepage Hero", icon: LuImage, color: "text-cyan-400" },
  { href: "/admin/settings", label: "Settings", icon: LuSettings, color: "text-slate-300" },
];

type AdminSidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function AdminSidebar({ mobileOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
                <LuShirt className="text-white text-lg" />
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
          {navItems.map((item) => {
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
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-slate-700/60 space-y-1">
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
