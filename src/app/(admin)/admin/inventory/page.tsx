"use client";
import { useEffect, useState, useCallback } from "react";

type InventoryItem = {
  id: string;
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockAlert: number;
  location?: string;
  updatedAt: string;
  variant: {
    color?: string;
    size?: string;
    sku?: string;
    product: { nameEn: string; nameAr: string; sku?: string };
  };
};

const TX_TYPES = ["PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "DAMAGE", "TRANSFER"];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lowStock, setLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ type: "ADJUSTMENT", quantity: 0, note: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(lowStock && { lowStock: "true" }) });
    const res = await fetch(`/api/inventory?${params}`);
    const data = await res.json();
    if (data.success) { setItems(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, lowStock]);

  useEffect(() => { load(); }, [load]);

  const applyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjusting) return;
    setSaving(true);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: adjusting.variantId, ...form }),
    });
    const data = await res.json();
    if (data.success) { setAdjusting(null); load(); }
    setSaving(false);
  };

  const totalPages = Math.ceil(total / 20);
  const available = (item: InventoryItem) => item.quantity - item.reservedQuantity;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} className="rounded" />
          Show low stock only
        </label>
        <span className="text-sm text-slate-500 ml-auto">{total} items</span>
      </div>

      <div className="admin-card">
        {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>In Stock</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Alert</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const avail = available(item);
                  const isLow = avail <= item.lowStockAlert;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.variant.product.nameEn}</div>
                        <div className="text-xs text-slate-400" dir="rtl">{item.variant.product.nameAr}</div>
                      </td>
                      <td className="text-slate-600">
                        {[item.variant.color, item.variant.size].filter(Boolean).join(" / ") || "Default"}
                      </td>
                      <td className="font-mono text-xs text-slate-500">{item.variant.sku || item.variant.product.sku || "—"}</td>
                      <td className="text-center font-medium">{item.quantity}</td>
                      <td className="text-center text-slate-500">{item.reservedQuantity}</td>
                      <td className="text-center">
                        <span className={`font-bold ${isLow ? "text-red-600" : "text-green-600"}`}>{avail}</span>
                      </td>
                      <td className="text-center text-slate-500">{item.lowStockAlert}</td>
                      <td className="text-slate-400 text-sm">{new Date(item.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <button onClick={() => { setAdjusting(item); setForm({ type: "ADJUSTMENT", quantity: 0, note: "" }); }} className="admin-btn admin-btn-secondary text-xs py-1">
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400">No inventory data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Total: {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">← Prev</button>
              <span className="text-sm self-center">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {adjusting && (
        <div className="admin-modal-overlay" onClick={() => setAdjusting(null)}>
          <div className="admin-modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Adjust Inventory</h3>
              <button onClick={() => setAdjusting(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="font-medium">{adjusting.variant.product.nameEn}</p>
              <p className="text-sm text-slate-500">
                {[adjusting.variant.color, adjusting.variant.size].filter(Boolean).join(" / ") || "Default variant"}
              </p>
              <p className="text-sm mt-1">Current stock: <span className="font-semibold">{adjusting.quantity}</span></p>
            </div>
            <form onSubmit={applyAdjustment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Type</label>
                <select className="admin-input admin-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TX_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input type="number" className="admin-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) })} required />
                <p className="text-xs text-slate-400 mt-1">Positive = add stock, negative = reduce</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                <input className="admin-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional reason..." />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="admin-btn admin-btn-primary flex-1 justify-center">
                  {saving ? "Saving..." : "Apply Adjustment"}
                </button>
                <button type="button" onClick={() => setAdjusting(null)} className="admin-btn admin-btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
