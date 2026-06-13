"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LuWallet,
  LuPackage,
  LuUsers,
  LuShirt,
  LuTrendingUp,
  LuTrendingDown,
  LuTrophy,
  LuArrowRight,
  LuChartColumnBig,
} from "react-icons/lu";
import type { IconType } from "react-icons";

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
  topProducts?: Array<{
    productId: string;
    _sum: { quantity: number | null };
    product?: {
      nameEn: string;
      images?: { url: string }[];
    } | null;
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
  const topProducts = data?.topProducts ?? [];
  const maxSold = Math.max(1, ...topProducts.map((p) => p._sum.quantity ?? 0));
  const thisMonth = stats?.revenueThisMonth ?? 0;
  const lastMonth = stats?.revenueLastMonth ?? 0;
  const revenueMax = Math.max(1, thisMonth, lastMonth);
  const growth = stats?.revenueGrowth ?? 0;

  const statCards: Array<{
    label: string;
    value: string | number;
    sub: string;
    trend?: number;
    icon: IconType;
    accent: string;
    ring: string;
  }> = [
    {
      label: "Revenue (This Month)",
      value: `${thisMonth.toFixed(3)} OMR`,
      sub: "vs last month",
      trend: growth,
      icon: LuWallet,
      accent: "from-emerald-400 to-teal-500",
      ring: "ring-emerald-100",
    },
    {
      label: "Orders This Month",
      value: stats?.ordersThisMonth ?? 0,
      sub: `${stats?.pendingOrders ?? 0} pending`,
      icon: LuPackage,
      accent: "from-sky-400 to-indigo-500",
      ring: "ring-sky-100",
    },
    {
      label: "Total Users",
      value: stats?.totalUsers ?? 0,
      sub: `+${stats?.newUsersThisMonth ?? 0} this month`,
      icon: LuUsers,
      accent: "from-violet-400 to-purple-500",
      ring: "ring-violet-100",
    },
    {
      label: "Active Products",
      value: `${stats?.activeProducts ?? 0} / ${stats?.totalProducts ?? 0}`,
      sub: `${stats?.lowStockCount ?? 0} low stock`,
      icon: LuShirt,
      accent: "from-rose-400 to-pink-500",
      ring: "ring-rose-100",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-6 sm:px-7 sm:py-7">
        <div className="relative z-10">
          <h2 className="text-white text-xl sm:text-2xl font-bold">Welcome back</h2>
          <p className="text-slate-300 text-sm mt-1">
            Here is what is happening with your store today.
          </p>
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-indigo-500/20 blur-2xl" />
        <div className="absolute right-16 bottom-0 w-24 h-24 rounded-full bg-fuchsia-500/20 blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const up = (card.trend ?? 0) >= 0;
          return (
            <div
              key={card.label}
              className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.accent} ring-4 ${card.ring} flex items-center justify-center shadow-sm`}
                >
                  <Icon className="text-white" size={22} />
                </div>
                {typeof card.trend === "number" && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                      up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {up ? <LuTrendingUp size={13} /> : <LuTrendingDown size={13} />}
                    {up ? "+" : ""}{card.trend}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-4">{card.value}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{card.label}</p>
              <p className="text-xs text-slate-400 mt-2">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Revenue comparison + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <LuChartColumnBig className="text-indigo-500" size={17} />
            </span>
            <h3 className="font-semibold text-slate-800">Revenue Overview</h3>
          </div>
          <div className="p-5 space-y-5">
            {[
              { label: "This Month", value: thisMonth, color: "from-indigo-500 to-violet-500" },
              { label: "Last Month", value: lastMonth, color: "from-slate-300 to-slate-400" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">{row.label}</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {row.value.toFixed(3)} OMR
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${row.color} transition-all duration-500`}
                    style={{ width: `${(row.value / revenueMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <LuTrophy className="text-amber-500" size={17} />
            </span>
            <h3 className="font-semibold text-slate-800">Top Products</h3>
          </div>
          <div className="p-5 space-y-4">
            {topProducts.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">No sales data yet.</p>
            )}
            {topProducts.map((tp, i) => {
              const sold = tp._sum.quantity ?? 0;
              return (
                <div key={tp.productId} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {tp.product?.images?.[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tp.product.images[0].url}
                        alt={tp.product?.nameEn || ""}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <LuShirt className="text-slate-300" size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {tp.product?.nameEn || "Unknown product"}
                    </p>
                    <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500"
                        style={{ width: `${(sold / maxSold) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-600 flex-shrink-0">
                    {sold}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <LuPackage className="text-sky-500" size={17} />
            </span>
            <h3 className="font-semibold text-slate-800">Recent Orders</h3>
          </div>
          <Link
            href="/admin/orders"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            View all <LuArrowRight size={15} />
          </Link>
        </div>

        {/* Mobile: card list */}
        <div className="divide-y divide-slate-100 md:hidden">
          {data?.recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 active:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-indigo-600 text-sm">{order.orderNumber}</p>
                <p className="text-xs text-slate-500 truncate">
                  {order.user?.nameEn || order.user?.email || "Guest"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-slate-800 text-sm">
                  {Number(order.total).toFixed(3)} OMR
                </p>
                <span className={`badge ${statusClass[order.status] || "badge-pending"} mt-1`}>
                  {order.status}
                </span>
              </div>
            </Link>
          ))}
          {data?.recentOrders.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No orders yet.</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
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
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                      {order.orderNumber}
                    </Link>
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
