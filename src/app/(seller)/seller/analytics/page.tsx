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

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>;

  const th = "px-4 py-3 text-xs font-semibold text-slate-500 uppercase";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800">Analytics</h2>

      {/* Revenue by Month */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h3 className="font-semibold text-slate-700 px-5 py-4 border-b border-slate-100">Revenue by Month</h3>
        {!data || data.revenueByMonth.length === 0 ? (
          <p className="text-slate-400 text-sm px-5 py-6">No data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`text-left ${th}`}>Month</th>
                  <th className={`text-right ${th}`}>Orders</th>
                  <th className={`text-right ${th}`}>Revenue (paid)</th>
                </tr>
              </thead>
              <tbody>
                {data.revenueByMonth.map((row) => (
                  <tr key={row.month} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700">{row.month}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{row.orders}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">{row.revenue.toFixed(3)} OMR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h3 className="font-semibold text-slate-700 px-5 py-4 border-b border-slate-100">Top Products by Revenue</h3>
        {!data || data.topProducts.length === 0 ? (
          <p className="text-slate-400 text-sm px-5 py-6">No data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`text-left w-12 ${th}`}>#</th>
                  <th className={`text-left ${th}`}>Product</th>
                  <th className={`text-right ${th}`}>Sold</th>
                  <th className={`text-right ${th}`}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={p.nameEn} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{p.nameEn}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{p.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">{p.revenue.toFixed(3)} OMR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
