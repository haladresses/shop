"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuArrowDownLeft,
  LuArrowUpRight,
  LuBoxes,
  LuCircleAlert,
  LuDownload,
  LuHistory,
  LuPackageCheck,
  LuPackageX,
  LuPencil,
  LuScanBarcode,
  LuSearch,
  LuTrash2,
  LuTruck,
  LuWallet,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";

type InventoryItem = {
  id: string;
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockAlert: number;
  location?: string | null;
  updatedAt: string;
  variant: {
    color?: string | null;
    size?: string | null;
    sku?: string | null;
    barcode?: string | null;
    priceAdjustment: string | number;
    product: {
      id: string;
      nameEn: string;
      nameAr: string;
      sku?: string | null;
      basePrice: string | number;
      salePrice: string | number | null;
      costPrice: string | number | null;
      category: { nameEn: string };
      images: { url: string }[];
    };
  };
};

type Summary = {
  skus: number;
  units: number;
  reserved: number;
  costValue: number;
  retailValue: number;
  potentialProfit: number;
  lowStock: number;
  outOfStock: number;
  missingCost: number;
  last30Days: Record<string, { units: number; count: number }>;
};

type Tx = {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number | null;
  unitCost: number | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string;
  productId: string;
  productName: string;
  variant: string;
  sku: string | null;
};

type Category = { id: string; nameEn: string };

