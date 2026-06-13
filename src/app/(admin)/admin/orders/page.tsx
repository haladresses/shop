"use client";
import { useEffect, useState, useCallback } from "react";
import {
  LuSearch, LuChevronLeft, LuChevronRight, LuEye, LuShoppingBag,
  LuClock, LuTruck, LuCircleCheck, LuWallet, LuUser, LuMapPin, LuPhone,
  LuMail, LuPackage, LuTriangleAlert, LuSave, LuReceipt, LuBan,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

type ShippingAddress = {
  nameEn?: string;
  phone?: string;
  city?: string;
  area?: string;
  street?: string;
  buildingNo?: string;
  country?: string;
};

type OrderItem = {
  id?: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  productSnapshot?: { nameEn?: string; nameAr?: string } | null;
  product?: { nameEn?: string; nameAr?: string; images?: { url: string }[] } | null;
  variant?: { color?: string | null; size?: string | null } | null;
};

type Payment = {
  method: string;
  status: string;
  amount?: number;
  transactionId?: string | null;
  createdAt?: string;
};

type Order = {
  id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  discount: number;
  shippingCost: number;
  status: string;
  paymentStatus: string;
  couponCode?: string | null;
  notes?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  createdAt: string;
  shippingAddress?: ShippingAddress | null;
  user?: { nameEn?: string | null; nameAr?: string | null; email?: string; phone?: string | null } | null;
  items: OrderItem[];
  payments: Payment[];
};

type Stats = {
  totalOrders: number;
  pending: number;
  processing: number;
  delivered: number;
  cancelled: number;
  revenue: number;
  today: number;
};

const statusColors: Record<string, string> = {
  PENDING: "badge-pending", CONFIRMED: "badge-confirmed", PROCESSING: "badge-processing",
  SHIPPED: "badge-shipped", DELIVERED: "badge-delivered", CANCELLED: "badge-cancelled", REFUNDED: "badge-refunded",
};
const payColors: Record<string, string> = {
  PAID: "badge-paid", UNPAID: "badge-unpaid", PARTIAL: "badge-partial", FAILED: "badge-failed", REFUNDED: "badge-refunded",
};

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "FAILED", "REFUNDED"];
const FLOW = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
const DESTRUCTIVE = ["CANCELLED", "REFUNDED"];

