"use client";
import { useEffect, useState } from "react";

export default function SellerAnalyticsPage() {
  const [data, setData] = useState<{
    revenueByMonth: Array<{ month: string; revenue: number; orders: number }>;
    topProducts: Array<{ nameEn: string; quantity: number; revenue: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simple analytics using existing orders
    fetch("/api/orders?pageSize=100")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const orders = d.data;
          const monthMap: Record<string, { revenue: number; orders: number }> = {};
          orders.forEach((o: { createdAt: string; total: number; paymentStatus: string }) => {
            const month = new Date(o.createdAt).toLocaleString("default", { month: "short", year: "numeric" });
            if (!monthMap[month]) monthMap[month] = { revenue: 0, orders: 0 };
            monthMap[month].orders++;
            if (o.paymentStatus === "PAID") monthMap[month].revenue += Number(o.total);
          });

          const revenueByMonth = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));

          const productMap: Record<string, { nameEn: string; quantity: number; revenue: number }> = {};
          orders.forEach((o: { items: Array<{ quantity: number; unitPrice: number; product: { nameEn: string } }> }) => {
            o.items.forEach((item: { quantity: number; unitPrice: number; product: { nameEn: string } }) => {
              const name = item.product.nameEn;
              if (!productMap[name]) productMap[name] = { nameEn: name, quantity: 0, revenue: 0 };
              productMap[name].quantity += item.quantity;
              productMap[name].revenue += item.quantity * item.unitPrice;
            });
          });

          const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
          setData({ revenueByMonth, topProducts });
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800">Analytics</h2>

      {/* Revenue by Month */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Revenue by Month</h3>
        {data?.revenueByMonth.length === 0 ? (
          <p className="text-slate-400 text-sm">No data yet</p>
        ) : (
          <div className="space-y-3">
            {data?.revenueByMonth.map((row) => (
              <div key={row.month} className="flex items-center gap-4">
                <div className="w-24 text-sm text-slate-600 font-medium">{row.month}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 bg-sky-400 rounded-full"
                    style={{ width: `${Math.min(100, (row.revenue / 1000) * 100)}%` }}
                  />
                </div>
                <div className="text-sm font-medium text-slate-700 w-28 text-right">
                  {row.revenue.toFixed(3)} OMR
                </div>
                <div className="text-xs text-slate-400 w-16">{row.orders} orders</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Top Products by Revenue</h3>
        {data?.topProducts.length === 0 ? (
          <p className="text-slate-400 text-sm">No data yet</p>
        ) : (
          <div className="space-y-3">
            {data?.topProducts.map((p, i) => (
              <div key={p.nameEn} className="flex items-center gap-4">
                <div className="w-6 h-6 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 font-medium text-slate-700">{p.nameEn}</div>
                <div className="text-sm text-slate-500">{p.quantity} sold</div>
                <div className="text-sm font-bold text-slate-800">{p.revenue.toFixed(3)} OMR</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
