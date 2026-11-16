"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { LuCalendarDays, LuDownload, LuPlus, LuPrinter, LuReceiptText, LuSearch, LuUndo2 } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import { DebitNoteDoc, type PrintableReturn } from "@/components/admin/purchasing/PrintDocs";
import { Empty, Kpi, Pager, SupplierPicker, api, fmt3, fmtDate, methodText, useDocHeader, usePurchasingPerms, type SupplierOption } from "@/components/admin/purchasing/shared";

type ReturnRow = {
  id: string;
  number: string;
  returnedAt: string;
  returnedOn: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  reason: string | null;
  units: number;
  supplier: { id: string; code: string; nameEn: string; nameAr: string | null } | null;
  purchaseOrder: { id: string; number: string } | null;
  createdBy: string;
  settlement: "CREDIT" | "REFUND";
  refund: { id: string; number: string; method: string; reference: string | null; amount: number } | null;
};

type ListData = {
  items: ReturnRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  totals: { net: number; vat: number; total: number };
  month: { count: number; value: number };
};

type DetailData = PrintableReturn & { supplierDetails: PrintableReturn["supplier"] };

/** Returns to suppliers (debit notes). */
export default function SupplierReturnsPage() {
  const perms = usePurchasingPerms();
  const header = useDocHeader();
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState<SupplierOption | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<PrintableReturn | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);

  const params = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (search.trim()) p.set("search", search.trim());
    if (supplier) p.set("supplierId", supplier.id);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [page, search, supplier, from, to]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api<ListData>(`/api/supplier-returns?${params()}`).then((d) => {
        if (d.success && d.data) setData(d.data);
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [params]);

  const reset = (fn: () => void) => {
    setPage(1);
    fn();
  };

  const print = async (r: ReturnRow) => {
    setPrinting(r.id);
    const d = await api<DetailData>(`/api/supplier-returns/${r.id}`);
    setPrinting(null);
    if (!d.success || !d.data) return void toast.error(d.error || "Could not load the debit note");
    setDoc({ ...d.data, supplier: d.data.supplierDetails });
    setTimeout(() => printArea("supplier-return-dn", { page: "a4", title: r.number }), 60);
  };

  const csvHref = () => {
    const p = params();
    p.delete("page");
    p.delete("pageSize");
    p.set("format", "csv");
    return `/api/supplier-returns?${p}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Supplier returns</h1>
          <p className="text-sm text-slate-500">Goods sent back to suppliers (debit notes). Stock goes down and the value comes off what you owe — or the supplier refunds you.</p>
        </div>
        <div className="flex gap-2">
          <a href={csvHref()} className="admin-btn admin-btn-secondary"><LuDownload size={15} /> CSV</a>
          {perms.receive && (
            <Link href="/admin/supplier-returns/new" className="admin-btn admin-btn-primary"><LuPlus size={16} /> Return goods</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi icon={LuCalendarDays} label="This month" value={data ? `${fmt3(data.month.value)} OMR` : "—"} sub={data ? `${data.month.count} return${data.month.count === 1 ? "" : "s"}` : ""} />
        <Kpi icon={LuUndo2} label="In this view" value={data ? `${fmt3(data.totals.total)} OMR` : "—"} sub={data ? `${data.meta.total} debit note${data.meta.total === 1 ? "" : "s"}` : ""} tone="info" />
        <Kpi icon={LuReceiptText} label="Input VAT reversed" value={data ? `${fmt3(data.totals.vat)} OMR` : "—"} sub={data ? `Net ${fmt3(data.totals.net)} OMR` : ""} />
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_240px_auto]">
        <div className="relative">
          <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => reset(() => setSearch(e.target.value))} placeholder="Debit note, PO, supplier or reason" className="admin-input !py-2 !pl-9 text-sm" />
        </div>
        <SupplierPicker value={supplier} onChange={(s) => reset(() => setSupplier(s))} placeholder="All suppliers" />
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="admin-input !py-2 text-sm !w-auto min-w-0" aria-label="From" />
          <span className="text-slate-400 text-sm">–</span>
          <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} className="admin-input !py-2 text-sm !w-auto min-w-0" aria-label="To" />
        </div>
        {supplier && <button onClick={() => reset(() => setSupplier(null))} className="text-xs text-indigo-600 hover:underline justify-self-start">Clear supplier</button>}
      </div>

      <div className="admin-card">
        {loading && !data ? (
          <div className="flex justify-center py-14"><span className="spinner" /></div>
        ) : !data || data.items.length === 0 ? (
          <Empty icon={LuUndo2} title="No returns to suppliers">
            {perms.receive ? <Link href="/admin/supplier-returns/new" className="text-indigo-600 hover:underline">Record a return</Link> : null}
          </Empty>
        ) : (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="admin-table min-w-[1000px]">
              <thead>
                <tr>
                  <th>Debit note</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Purchase order</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">VAT</th>
                  <th className="text-right">Total</th>
                  <th>Settlement</th>
                  <th>Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="font-mono text-sm text-slate-800">{r.number}</span>
                      {r.createdBy && <span className="block text-xs text-slate-400">{r.createdBy}</span>}
                    </td>
                    <td className="text-sm whitespace-nowrap">{fmtDate(r.returnedAt)}</td>
                    <td>
                      {r.supplier && (
                        <Link href={`/admin/suppliers/${r.supplier.id}?tab=returns`} className="font-medium text-slate-800 hover:text-indigo-600">{r.supplier.nameEn}</Link>
                      )}
                    </td>
                    <td>
                      {r.purchaseOrder ? (
                        <Link href={`/admin/purchases/${r.purchaseOrder.id}`} className="font-mono text-xs text-indigo-600 hover:underline">{r.purchaseOrder.number}</Link>
                      ) : (
                        <span className="text-xs text-slate-400">Not on an order</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{r.units}</td>
                    <td className="text-right tabular-nums">{fmt3(r.subtotal)}</td>
                    <td className="text-right tabular-nums text-slate-500">{r.taxTotal ? fmt3(r.taxTotal) : "—"}</td>
                    <td className="text-right tabular-nums font-semibold">{fmt3(r.total)}</td>
                    <td className="text-sm">
                      {r.settlement === "REFUND" && r.refund ? (
                        <span className="text-emerald-700">
                          Refunded · {methodText(r.refund.method)}
                          <span className="block text-[11px] text-slate-400 font-mono">{r.refund.number}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">Credit to account</span>
                      )}
                    </td>
                    <td className="text-sm text-slate-500 max-w-[200px] truncate">{r.reason || "—"}</td>
                    <td>
                      <button onClick={() => print(r)} disabled={printing === r.id} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-40" title="Print debit note (English + Arabic)">
                        <LuPrinter size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right text-sm font-semibold text-slate-600">Totals for this view</td>
                  <td className="text-right tabular-nums font-semibold">{fmt3(data.totals.net)}</td>
                  <td className="text-right tabular-nums font-semibold">{fmt3(data.totals.vat)}</td>
                  <td className="text-right tabular-nums font-bold">{fmt3(data.totals.total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>

      {doc && (
        <PrintArea id="supplier-return-dn">
          <DebitNoteDoc ret={doc} header={header} />
        </PrintArea>
      )}
    </div>
  );
}
