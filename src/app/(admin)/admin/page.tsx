"use client";
import { useEffect, useState } from "react";

type DashboardData = {
  stats: {
    totalUsers: number;
    newUsersThisMonth: number;
    totalOrders: number;
    ordersThisMonth: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueGrowth: number;
    totalProducts: number;
    activeProducts: number;
    pendingOrders: number;
    lowStockCount: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
    user?: { nameEn?: string; email: string };
  }>;
};

const statusClass: Record<string, string> = {
  PENDING: "badge-pending", CONFIRMED: "badge-confirmed",
  PROCESSING: "badge-processing", SHIPPED: "badge-shipped",
  DELIVERED: "badge-delivered", CANCELLED: "badge-cancelled",
  REFUNDED: "badge-refunded",
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  const stats = data?.stats;

  const statCards = [
    {
      label: "Total Revenue (This Month)",
      value: `${stats?.revenueThisMonth.toFixed(3)} OMR`,
      sub: `${stats?.revenueGrowth && stats.revenueGrowth > 0 ? "+" : ""}${stats?.revenueGrowth}% vs last month`,
      subColor: (stats?.revenueGrowth ?? 0) >= 0 ? "text-green-600" : "text-red-600",
      icon: "💰",
      iconBg: "bg-green-100",
    },
    {
      label: "Orders This Month",
      value: stats?.ordersThisMonth ?? 0,
      sub: `${stats?.pendingOrders} pending`,
      subColor: "text-amber-600",
      icon: "📦",
      iconBg: "bg-blue-100",
    },
    {
      label: "Total Users",
      value: stats?.totalUsers ?? 0,
      sub: `+${stats?.newUsersThisMonth} this month`,
      subColor: "text-green-600",
      icon: "👥",
      iconBg: "bg-purple-100",
    },
    {
      label: "Active Products",
      value: `${stats?.activeProducts} / ${stats?.totalProducts}`,
      sub: `${stats?.lowStockCount} low stock`,
      subColor: stats?.lowStockCount ? "text-red-600" : "text-green-600",
      icon: "👗",
      iconBg: "bg-rose-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{card.value}</p>
                <p className={`text-xs mt-1 ${card.subColor}`}>{card.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center text-xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="admin-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Recent Orders</h3>
          <a href="/admin/orders" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            View all →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <a href={`/admin/orders/${order.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                      {order.orderNumber}
                    </a>
                  </td>
                  <td>{order.user?.nameEn || order.user?.email || "Guest"}</td>
                  <td className="font-medium">{Number(order.total).toFixed(3)} OMR</td>
                  <td>
                    <span className={`badge ${statusClass[order.status] || "badge-pending"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${order.paymentStatus.toLowerCase()}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="text-slate-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
