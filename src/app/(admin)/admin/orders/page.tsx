"use client";
import { useEffect, useState, useCallback } from "react";
import { LuX, LuChevronLeft, LuChevronRight } from "react-icons/lu";

type Order = {
  id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  discount: number;
  shippingCost: number;
  status: string;
  paymentStatus: string;
  couponCode?: string;
  createdAt: string;
  user?: { nameEn?: string; email: string } | null;
  items: Array<{ quantity: number; unitPrice: number; product: { nameEn: string } }>;
  payments: Array<{ method: string; status: string }>;
};

const statusColors: Record<string, string> = {
  PENDING: "badge-pending", CONFIRMED: "badge-confirmed", PROCESSING: "badge-processing",
  SHIPPED: "badge-shipped", DELIVERED: "badge-delivered", CANCELLED: "badge-cancelled", REFUNDED: "badge-refunded",
};
const payColors: Record<string, string> = {
  PAID: "badge-paid", UNPAID: "badge-unpaid", PARTIAL: "badge-partial", FAILED: "badge-failed",
};
const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search, ...(statusFilter && { status: statusFilter }) });
    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    if (data.success) { setOrders(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) {
      setSelected((prev) => prev ? { ...prev, status } : null);
      load();
    }
    setUpdating(false);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="admin-input w-64" placeholder="Search by order # or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="admin-input admin-select w-44" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-sm text-slate-500 ml-auto">{total} orders</span>
      </div>

      <div className="admin-card">
        {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono font-medium text-indigo-600">{o.orderNumber}</td>
                    <td>{o.user?.nameEn || o.user?.email || "Guest"}</td>
                    <td className="text-center">{o.items.length}</td>
                    <td className="font-medium">{Number(o.total).toFixed(3)} OMR</td>
                    <td><span className={`badge ${statusColors[o.status] || "badge-pending"}`}>{o.status}</span></td>
                    <td>
                      <span className={`badge ${payColors[o.paymentStatus] || "badge-unpaid"}`}>{o.paymentStatus}</span>
                    </td>
                    <td className="text-slate-500 text-sm">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => setSelected(o)} className="admin-btn admin-btn-secondary text-xs py-1">View</button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">No orders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Total: {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40"><LuChevronLeft size={14} /> Prev</button>
              <span className="text-sm self-center">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next <LuChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold">Order {selected.orderNumber}</h3>
                <p className="text-sm text-slate-500">{new Date(selected.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"><LuX size={18} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Customer</p>
                <p className="font-medium">{selected.user?.nameEn || "Guest"}</p>
                <p className="text-sm text-slate-600">{selected.user?.email}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Payment</p>
                <span className={`badge ${payColors[selected.paymentStatus]}`}>{selected.paymentStatus}</span>
                {selected.payments[0] && (
                  <p className="text-sm text-slate-600 mt-1">{selected.payments[0].method.replace("_", " ")}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-slate-700 mb-2">Order Items</p>
              <div className="space-y-2">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm bg-slate-50 rounded px-3 py-2">
                    <span>{item.product.nameEn} × {item.quantity}</span>
                    <span className="font-medium">{(item.unitPrice * item.quantity).toFixed(3)} OMR</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{Number(selected.subtotal).toFixed(3)} OMR</span></div>
                <div className="flex justify-between text-slate-600"><span>Shipping</span><span>{Number(selected.shippingCost).toFixed(3)} OMR</span></div>
                {selected.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount {selected.couponCode && `(${selected.couponCode})`}</span><span>-{Number(selected.discount).toFixed(3)} OMR</span></div>}
                <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{Number(selected.total).toFixed(3)} OMR</span></div>
              </div>
            </div>

            {/* Update Status */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={updating || selected.status === s}
                    onClick={() => updateStatus(selected.id, s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                      selected.status === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
