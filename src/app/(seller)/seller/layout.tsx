"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SellerSidebar from "@/components/seller/SellerSidebar";
import { usePathname } from "next/navigation";
import { SELLER_NAV_ITEMS } from "@/lib/permissions";
import "../seller.css";

type MeResponse = {
  nameEn?: string | null;
  email: string | null;
  role: string;
  appRole?: { nameEn: string } | null;
  permissions: string[];
};

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
  SELLER: "Seller",
  CUSTOMER: "Customer",
};

/** "SUPER_ADMIN" -> "Super Admin" (or the custom role's own name). */
const roleName = (u: MeResponse) =>
  u.appRole?.nameEn ||
  ROLE_NAMES[u.role] ||
  u.role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !d.data?.permissions?.includes("panel.seller.access")) {
          router.push("/signin");
        } else {
          setUser(d.data);
        }
      })
      .catch(() => router.push("/seller/login"))
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const routeItem = SELLER_NAV_ITEMS.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href)
    );

    if (routeItem && !user.permissions.includes(routeItem.permission)) {
      const fallback = SELLER_NAV_ITEMS.find((item) => user.permissions.includes(item.permission));
      router.push(fallback?.href || "/signin");
    }
  }, [pathname, router, user]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SellerSidebar permissions={user?.permissions ?? []} />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-end">
          {user && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                {(user.nameEn || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 leading-tight">{user.nameEn || user.email}</p>
                <p className="text-xs text-slate-500 leading-tight">{roleName(user)}</p>
              </div>
            </div>
          )}
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
