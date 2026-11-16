"use client";
import { useCallback, useEffect, useState } from "react";
import { LuPackageX, LuPlus, LuPrinter, LuRotateCcw, LuUndo2 } from "react-icons/lu";
import toast from "react-hot-toast";
import ReturnModal from "@/components/pos/ReturnModal";
import PrintArea from "@/components/print/PrintArea";
import { SaleDocument } from "@/components/print/SaleDocument";
import { printArea } from "@/lib/print";
import { refundToCreditNote, type InvoiceData, type StoreInfo } from "@/lib/invoice";
import { DEFAULT_TAX_SETTINGS, type TaxSettings } from "@/lib/taxCalc";

type RefundRow = {
  id: string;
  createdAt: string;
  amount: number;
  taxAmount: number;
  creditNoteNumber: string | null;
  items: unknown;
  method: string;
  reason: string | null;
  restocked: boolean;
  units: number;
  order: { id: string; orderNumber: string; source: string; total: number; guestName: string | null };
  createdBy: string;
};

const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const methodLabel = (m: string) => m.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function ReturnsPage() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [sum, setSum] = useState(0);
  const [total, setTotal] = useState(0);
  const [damaged, setDamaged] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", from: "", to: "", method: "" });
  const [newOpen, setNewOpen] = useState(false);
  const [vatSum, setVatSum] = useState(0);
  const [store, setStore] = useState<StoreInfo>({});
  const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);
  const [doc, setDoc] = useState<InvoiceData | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings?group=general").then((r) => r.json()).then((d) => d.success && setStore(d.data)).catch(() => {});
    fetch("/api/tax/settings").then((r) => r.json()).then((d) => d.success && setTax(d.data)).catch(() => {});
  }, []);

  /** Bilingual A4 credit note for one return (needs the full order for names and VAT). */
  const printCreditNote = async (r: RefundRow) => {
    setPrinting(r.id);
    const d = await fetch(`/api/orders/${r.order.id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    setPrinting(null);
    if (!d?.success) return toast.error("Could not load the order");
    setDoc(refundToCreditNote(d.data, r as unknown as Record<string, unknown>));
    setTimeout(() => printArea("returns-credit-note", { page: "a4", title: r.creditNoteNumber || "Credit note" }), 50);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const d = await fetch(`/api/returns?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (d?.success) {
      setRows(d.data.items);
      setSum(d.data.sum);
      setTotal(d.data.meta.total);
      setTotalPages(Math.max(1, d.data.meta.totalPages));
      setDamaged(d.data.damagedCount);
      setVatSum(d.data.vatSum ?? 0);
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat icon={LuUndo2} label="Returns" value={total.toLocaleString()} />
        <Stat icon={LuRotateCcw} label={vatSum > 0 ? `Refunded (incl. ${num(vatSum)} VAT)` : "Refunded"} value={`${num(sum)} OMR`} />
        <Stat icon={LuPackageX} label="Damaged (not restocked)" value={damaged.toLocaleString()} />
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
        <input value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="Order, credit note no. or reason" className="admin-input !py-2 text-sm md:max-w-xs" />
        <select value={filters.method} onChange={(e) => setFilter("method", e.target.value)} className="admin-input admin-select !py-2 text-sm md:max-w-[180px]">
          <option value="">All refund methods</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="STORE_CREDIT">Store credit</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className="admin-input !py-2 text-sm !w-auto min-w-0" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className="admin-input !py-2 text-sm !w-auto min-w-0" />
        </div>
        <button onClick={() => setNewOpen(true)} className="admin-btn admin-btn-primary !py-2 text-sm md:ml-auto">
          <LuPlus size={16} /> New return
        </button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-slate-400">
            <LuUndo2 size={32} className="mb-2" />
            <p>No returns recorded{Object.values(filters).some(Boolean) ? " for these filters" : " yet"}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Credit note</th>
                  <th>Order</th>
                  <th className="text-right">Units</th>
                  <th>Refund by</th>
                  <th>Stock</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th className="text-right">VAT</th>
                  <th className="text-right">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-sm">{new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="font-mono text-xs whitespace-nowrap">{r.creditNoteNumber || "—"}</td>
                    <td>
                      <span className="font-medium text-slate-800">{r.order.orderNumber}</span>
                      <p className="text-xs text-slate-400">{r.order.source === "POS" ? "In-store" : "Online"} · total {num(r.order.total)}</p>
                    </td>
                    <td className="text-right tabular-nums">{r.units}</td>
                    <td className="text-sm">{methodLabel(r.method)}</td>
                    <td>
                      {r.restocked ? <span className="badge badge-delivered">Restocked</span> : <span className="badge badge-cancelled">Damaged</span>}
                    </td>
                    <td className="max-w-[240px] truncate text-sm text-slate-600">{r.reason || "—"}</td>
                    <td className="text-sm text-slate-500">{r.createdBy || "—"}</td>
                    <td className="text-right tabular-nums text-slate-500">{r.taxAmount > 0 ? num(r.taxAmount) : "—"}</td>
                    <td className="text-right tabular-nums font-semibold">{num(r.amount)}</td>
                    <td>
                      <button onClick={() => printCreditNote(r)} disabled={printing === r.id} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-40" title="Print credit note (English + Arabic)">
                        <LuPrinter size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Prev</button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="admin-btn admin-btn-secondary text-xs disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      <ReturnModal open={newOpen} onClose={() => { setNewOpen(false); load(); }} onDone={load} />
      {doc && (
        <PrintArea id="returns-credit-note">
          <SaleDocument data={doc} store={store} tax={tax} layout="a4" />
        </PrintArea>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><Icon size={20} /></span>
      <div>
        <p className="text-lg font-bold text-slate-800 tabular-nums">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
