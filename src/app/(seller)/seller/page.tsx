"use client";
import { useEffect, useState } from "react";

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

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  const cards = [
    { label: "My Products", value: stats?.myProducts || 0, sub: `${stats?.activeProducts} active`, icon: "👗", color: "bg-indigo-50 text-indigo-600" },
    { label: "Total Orders", value: stats?.myOrders || 0, sub: `${stats?.pendingOrders} pending`, icon: "📦", color: "bg-amber-50 text-amber-600" },
    { label: "Total Revenue", value: `${(stats?.totalRevenue || 0).toFixed(3)} OMR`, sub: "All time", icon: "💰", color: "bg-green-50 text-green-600" },
    { label: "This Month", value: `${(stats?.thisMonthRevenue || 0).toFixed(3)} OMR`, sub: "Month revenue", icon: "📅", color: "bg-sky-50 text-sky-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Welcome back, {user?.nameEn || "Seller"}!</h1>
        <p className="text-slate-500 text-sm mt-1">Here&apos;s a summary of your store performance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{card.value}</p>
                <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center text-xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/seller/products" className="flex items-center gap-2 px-4 py-2 bg-sky-50 text-sky-700 rounded-lg text-sm font-medium hover:bg-sky-100 transition-colors">
            <span>👗</span> Manage Products
          </a>
          <a href="/seller/orders" className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors">
            <span>📦</span> View Orders
          </a>
          <a href="/seller/inventory" className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
            <span>🏪</span> Check Inventory
          </a>
          <a href="/seller/analytics" className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors">
            <span>📈</span> Analytics
          </a>
        </div>
      </div>
    </div>
  );
}
