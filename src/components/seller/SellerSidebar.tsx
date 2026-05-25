"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/seller", label: "Dashboard", icon: "📊", exact: true },
  { href: "/seller/products", label: "My Products", icon: "👗" },
  { href: "/seller/orders", label: "Orders", icon: "📦" },
  { href: "/seller/inventory", label: "Inventory", icon: "🏪" },
  { href: "/seller/analytics", label: "Analytics", icon: "📈" },
];

export default function SellerSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  };

  return (
    <aside className="seller-sidebar w-60 flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">Hala Dresses</h1>
            <p className="text-sky-400 text-xs">Seller Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
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

      <div className="px-3 py-4 border-t border-white/10 space-y-1">
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
