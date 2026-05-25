"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊", exact: true },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/products", label: "Products", icon: "👗" },
  { href: "/admin/categories", label: "Categories", icon: "🏷️" },
  { href: "/admin/inventory", label: "Inventory", icon: "🏪" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/payments", label: "Payments", icon: "💳" },
  { href: "/admin/coupons", label: "Coupons", icon: "🎫" },
  { href: "/admin/reviews", label: "Reviews", icon: "⭐" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default function AdminSidebar() {
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
    <aside
      className={`admin-sidebar flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Hala Dresses</h1>
            <p className="text-indigo-300 text-xs">Admin Panel</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-link ${isActive(item.href, item.exact) ? "active" : ""}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link href="/" className="admin-nav-link" target="_blank">
          <span className="text-lg">🛍️</span>
          {!collapsed && <span>View Store</span>}
        </Link>
        <button onClick={handleLogout} className="admin-nav-link w-full text-left">
          <span className="text-lg">🚪</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
