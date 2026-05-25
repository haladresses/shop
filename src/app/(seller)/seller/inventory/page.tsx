"use client";
import { useEffect, useState, useCallback } from "react";

export default function SellerInventoryPage() {
  const [items, setItems] = useState<Array<{
    id: string; quantity: number; reservedQuantity: number; lowStockAlert: number; updatedAt: string;
    variant: { color?: string; size?: string; sku?: string; product: { nameEn: string } };
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ ...(lowStockOnly && { lowStock: "true" }) });
    const res = await fetch(`/api/inventory?${params}`);
    const data = await res.json();
    if (data.success) setItems(data.data);
    setLoading(false);
  }, [lowStockOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Inventory</h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} className="rounded" />
          Show low stock only
        </label>
      </div>

      {/* Low stock alert */}
      {items.filter((i) => (i.quantity - i.reservedQuantity) <= i.lowStockAlert).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-800">Low Stock Alert</p>
            <p className="text-sm text-amber-600">
              {items.filter((i) => (i.quantity - i.reservedQuantity) <= i.lowStockAlert).length} variants are running low on stock
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Variant</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">In Stock</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Reserved</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Available</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const available = item.quantity - item.reservedQuantity;
                  const isLow = available <= item.lowStockAlert;
                  return (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.variant.product.nameEn}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {[item.variant.color, item.variant.size].filter(Boolean).join(" / ") || "Default"}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{item.reservedQuantity}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${isLow ? "text-red-600" : "text-green-600"}`}>{available}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${isLow ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {isLow ? "Low Stock" : "OK"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">No inventory data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
