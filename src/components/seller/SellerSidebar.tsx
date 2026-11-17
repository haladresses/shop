"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { IconType } from "react-icons";
import { LuChartColumn, LuLayoutDashboard, LuLogOut, LuPackage, LuShirt, LuStore, LuWarehouse } from "react-icons/lu";
import { SELLER_NAV_ITEMS } from "@/lib/permissions";

const navItems: { href: string; label: string; section: string; icon: IconType; permission: string; exact?: boolean }[] = [
  { href: "/seller", label: "Dashboard", section: "Overview", icon: LuLayoutDashboard, permission: "seller.dashboard.view", exact: true },
  { href: "/seller/orders", label: "Orders", section: "Operations", icon: LuPackage, permission: "seller.orders.view" },
  { href: "/seller/products", label: "My Products", section: "Catalog", icon: LuShirt, permission: "seller.products.view" },
  { href: "/seller/inventory", label: "Inventory", section: "Catalog", icon: LuWarehouse, permission: "seller.inventory.view" },
  { href: "/seller/analytics", label: "Analytics", section: "Performance", icon: LuChartColumn, permission: "seller.analytics.view" },
];

const navSections = ["Overview", "Operations", "Catalog", "Performance"] as const;

export default function SellerSidebar({ permissions = [] }: { permissions?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowedKeys = new Set(permissions.length > 0 ? permissions : SELLER_NAV_ITEMS.map((item) => item.permission));

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  };

  return (
    <aside className="seller-sidebar flex h-screen w-64 shrink-0 flex-col overflow-hidden">
      <div className="px-4 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center p-1">
            <Image src="/logo.svg" alt="Hala Dresses" width={28} height={28} />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Hala Dresses</h1>
            <p className="text-slate-400 text-[11px]">Seller Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1">
        {navSections.map((section) => {
          const items = navItems.filter((item) => item.section === section && allowedKeys.has(item.permission));
          if (items.length === 0) return null;

          return (
            <div key={section} className="space-y-1.5">
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {section}
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`seller-nav-link ${isActive(item.href, item.exact) ? "active" : ""}`}
                  >
                    <Icon size={19} className="shrink-0 text-slate-400" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 px-3 py-4 border-t border-slate-700/60 space-y-1">
        <Link href="/" className="seller-nav-link" target="_blank">
          <LuStore size={19} className="shrink-0 text-slate-400" />
          <span>View Store</span>
        </Link>
        <button onClick={handleLogout} className="seller-nav-link w-full text-left">
          <LuLogOut size={19} className="shrink-0 text-slate-400" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
