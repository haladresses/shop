"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LuCalendarDays, LuChartColumn, LuPackage, LuShirt, LuWallet, LuWarehouse } from "react-icons/lu";

type Stats = {
  myProducts: number;
  activeProducts: number;
  myOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  thisMonthRevenue: number;
};

export default function SellerDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; nameEn?: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.success) setUser(d.data); });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const fetchStats = async () => {
      const [productsRes, ordersRes] = await Promise.all([
        fetch(`/api/products?sellerId=${user.id}&pageSize=1`),
        fetch("/api/orders?pageSize=100"),
      ]);
      const productsData = await productsRes.json();
      const ordersData = await ordersRes.json();

      const activeRes = await fetch(`/api/products?sellerId=${user.id}&isActive=true&pageSize=1`);
      const activeData = await activeRes.json();

      const orders = ordersData.success ? ordersData.data : [];
      const pending = orders.filter((o: { status: string }) => o.status === "PENDING").length;
      const revenue = orders.filter((o: { paymentStatus: string }) => o.paymentStatus === "PAID").reduce((s: number, o: { total: number }) => s + Number(o.total), 0);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthRevenue = orders.filter((o: { paymentStatus: string; createdAt: string }) => o.paymentStatus === "PAID" && new Date(o.createdAt) >= startOfMonth).reduce((s: number, o: { total: number }) => s + Number(o.total), 0);

      setStats({
        myProducts: productsData.meta?.total || 0,
        activeProducts: activeData.meta?.total || 0,
        myOrders: ordersData.meta?.total || 0,
        pendingOrders: pending,
        totalRevenue: revenue,
        thisMonthRevenue: monthRevenue,
      });
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>;

  const cards = [
    { label: "My Products", value: stats?.myProducts || 0, sub: `${stats?.activeProducts || 0} active`, icon: LuShirt },
    { label: "Total Orders", value: stats?.myOrders || 0, sub: `${stats?.pendingOrders || 0} pending`, icon: LuPackage },
    { label: "Total Revenue", value: `${(stats?.totalRevenue || 0).toFixed(3)} OMR`, sub: "All time", icon: LuWallet },
    { label: "This Month", value: `${(stats?.thisMonthRevenue || 0).toFixed(3)} OMR`, sub: "Revenue this month", icon: LuCalendarDays },
  ];

  const actions = [
    { href: "/seller/products", label: "Manage Products", icon: LuShirt },
    { href: "/seller/orders", label: "View Orders", icon: LuPackage },
    { href: "/seller/inventory", label: "Check Inventory", icon: LuWarehouse },
    { href: "/seller/analytics", label: "Analytics", icon: LuChartColumn },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Welcome back, {user?.nameEn || "Seller"}</h1>
        <p className="text-slate-500 text-sm mt-1">Here&apos;s a summary of your store.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{card.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm font-medium hover:bg-slate-100"
              >
                <Icon size={16} className="text-slate-500" /> {a.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