const TX_TYPES = ["PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "DAMAGE", "TRANSFER"];
const TX_LABEL: Record<string, string> = {
  PURCHASE: "Stock in (purchase)",
  SALE: "Sale",
  RETURN: "Customer return",
  ADJUSTMENT: "Stock count correction",
  DAMAGE: "Damaged / lost",
  TRANSFER: "Transfer out",
};
const INBOUND = ["PURCHASE", "RETURN"];
const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const variantLabel = (v: InventoryItem["variant"]) => [v.color, v.size].filter(Boolean).join(" / ") || "Default";
const unitPrice = (v: InventoryItem["variant"]) => Number(v.product.salePrice ?? v.product.basePrice) + Number(v.priceAdjustment);
const signedQty = (t: Tx) => (t.type === "ADJUSTMENT" ? t.quantity : INBOUND.includes(t.type) ? Math.abs(t.quantity) : -Math.abs(t.quantity));

export default function InventoryPage() {
  const [tab, setTab] = useState<"stock" | "movements" | "receive">("stock");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [historyFor, setHistoryFor] = useState<InventoryItem | null>(null);

  const loadSummary = useCallback(() => {
    fetch("/api/inventory/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setSummary(d.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSummary();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCanManage(!!d.data?.permissions?.includes("admin.inventory.manage")))
      .catch(() => {});
    fetch("/api/categories?all=true")
      .then((r) => r.json())
      .then((d) => d.success && setCategories(d.data))
      .catch(() => {});
  }, [loadSummary]);

  const tabs: [typeof tab, string, React.ElementType][] = [
    ["stock", "Stock levels", LuBoxes],
    ["movements", "Movements", LuHistory],
    ...(canManage ? ([["receive", "Receive goods", LuTruck]] as [typeof tab, string, React.ElementType][]) : []),
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={LuBoxes} label="Units in stock" value={summary ? summary.units.toLocaleString() : "—"} sub={summary ? `${summary.skus.toLocaleString()} SKUs` : ""} />
        <Kpi icon={LuWallet} label="Stock value (cost)" value={summary ? num(summary.costValue) : "—"} sub={summary ? `Retail ${num(summary.retailValue)}` : ""} />
        <Kpi icon={LuCircleAlert} label="Low stock" value={summary ? String(summary.lowStock) : "—"} tone="warn" sub="At or below alert level" />
        <Kpi icon={LuPackageX} label="Out of stock" value={summary ? String(summary.outOfStock) : "—"} tone="bad" sub={summary?.missingCost ? `${summary.missingCost} without purchase price` : "Need restocking"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "stock" && <StockTab categories={categories} canManage={canManage} onChanged={loadSummary} onHistory={setHistoryFor} />}
      {tab === "movements" && <MovementsTab />}
      {tab === "receive" && canManage && <ReceiveTab onDone={() => { loadSummary(); setTab("movements"); }} />}

      <AdminModal
        open={!!historyFor}
        onClose={() => setHistoryFor(null)}
        title={historyFor ? `History · ${historyFor.variant.product.nameEn} (${variantLabel(historyFor.variant)})` : ""}
        className="!max-w-3xl"
      >
        {historyFor && <MovementsTab inventoryId={historyFor.id} compact />}
      </AdminModal>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: "warn" | "bad" }) {
  const color = tone === "warn" ? "bg-amber-50 text-amber-600" : tone === "bad" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600";
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3 min-w-0">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon size={20} /></span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 tabular-nums truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ───────── Stock ─────────

function StockTab({
  categories,
  canManage,
  onChanged,
  onHistory,
}: {
  categories: Category[];
  canManage: boolean;
  onChanged: () => void;
  onHistory: (i: InventoryItem) => void;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("updated");
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const filterParams = useCallback(() => {
    const params = new URLSearchParams({ status });
    if (search.trim()) params.set("search", search.trim());
    if (categoryId) params.set("categoryId", categoryId);
    return params;
  }, [search, status, categoryId]);

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      const id = ++reqId.current;
      setLoading(true);
      const params = filterParams();
      params.set("page", String(p));
      params.set("pageSize", "30");
      params.set("sort", sort);
      const d = await fetch(`/api/inventory?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (id !== reqId.current) return;
      if (d?.success) {
        setItems((prev) => (replace ? d.data : [...prev, ...d.data]));
        setTotal(d.meta.total);
        setHasMore(p < d.meta.totalPages);
        setPage(p);
      }
      setLoading(false);
    },
    [filterParams, sort],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchPage(1, true), 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  // Infinite scroll — the next page loads as the end of the list nears.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting && hasMore && !loading) fetchPage(page + 1, false);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  const refresh = () => {
    fetchPage(1, true);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, barcode, color or location" className="admin-input !py-2 !pl-9 text-sm" />
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs shrink-0 overflow-x-auto">
          {[["all", "All"], ["in", "In stock"], ["low", "Low"], ["out", "Out"]].map(([v, l]) => (
            <button key={v} onClick={() => setStatus(v)} className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${status === v ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="admin-input admin-select !py-2 text-sm lg:!w-48">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="admin-input admin-select !py-2 text-sm lg:!w-44">
          <option value="updated">Recently changed</option>
          <option value="qty-asc">Lowest stock first</option>
          <option value="qty-desc">Highest stock first</option>
          <option value="name">Name A–Z</option>
        </select>
        <a href={`/api/inventory/export?${filterParams()}`} className="admin-btn admin-btn-secondary !py-2 text-sm shrink-0"><LuDownload size={15} /> CSV</a>
      </div>

      <p className="text-xs text-slate-500 px-1">{total.toLocaleString()} item{total === 1 ? "" : "s"}</p>

      <div className="admin-card">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU / Barcode</th>
                <th>Location</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Alert</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">Value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qty = item.quantity;
                const state = qty <= 0 ? "out" : qty <= item.lowStockAlert ? "low" : "ok";
                const cost = item.variant.product.costPrice == null ? null : Number(item.variant.product.costPrice);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-10 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                          {item.variant.product.images[0] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.variant.product.images[0].url} alt="" loading="lazy" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <a href={`/admin/products/${item.variant.product.id}`} className="font-medium text-slate-800 hover:text-indigo-600 truncate block max-w-[260px]">{item.variant.product.nameEn}</a>
                          <p className="text-xs text-slate-500">{variantLabel(item.variant)} · {item.variant.product.category.nameEn}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-500">
                      {item.variant.sku || item.variant.product.sku || "—"}
                      {item.variant.barcode && <div className="text-slate-400">{item.variant.barcode}</div>}
                    </td>
                    <td className="text-sm text-slate-600">{item.location || <span className="text-slate-300">—</span>}</td>
                    <td className="text-right">
                      <span
                        className={`inline-flex items-center justify-center min-w-[44px] px-2 py-0.5 rounded-full text-sm font-bold tabular-nums ${
                          state === "out" ? "bg-rose-50 text-rose-600" : state === "low" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {qty}
                      </span>
                      {item.reservedQuantity > 0 && <p className="text-[11px] text-slate-400 mt-0.5">{item.reservedQuantity} reserved</p>}
                    </td>
                    <td className="text-right text-slate-500 tabular-nums">{item.lowStockAlert}</td>
                    <td className="text-right tabular-nums">{cost == null ? <span className="text-amber-600 text-xs">not set</span> : num(cost)}</td>
                    <td className="text-right tabular-nums text-slate-700">
                      {cost == null ? "—" : num(Math.max(0, qty) * cost)}
                      <p className="text-[11px] text-slate-400">retail {num(Math.max(0, qty) * unitPrice(item.variant))}</p>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {canManage && (
                        <>
                          <button onClick={() => setAdjusting(item)} className="admin-btn admin-btn-secondary text-xs !py-1">Adjust</button>
                          <button onClick={() => setEditing(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 ml-1" title="Alert level & location"><LuPencil size={15} /></button>
                        </>
                      )}
                      <button onClick={() => onHistory(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100" title="Movement history"><LuHistory size={15} /></button>
                    </td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">No stock records match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div ref={sentinel} className="flex justify-center py-4">
          {loading ? <div className="spinner" /> : !hasMore && items.length > 0 ? <span className="text-xs text-slate-400">All {total.toLocaleString()} items loaded</span> : null}
        </div>
      </div>

      {adjusting && <AdjustModal item={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); refresh(); }} />}
      {editing && <EditModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function AdjustModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("PURCHASE");
  const [quantity, setQuantity] = useState("");
  const [countedTo, setCountedTo] = useState("");
  const [unitCost, setUnitCost] = useState(item.variant.product.costPrice == null ? "" : String(item.variant.product.costPrice));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // For a stock count the user types the counted quantity; we send the difference.
  const qty = type === "ADJUSTMENT" ? (countedTo === "" ? 0 : (parseInt(countedTo) || 0) - item.quantity) : parseInt(quantity) || 0;
  const delta = type === "ADJUSTMENT" ? qty : INBOUND.includes(type) ? Math.abs(qty) : -Math.abs(qty);
  const after = item.quantity + delta;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty === 0) return setErr(type === "ADJUSTMENT" ? "The counted quantity matches the system — nothing to correct." : "Enter a quantity.");
    setSaving(true);
    setErr("");
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId: item.variantId,
        type,
        quantity: qty,
        note: note || undefined,
        reference: reference || undefined,
        unitCost: type === "PURCHASE" && unitCost !== "" ? parseFloat(unitCost) : undefined,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!d.success) return setErr(d.error || "Could not save.");
    onSaved();
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      className="!max-w-md"
      title="Stock movement"
      footer={
        <>
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button type="submit" form="adjust-form" disabled={saving} className="admin-btn admin-btn-primary">{saving ? "Saving..." : "Save movement"}</button>
        </>
      }
    >
      <div className="bg-slate-50 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{item.variant.product.nameEn}</p>
          <p className="text-sm text-slate-500">{variantLabel(item.variant)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">On hand</p>
          <p className="text-xl font-bold tabular-nums">{item.quantity}</p>
        </div>
      </div>
      <form id="adjust-form" onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Movement type</label>
          <select className="admin-input admin-select" value={type} onChange={(e) => setType(e.target.value)}>
            {TX_TYPES.filter((t) => t !== "SALE").map((t) => <option key={t} value={t}>{TX_LABEL[t]}</option>)}
          </select>
        </div>
        {type === "ADJUSTMENT" ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Counted quantity on the shelf</label>
            <input type="number" min="0" className="admin-input" value={countedTo} onChange={(e) => setCountedTo(e.target.value)} required autoFocus />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input type="number" min="1" className="admin-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
            </div>
            {type === "PURCHASE" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit cost (OMR)</label>
                <input type="number" min="0" step="0.001" className="admin-input" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </div>
            )}
          </div>
        )}
        {qty !== 0 && (
          <p className={`text-sm rounded-lg px-3 py-2 ${after < 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"}`}>
            {item.quantity} → <strong>{after}</strong> ({delta > 0 ? "+" : ""}{delta}){after < 0 && " — not enough stock"}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
            <input className="admin-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice / PO #" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
            <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" />
          </div>
        </div>
        {type === "PURCHASE" && <p className="text-xs text-slate-400">The product&apos;s purchase price is updated to the weighted average of current stock and this delivery.</p>}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </form>
    </AdminModal>
  );
}

function EditModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [alert, setAlert] = useState(String(item.lowStockAlert));
  const [location, setLocation] = useState(item.location || "");
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lowStockAlert: parseInt(alert) || 0, location }),
    });
    setSaving(false);
    onSaved();
  };
  return (
    <AdminModal
      open
      onClose={onClose}
      className="!max-w-sm"
      title="Alert level & location"
      footer={
        <>
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button type="submit" form="inv-edit-form" disabled={saving} className="admin-btn admin-btn-primary">{saving ? "Saving..." : "Save"}</button>
        </>
      }
    >
      <form id="inv-edit-form" onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">{item.variant.product.nameEn} · {variantLabel(item.variant)}</p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Low-stock alert at</label>
          <input type="number" min="0" className="admin-input" value={alert} onChange={(e) => setAlert(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location (shelf / bin)</label>
          <input className="admin-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. A-03" />
        </div>
      </form>
    </AdminModal>
  );
}

// ───────── Movements ledger ─────────

function MovementsTab({ inventoryId, compact }: { inventoryId?: string; compact?: boolean }) {
  const [rows, setRows] = useState<Tx[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", search: "", from: "", to: "" });
  const reqId = useRef(0);

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      const id = ++reqId.current;
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), pageSize: "40" });
      if (inventoryId) params.set("inventoryId", inventoryId);
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
      const d = await fetch(`/api/inventory/transactions?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (id !== reqId.current) return;
      if (d?.success) {
        setRows((prev) => (replace ? d.data.items : [...prev, ...d.data.items]));
        setHasMore(p < d.data.meta.totalPages);
        setPage(p);
      }
      setLoading(false);
    },
    [inventoryId, filters],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchPage(1, true), 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
          <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Product, SKU, reference or note" className="admin-input !py-2 text-sm md:max-w-xs" />
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="admin-input admin-select !py-2 text-sm md:!w-52">
            <option value="">All movement types</option>
            {TX_TYPES.map((t) => <option key={t} value={t}>{TX_LABEL[t]}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="admin-input !py-2 text-sm !w-auto min-w-0" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="admin-input !py-2 text-sm !w-auto min-w-0" />
          </div>
        </div>
      )}
      <div className={compact ? "" : "admin-card"}>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                {!compact && <th>Product</th>}
                <th>Type</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Balance</th>
                <th>Reference / note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const q = signedQty(t);
                return (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-sm">{new Date(t.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                    {!compact && (
                      <td className="max-w-[240px]">
                        <p className="font-medium text-slate-800 truncate">{t.productName}</p>
                        <p className="text-xs text-slate-400">{t.variant || "Default"}{t.sku ? ` · ${t.sku}` : ""}</p>
                      </td>
                    )}
                    <td>
                      <span className="inline-flex items-center gap-1 text-sm whitespace-nowrap">
                        {q >= 0 ? <LuArrowDownLeft size={14} className="text-emerald-600" /> : <LuArrowUpRight size={14} className="text-rose-500" />}
                        {TX_LABEL[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className={`text-right tabular-nums font-semibold ${q >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{q > 0 ? `+${q}` : q}</td>
                    <td className="text-right tabular-nums text-slate-500">{t.balanceAfter ?? "—"}</td>
                    <td className="text-sm text-slate-600 max-w-[260px]">
                      {t.reference && <span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5 mr-1">{t.reference}</span>}
                      <span>{t.note}</span>
                      {t.unitCost != null && <span className="text-xs text-slate-400"> · @ {num(t.unitCost)}</span>}
                    </td>
                    <td className="text-sm text-slate-500 whitespace-nowrap">{t.createdBy || "—"}</td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No movements yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center py-3">
          {loading ? <div className="spinner" /> : hasMore ? (
            <button onClick={() => fetchPage(page + 1, false)} className="admin-btn admin-btn-secondary text-xs">Load more</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ───────── Goods receipt ─────────

type ReceiveLine = { variantId: string; name: string; variant: string; onHand: number; quantity: string; unitCost: string };

function ReceiveTab({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/inventory?search=${encodeURIComponent(q.trim())}&pageSize=12&sort=name`)
        .then((r) => r.json())
        .then((d) => d.success && setResults(d.data))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const add = (i: InventoryItem) => {
    setLines((prev) => {
      const ex = prev.find((l) => l.variantId === i.variantId);
      if (ex) return prev.map((l) => (l.variantId === i.variantId ? { ...l, quantity: String((parseInt(l.quantity) || 0) + 1) } : l));
      return [
        ...prev,
        {
          variantId: i.variantId,
          name: i.variant.product.nameEn,
          variant: variantLabel(i.variant),
          onHand: i.quantity,
          quantity: "1",
          unitCost: i.variant.product.costPrice == null ? "" : String(i.variant.product.costPrice),
        },
      ];
    });
    setQ("");
    setResults([]);
    inputRef.current?.focus();
  };

  // A scanner sends the barcode + Enter: add the exact match straight away.
  const onEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const exact = results.find((r) => r.variant.barcode === q.trim() || r.variant.sku === q.trim());
    if (exact) add(exact);
    else if (results.length === 1) add(results[0]);
  };

  const units = lines.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);
  const value = lines.reduce((s, l) => s + (parseInt(l.quantity) || 0) * (parseFloat(l.unitCost) || 0), 0);

  const submit = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/inventory/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier: supplier || undefined,
        reference: reference || undefined,
        lines: lines
          .filter((l) => parseInt(l.quantity) > 0)
          .map((l) => ({ variantId: l.variantId, quantity: parseInt(l.quantity), unitCost: l.unitCost === "" ? null : parseFloat(l.unitCost) })),
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!d.success) return setMsg(d.error || "Could not receive the goods.");
    setLines([]);
    setSupplier("");
    setReference("");
    onDone();
  };

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-3 min-w-0">
        <form onSubmit={onEnter} className="relative">
          <LuScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input ref={inputRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scan a barcode or search a product to add it" className="admin-input !py-3 !pl-10" />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg ring-1 ring-slate-200 max-h-80 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => add(r)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800 truncate">{r.variant.product.nameEn}</span>
                      <span className="block text-xs text-slate-500">{variantLabel(r.variant)} {r.variant.barcode && `· ${r.variant.barcode}`}</span>
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">{r.quantity} on hand</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="admin-card">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-slate-400">
              <LuTruck size={32} className="mb-2" />
              <p>Scan or search items from the delivery to start.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">On hand</th>
                    <th className="text-right w-28">Qty received</th>
                    <th className="text-right w-32">Unit cost</th>
                    <th className="text-right">Line total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.variantId}>
                      <td>
                        <p className="font-medium text-slate-800">{l.name}</p>
                        <p className="text-xs text-slate-500">{l.variant}</p>
                      </td>
                      <td className="text-right tabular-nums text-slate-500">{l.onHand}</td>
                      <td className="text-right">
                        <input type="number" min="1" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="admin-input !py-1 text-right !w-24" />
                      </td>
                      <td className="text-right">
                        <input type="number" min="0" step="0.001" value={l.unitCost} placeholder="—" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))} className="admin-input !py-1 text-right !w-28" />
                      </td>
                      <td className="text-right tabular-nums">{num((parseInt(l.quantity) || 0) * (parseFloat(l.unitCost) || 0))}</td>
                      <td>
                        <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove"><LuTrash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 p-5 h-fit space-y-4 lg:sticky lg:top-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><LuPackageCheck size={18} /> Goods receipt</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
          <input className="admin-input" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Invoice / reference</label>
          <input className="admin-input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <dl className="text-sm space-y-1.5 border-t border-slate-100 pt-3">
          <div className="flex justify-between"><dt className="text-slate-500">Lines</dt><dd className="font-medium">{lines.length}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Units</dt><dd className="font-medium">{units}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Total cost</dt><dd className="font-semibold">{num(value)} OMR</dd></div>
        </dl>
        {msg && <p className="text-sm text-rose-600">{msg}</p>}
        <button onClick={submit} disabled={saving || units === 0} className="admin-btn admin-btn-primary w-full justify-center">
          {saving ? "Receiving..." : `Receive ${units} unit${units === 1 ? "" : "s"}`}
        </button>
        <p className="text-xs text-slate-400">Stock goes up immediately and each product&apos;s purchase price is updated to the weighted-average cost.</p>
      </div>
    </div>
  );
}