const omr = (v: number | string) => `${Number(v).toFixed(3)} OMR`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const customerName = (o: Order) =>
  o.user?.nameEn || o.guestName || o.user?.email || o.guestEmail || "Guest";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(payFilter && { paymentStatus: payFilter }),
    });
    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    if (data.success) { setOrders(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, search, statusFilter, payFilter]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/orders/stats");
    const data = await res.json();
    if (data.success) setStats(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const openDetail = async (o: Order) => {
    setSelected(o);
    setNotesDraft(o.notes || "");
    setConfirmStatus(null);
    setDetailLoading(true);
    const res = await fetch(`/api/orders/${o.id}`);
    const data = await res.json();
    if (data.success) {
      setSelected(data.data);
      setNotesDraft(data.data.notes || "");
    }
    setDetailLoading(false);
  };

  const closeDetail = () => {
    setSelected(null);
    setConfirmStatus(null);
  };

  const patchOrder = async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const applyStatus = async (status: string) => {
    if (!selected) return;
    setUpdating(true);
    const data = await patchOrder(selected.id, { status });
    if (data.success) {
      setSelected((prev) => prev ? {
        ...prev,
        status,
        ...(status === "DELIVERED" ? { paymentStatus: "PAID" } : {}),
      } : null);
      load();
      loadStats();
    }
    setUpdating(false);
    setConfirmStatus(null);
  };

  const handleStatusClick = (status: string) => {
    if (DESTRUCTIVE.includes(status)) {
      setConfirmStatus(status);
    } else {
      applyStatus(status);
    }
  };

  const applyPayment = async (paymentStatus: string) => {
    if (!selected) return;
    setUpdating(true);
    const data = await patchOrder(selected.id, { paymentStatus });
    if (data.success) {
      setSelected((prev) => prev ? { ...prev, paymentStatus } : null);
      load();
      loadStats();
    }
    setUpdating(false);
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    const data = await patchOrder(selected.id, { notes: notesDraft });
    if (data.success) {
      setSelected((prev) => prev ? { ...prev, notes: notesDraft } : null);
    }
    setSavingNotes(false);
  };

  const totalPages = Math.ceil(total / 20);

  const statCards = [
    { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: LuShoppingBag, accent: "from-indigo-500 to-violet-500", ring: "ring-indigo-100" },
    { label: "Pending", value: stats?.pending ?? 0, icon: LuClock, accent: "from-amber-400 to-orange-500", ring: "ring-amber-100" },
    { label: "In Progress", value: stats?.processing ?? 0, icon: LuTruck, accent: "from-sky-400 to-blue-500", ring: "ring-sky-100" },
    { label: "Delivered", value: stats?.delivered ?? 0, icon: LuCircleCheck, accent: "from-emerald-400 to-teal-500", ring: "ring-emerald-100" },
    { label: "Revenue", value: stats ? omr(stats.revenue) : "...", icon: LuWallet, accent: "from-fuchsia-500 to-pink-500", ring: "ring-fuchsia-100" },
  ];

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${s.accent} ring-4 ${s.ring} flex items-center justify-center text-white flex-shrink-0`}>
              <s.icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold text-slate-800 leading-tight truncate">{s.value}</p>
              <p className="text-xs sm:text-sm text-slate-500 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <input
            className="admin-input !pl-10"
            placeholder="Search by order # or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="admin-input admin-select w-auto min-w-[150px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="admin-input admin-select w-auto min-w-[150px]" value={payFilter} onChange={(e) => { setPayFilter(e.target.value); setPage(1); }}>
          <option value="">All Payments</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-slate-500 ml-auto">{total} orders</span>
      </div>

      {/* List */}
      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <LuReceipt size={40} className="mb-3 text-slate-300" />
            <p className="text-sm">No orders found</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {orders.map((o) => (
                <button key={o.id} onClick={() => openDetail(o)} className="w-full text-left p-4 flex flex-col gap-2 active:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-indigo-600 text-sm">{o.orderNumber}</span>
                    <span className="font-semibold text-slate-800 text-sm">{omr(o.total)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-600 truncate">{customerName(o)}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(o.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${statusColors[o.status] || "badge-pending"}`}>{o.status}</span>
                    <span className={`badge ${payColors[o.paymentStatus] || "badge-unpaid"}`}>{o.paymentStatus}</span>
                    <span className="text-xs text-slate-400 ml-auto">{o.items.length} items</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th className="text-center">Items</th>
                    <th className="text-right">Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="cursor-pointer" onClick={() => openDetail(o)}>
                      <td className="font-mono font-medium text-indigo-600">{o.orderNumber}</td>
                      <td>
                        <div className="font-medium text-slate-800 truncate max-w-[180px]">{customerName(o)}</div>
                        {o.user?.email && <div className="text-xs text-slate-400 truncate max-w-[180px]">{o.user.email}</div>}
                      </td>
                      <td className="text-center text-slate-500">{o.items.length}</td>
                      <td className="text-right font-medium">{omr(o.total)}</td>
                      <td><span className={`badge ${statusColors[o.status] || "badge-pending"}`}>{o.status}</span></td>
                      <td><span className={`badge ${payColors[o.paymentStatus] || "badge-unpaid"}`}>{o.paymentStatus}</span></td>
                      <td className="text-slate-500 text-sm whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                      <td>
                        <div className="flex justify-end">
                          <button onClick={(e) => { e.stopPropagation(); openDetail(o); }} className="admin-btn admin-btn-secondary text-xs py-1"><LuEye size={14} /> View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Total: {total}</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40"><LuChevronLeft size={14} /> Prev</button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next <LuChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Order detail modal */}
      <AdminModal
        open={!!selected}
        onClose={closeDetail}
        className="!max-w-3xl"
        title={
          selected ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono">{selected.orderNumber}</span>
                <span className={`badge ${statusColors[selected.status] || "badge-pending"}`}>{selected.status}</span>
                <span className={`badge ${payColors[selected.paymentStatus] || "badge-unpaid"}`}>{selected.paymentStatus}</span>
              </div>
              <span className="text-xs font-normal text-slate-500">{fmtDate(selected.createdAt)}</span>
            </div>
          ) : null
        }
        footer={
          <button onClick={closeDetail} className="admin-btn admin-btn-secondary">Close</button>
        }
      >
        {selected && (
          <div>
            {detailLoading && (
              <div className="flex justify-center py-6"><div className="spinner" /></div>
            )}

            {/* Status progress (hidden for cancelled/refunded) */}
            {!DESTRUCTIVE.includes(selected.status) && (
              <div className="flex items-center mb-6">
                {FLOW.map((step, i) => {
                  const reached = FLOW.indexOf(selected.status) >= i;
                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${reached ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                          {reached ? <LuCircleCheck size={15} /> : i + 1}
                        </div>
                        <span className={`text-[10px] mt-1 ${reached ? "text-indigo-600 font-medium" : "text-slate-400"}`}>{step}</span>
                      </div>
                      {i < FLOW.length - 1 && (
                        <div className={`h-0.5 flex-1 mx-1 -mt-4 ${FLOW.indexOf(selected.status) > i ? "bg-indigo-600" : "bg-slate-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Customer + Shipping */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5"><LuUser size={13} /> Customer</p>
                <p className="font-medium text-slate-800">{customerName(selected)}</p>
                {(selected.user?.email || selected.guestEmail) && (
                  <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-1"><LuMail size={13} className="text-slate-400" />{selected.user?.email || selected.guestEmail}</p>
                )}
                {(selected.user?.phone || selected.shippingAddress?.phone) && (
                  <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5"><LuPhone size={13} className="text-slate-400" />{selected.user?.phone || selected.shippingAddress?.phone}</p>
                )}
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5"><LuMapPin size={13} /> Shipping Address</p>
                {selected.shippingAddress ? (
                  <div className="text-sm text-slate-600 space-y-0.5">
                    {selected.shippingAddress.nameEn && <p className="font-medium text-slate-800">{selected.shippingAddress.nameEn}</p>}
                    <p>{[selected.shippingAddress.buildingNo, selected.shippingAddress.street, selected.shippingAddress.area].filter(Boolean).join(", ")}</p>
                    <p>{[selected.shippingAddress.city, selected.shippingAddress.country].filter(Boolean).join(", ")}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No address provided</p>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><LuPackage size={14} /> Items ({selected.items.length})</p>
              <div className="space-y-2">
                {selected.items.map((item, i) => {
                  const name = item.product?.nameEn || item.productSnapshot?.nameEn || "Product";
                  const img = item.product?.images?.[0]?.url;
                  return (
                    <div key={item.id || i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                      <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <LuPackage size={18} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                        <p className="text-xs text-slate-400">
                          {omr(item.unitPrice)} &times; {item.quantity}
                          {(item.variant?.color || item.variant?.size) && (
                            <span className="ml-1">{[item.variant?.color, item.variant?.size].filter(Boolean).join(" / ")}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-slate-700 flex-shrink-0">{omr(item.total ?? item.unitPrice * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t border-slate-200 mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{omr(selected.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Shipping</span><span>{Number(selected.shippingCost) === 0 ? "Free" : omr(selected.shippingCost)}</span></div>
                {Number(selected.discount) > 0 && (
                  <div className="flex justify-between text-emerald-600"><span>Discount {selected.couponCode && `(${selected.couponCode})`}</span><span>- {omr(selected.discount)}</span></div>
                )}
                <div className="flex justify-between font-semibold text-base text-slate-800 pt-1"><span>Total</span><span>{omr(selected.total)}</span></div>
              </div>
            </div>

            {/* Payment details */}
            {selected.payments?.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5"><LuWallet size={13} /> Payment</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{selected.payments[0].method.replace(/_/g, " ")}</span>
                  <span className={`badge ${payColors[selected.payments[0].status] || "badge-unpaid"}`}>{selected.payments[0].status}</span>
                </div>
                {selected.payments[0].transactionId && (
                  <p className="text-xs text-slate-400 mt-1 font-mono">TXN: {selected.payments[0].transactionId}</p>
                )}
              </div>
            )}

            {/* Update order status */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-slate-700 mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={updating || selected.status === s}
                    onClick={() => handleStatusClick(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      selected.status === s
                        ? "bg-indigo-600 text-white"
                        : DESTRUCTIVE.includes(s)
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Update payment status */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-slate-700 mb-2">Payment Status</p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={updating || selected.paymentStatus === s}
                    onClick={() => applyPayment(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      selected.paymentStatus === s ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Internal Notes</p>
              <textarea
                className="admin-input min-h-[72px] resize-y"
                placeholder="Add a note about this order..."
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={saveNotes}
                  disabled={savingNotes || notesDraft === (selected.notes || "")}
                  className="admin-btn admin-btn-primary text-xs disabled:opacity-40"
                >
                  {savingNotes ? <span className="spinner !w-4 !h-4 !border-2" /> : <LuSave size={14} />} Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Destructive status confirmation */}
      <AdminModal
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        className="!max-w-md"
        title={confirmStatus === "REFUNDED" ? "Refund this order?" : "Cancel this order?"}
        footer={
          <>
            <button onClick={() => setConfirmStatus(null)} className="admin-btn admin-btn-secondary">Keep Order</button>
            <button
              onClick={() => confirmStatus && applyStatus(confirmStatus)}
              disabled={updating}
              className="admin-btn admin-btn-danger disabled:opacity-40"
            >
              {updating ? <span className="spinner !w-4 !h-4 !border-2" /> : <LuBan size={15} />} Confirm {confirmStatus}
            </button>
          </>
        }
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            {confirmStatus === "REFUNDED" ? <LuBan size={24} className="text-red-600" /> : <LuTriangleAlert size={24} className="text-red-600" />}
          </div>
          <p className="text-sm text-slate-500">
            Order <span className="font-mono font-medium">{selected?.orderNumber}</span> will be marked as{" "}
            <span className="font-medium">{confirmStatus}</span>. This notifies the customer.
          </p>
        </div>
      </AdminModal>
    </div>
  );
}
