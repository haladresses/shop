"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { SELLER_NAV_ITEMS } from "@/lib/permissions";

const navItems = [
  { href: "/seller", label: "Dashboard", icon: "📊", permission: "seller.dashboard.view", exact: true },
  { href: "/seller/products", label: "My Products", icon: "👗", permission: "seller.products.view" },
  { href: "/seller/orders", label: "Orders", icon: "📦", permission: "seller.orders.view" },
  { href: "/seller/inventory", label: "Inventory", icon: "🏪", permission: "seller.inventory.view" },
  { href: "/seller/analytics", label: "Analytics", icon: "📈", permission: "seller.analytics.view" },
];

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
    <aside className="seller-sidebar flex h-screen w-60 shrink-0 flex-col overflow-hidden">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg p-1">
            <Image src="/logo.svg" alt="Hala Dresses" width={28} height={28} />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">Hala Dresses</h1>
            <p className="text-sky-400 text-xs">Seller Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1">
        {navItems.filter((item) => allowedKeys.has(item.permission)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`seller-nav-link ${isActive(item.href, item.exact) ? "active" : ""}`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="shrink-0 px-3 py-4 border-t border-white/10 space-y-1">
        <Link href="/" className="seller-nav-link" target="_blank">
          <span className="text-lg">🛍️</span>
          <span>Visit Store</span>
        </Link>
        <button onClick={handleLogout} className="seller-nav-link w-full text-left">
          <span className="text-lg">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
