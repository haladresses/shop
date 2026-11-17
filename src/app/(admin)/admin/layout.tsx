"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { ADMIN_NAV_ITEMS } from "@/lib/permissions";
import { Toaster } from "react-hot-toast";
import { LuCircleAlert, LuCircleCheck } from "react-icons/lu";
import "../admin.css";

type MeResponse = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
};
const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "People",
  "/admin/products": "Products Management",
  "/admin/products/new": "Add Product",
  "/admin/products/labels": "Barcode Labels",
  "/admin/categories": "Categories",
  "/admin/orders": "Orders",
  "/admin/reports": "Sales Report",
  "/admin/finance": "Finance & Profit / Loss",
  "/admin/returns": "Returns & Refunds",
  "/admin/inventory": "Inventory",
  "/admin/suppliers": "Suppliers",
  "/admin/purchases": "Purchase Orders",
  "/admin/purchases/new": "New Purchase Order",
  "/admin/supplier-returns": "Supplier Returns",
  "/admin/supplier-returns/new": "New Return to Supplier",
  "/admin/tax": "Tax & VAT",
  "/admin/payments": "Payments",
  "/admin/coupons": "Coupons",
  "/admin/promotions": "Promotions",
  "/admin/promotions/new": "New Promotion",
  "/admin/reviews": "Reviews",
  "/admin/hero": "Homepage Hero",
  "/admin/contact": "Contact",
  "/admin/help": "Help Center",
  "/admin/roles": "Roles & Permissions",
  "/admin/roles/new": "New Role",
  "/admin/settings": "Settings",
  "/admin/profile": "My Profile",
  "/admin/legal-pages": "Legal Pages",
  "/admin/testimonials": "Testimonials",
  "/admin/countdown": "Countdown Deal",
  "/admin/navigation": "Navigation Menu",
  "/admin/newsletter": "Newsletter",
  "/admin/promo-banner": "Promo Banner",
  "/admin/shipping": "Shipping",
  "/admin/seller": "Seller",
};

function resolveTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Category specification fields: /admin/categories/<id>/attributes
  if (/^\/admin\/categories\/[^/]+\/attributes$/.test(pathname)) return "Category Fields";
  // Product WhatsApp reviews: /admin/products/<id>/whatsapp-reviews
  if (/^\/admin\/products\/[^/]+\/whatsapp-reviews$/.test(pathname)) return "WhatsApp Reviews";
  if (/^\/admin\/suppliers\/[^/]+$/.test(pathname)) return "Supplier";
  if (/^\/admin\/promotions\/[^/]+$/.test(pathname)) return "Edit Promotion";
  if (/^\/admin\/supplier-returns\/[^/]+$/.test(pathname)) return "Supplier Return";
  if (/^\/admin\/purchases\/[^/]+$/.test(pathname)) return "Purchase Order";
  if (/^\/admin\/roles\/[^/]+$/.test(pathname)) return "Edit Role";
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
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2600,
          style: { fontSize: "0.875rem", borderRadius: "0.75rem" },
          // Still icons: the library's own tick and cross only appear through an
          // animation, which the admin turns off (see admin.css "No motion").
          success: { icon: <LuCircleCheck size={20} className="text-emerald-600 shrink-0" /> },
          error: { icon: <LuCircleAlert size={20} className="text-rose-600 shrink-0" /> },
        }}
      />
    </div>
  );
}
