"use client";
import { useEffect, useState, useCallback } from "react";
import { LuUndo2 } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  transactionId?: string;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    user?: { nameEn?: string; email: string } | null;
  };
};

const statusColors: Record<string, string> = {
  PAID: "badge-paid", UNPAID: "badge-unpaid", PARTIAL: "badge-partial",
  REFUNDED: "badge-refunded", FAILED: "badge-failed",
};

const methodLabels: Record<string, string> = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Credit Card",
  THAWANI: "Thawani",
  STRIPE: "Stripe",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, pendingAmount: 0, paidCount: 0 });
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Get orders with payments
    const res = await fetch("/api/orders?pageSize=50");
    const data = await res.json();
    if (data.success) {
      const allPayments: Payment[] = [];
      data.data.forEach((order: {
        id: string;
        payments: Payment[];
        orderNumber: string;
        user?: { nameEn?: string; email: string } | null;
      }) => {
        order.payments.forEach((p: Payment) => {
          allPayments.push({ ...p, order: { id: order.id, orderNumber: order.orderNumber, user: order.user } });
        });
      });
      setPayments(allPayments);
      setTotal(allPayments.length);

      const paid = allPayments.filter((p) => p.status === "PAID");
      const unpaid = allPayments.filter((p) => p.status === "UNPAID");
      setStats({
        totalRevenue: paid.reduce((s, p) => s + Number(p.amount), 0),
        pendingAmount: unpaid.reduce((s, p) => s + Number(p.amount), 0),
        paidCount: paid.length,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    setRefundError("");
    const res = await fetch(`/api/orders/${refundTarget.order.id}/thawani-refund`, { method: "POST" });
    const data = await res.json();
    if (!data.success) {
      setRefundError(data.error || "Could not process the refund.");
    } else {
      setRefundTarget(null);
      load();
    }
    setRefunding(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalRevenue.toFixed(3)} OMR</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Pending Payments</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingAmount.toFixed(3)} OMR</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Paid Orders</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.paidCount}</p>
        </div>
      </div>

      <div className="admin-card">
        {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Transaction ID</th>
                  <th>Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono font-medium text-indigo-600">{p.order.orderNumber}</td>
                    <td>{p.order.user?.nameEn || p.order.user?.email || "Guest"}</td>
                    <td className="font-medium">{Number(p.amount).toFixed(3)} OMR</td>
                    <td className="text-slate-600">{methodLabels[p.method] || p.method}</td>
                    <td><span className={`badge ${statusColors[p.status] || "badge-unpaid"}`}>{p.status}</span></td>
                    <td className="font-mono text-xs text-slate-400">{p.transactionId || "—"}</td>
                    <td className="text-slate-500 text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td>
                      {p.method === "THAWANI" && p.status === "PAID" && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => { setRefundError(""); setRefundTarget(p); }}
                            className="admin-btn admin-btn-secondary text-xs py-1 text-red-600 hover:bg-red-50"
                          >
                            <LuUndo2 size={13} /> Refund
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">No payments yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          Total: {total} payments
        </div>
      </div>

      <AdminModal
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        className="!max-w-md"
        title="Refund this payment?"
        footer={
          <>
            <button onClick={() => setRefundTarget(null)} className="admin-btn admin-btn-secondary">Cancel</button>
            <button onClick={confirmRefund} disabled={refunding} className="admin-btn admin-btn-danger disabled:opacity-40">
              {refunding ? <span className="spinner !w-4 !h-4 !border-2" /> : <LuUndo2 size={15} />} Confirm Refund
            </button>
          </>
        }
      >
        <div className="text-center">
          {refundError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4 text-left">{refundError}</p>
          )}
          <p className="text-sm text-slate-500">
            Order <span className="font-mono font-medium">{refundTarget?.order.orderNumber}</span> — refunding{" "}
            <span className="font-medium">{refundTarget ? Number(refundTarget.amount).toFixed(3) : ""} OMR</span> via
            Thawani. This cannot be undone.
          </p>
        </div>
      </AdminModal>
    </div>
  );
}
