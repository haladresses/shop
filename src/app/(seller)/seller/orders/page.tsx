"use client";
import { useEffect, useState, useCallback } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { formatVariantLabel } from "@/lib/utils";

type ColorPart = { part: string; color: string; colorHex?: string | null };

type Order = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: Array<{
    quantity: number;
    product: { nameEn: string };
    variant?: { color?: string | null; colorParts?: ColorPart[] | null; size?: string | null } | null;
  }>;
};

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", CONFIRMED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-purple-100 text-purple-700", SHIPPED: "bg-sky-100 text-sky-700",
  DELIVERED: "bg-green-100 text-green-700", CANCELLED: "bg-red-100 text-red-700",
};

/** "PARTIALLY_PAID" -> "Partially paid" */
const humanize = (s: string) => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orders?page=${page}`);
    const data = await res.json();
    if (data.success) { setOrders(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Orders</h2>
        <p className="text-sm text-slate-500">{total} order{total === 1 ? "" : "s"} in total</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Order #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Items</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Payment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {o.items.map((i) => {
                        const variant = formatVariantLabel(i.variant || {});
                        return `${i.product.nameEn}${variant ? ` (${variant})` : ""} ×${i.quantity}`;
                      }).join(", ")}
                    </td>
                    <td className="px-4 py-3 font-medium">{Number(o.total).toFixed(3)} OMR</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[o.status] || "bg-slate-100 text-slate-600"}`}>
                        {humanize(o.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${o.paymentStatus === "PAID" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {humanize(o.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">No orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40"><LuChevronLeft size={14} /> Previous</button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40">Next <LuChevronRight size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
