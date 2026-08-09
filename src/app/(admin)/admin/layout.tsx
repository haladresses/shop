"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { ADMIN_NAV_ITEMS } from "@/lib/permissions";
import "../admin.css";

type MeResponse = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
};
const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Users Management",
  "/admin/products": "Products Management",
  "/admin/products/new": "Add Product",
  "/admin/categories": "Categories",
  "/admin/orders": "Orders",
  "/admin/inventory": "Inventory",
  "/admin/payments": "Payments",
  "/admin/coupons": "Coupons",
  "/admin/reviews": "Reviews",
  "/admin/hero": "Homepage Hero",
  "/admin/roles": "Roles & Permissions",
  "/admin/settings": "Settings",
};

function resolveTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Edit product: /admin/products/<id>
  if (/^\/admin\/products\/[^/]+$/.test(pathname)) return "Edit Product";
  return "Admin";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !d.data?.permissions?.includes("panel.admin.access")) {
          router.push("/signin");
        } else {
          setMe(d.data);
        }
      })
      .catch(() => router.push("/admin/login"))
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    if (!me) return;
    const routeItem = ADMIN_NAV_ITEMS.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href)
    );

    if (routeItem && !me.permissions.includes(routeItem.permission)) {
      const fallback = ADMIN_NAV_ITEMS.find((item) => me.permissions.includes(item.permission));
      router.push(fallback?.href || "/signin");
    }
  }, [me, pathname, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const title = resolveTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <AdminSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        permissions={me?.permissions ?? []}
      />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        <AdminHeader title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
