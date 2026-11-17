"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LuFileText, LuReceipt, LuSearch } from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import PrintArea from "@/components/print/PrintArea";
import { SaleDocument } from "@/components/print/SaleDocument";
import { printArea } from "@/lib/print";
import { orderToInvoice } from "@/lib/invoice";
import { DataTable, Pager, StatusLine, channelName, downloadCsv, f3, fmtDateTime, int, methodName, useReport, useReportCtx } from "./shared";
import { orderStatusLabel, paymentStatusLabel } from "@/components/admin/labels";

type Receipt = {
  id: string;
  createdAt: string;
  invoiceNumber: string | null;
  orderNumber: string;
  source: string;
  seller: string;
  customer: string;
  phone: string;
  units: number;
  lines: number;
  subtotal: number;
  offers: number;
  discount: number;
  shipping: number;
  vat: number;
  total: number;
  refunded: number;
  payments: { method: string; amount: number; status: string }[];
  status: string;
  paymentStatus: string;
};
type Data = {
  items: Receipt[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  totals: { receipts: number; subtotal: number; offers: number; discount: number; shipping: number; vat: number; total: number; refunded: number };
};

const paidBy = (r: Receipt) =>
  r.payments.length === 0
    ? "-"
    : r.payments.length === 1
      ? methodName(r.payments[0].method)
      : r.payments.map((p) => `${methodName(p.method)} ${f3(p.amount)}`).join(" + ");

/** Every sale in the period, paged on the server; click a row for the receipt. */
export default function ReceiptsTab({
  query,
  search,
  page,
  scope,
  onChange,
}: {
  query: string;
  search: string;
  page: number;
  scope: string;
  onChange: (patch: { q?: string; page?: string; scope?: string }) => void;
}) {
  const [term, setTerm] = useState(search);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => setTerm(search), [search]);
  // Debounced search → URL.
  useEffect(() => {
    if (term === search) return;
    const t = setTimeout(() => onChange({ q: term, page: "" }), 350);
    return () => clearTimeout(t);
  }, [term, search, onChange]);

  const params = new URLSearchParams(query);
  params.set("page", String(page));
  params.set("pageSize", "50");
  if (search) params.set("search", search);
  if (scope === "all") params.set("scope", "all");
  const { data, loading, error } = useReport<Data>("/api/reports/sales/receipts", params.toString());

  const exportAll = async () => {
    if (!data) return;
    setExporting(true);
    const all: Receipt[] = [];
    try {
      const pages = Math.min(50, Math.ceil(data.meta.total / 200));
      for (let p = 1; p <= pages; p++) {
        const q = new URLSearchParams(params);
        q.set("page", String(p));
        q.set("pageSize", "200");
        const d = await fetch(`/api/reports/sales/receipts?${q}`, { cache: "no-store" }).then((r) => r.json());
        if (!d.success) throw new Error(d.error);
        all.push(...(d.data.items as Receipt[]));
      }
      downloadCsv(
        "sales-receipts",
        ["Date & time", "Invoice", "Order", "Channel", "Salesperson", "Customer", "Phone", "Items", "Shelf value", "Offers", "Discount", "Delivery", "VAT", "Total", "Paid by", "Refunded", "Status", "Payment status"],
        all.map((r) => [
          fmtDateTime(r.createdAt),
          r.invoiceNumber ?? "",
          r.orderNumber,
          channelName(r.source),
          r.seller,
          r.customer,
          r.phone,
          r.units,
          r.subtotal.toFixed(3),
          r.offers.toFixed(3),
          r.discount.toFixed(3),
          r.shipping.toFixed(3),
          r.vat.toFixed(3),
          r.total.toFixed(3),
          paidBy(r),
          r.refunded.toFixed(3),
          r.status,
          r.paymentStatus,
        ]),
      );
    } catch {
      toast.error("Export failed: try a shorter period.");
    } finally {
      setExporting(false);
    }
  };

  if (!data) return <StatusLine loading={loading} error={error} />;
  const t = data.totals;
  return (
    <div className="space-y-3">
      <StatusLine loading={loading} error={error} />
      <DataTable
        id="receipts"
        title="Sales by receipt"
        titleAr="المبيعات حسب الإيصال"
        subtitle={`${int(data.meta.total)} receipts · totals are for all receipts matching the filters, not just this page`}
        rows={data.items}
        rowKey={(r) => r.id}
        serverSorted
        onRowClick={(r) => setOpenId(r.id)}
        onExportCsv={exporting ? () => {} : exportAll}
        printExtra={data.meta.totalPages > 1 ? `page ${data.meta.page} of ${data.meta.totalPages}` : undefined}
        rowClassName={(r) => (r.paymentStatus !== "PAID" && r.refunded === 0 ? "text-slate-400" : "")}
        totalsLabel={`Total (${int(t.receipts)})`}
        toolbar={
          <>
            <div className="relative">
              <LuSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Invoice, order, customer, phone" className="admin-input !py-1.5 !pl-7 text-xs !w-56" />
            </div>
            <select value={scope} onChange={(e) => onChange({ scope: e.target.value === "all" ? "all" : "", page: "" })} className="admin-input admin-select !py-1.5 text-xs !w-auto">
              <option value="">Paid sales only</option>
              <option value="all">Include unpaid & cancelled</option>
            </select>
          </>
        }
        footer={<Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={(p) => onChange({ page: String(p) })} />}
        columns={[
          { key: "time", label: "Date & time", value: (r) => fmtDateTime(r.createdAt), className: "whitespace-nowrap" },
          { key: "invoice", label: "Invoice", labelAr: "الفاتورة", value: (r) => r.invoiceNumber, className: "font-mono text-xs whitespace-nowrap" },
          { key: "order", label: "Order", value: (r) => r.orderNumber, className: "font-mono text-xs whitespace-nowrap text-indigo-700" },
          { key: "channel", label: "Channel", value: (r) => (r.source === "POS" ? "POS" : "Online") },
          { key: "seller", label: "Salesperson", labelAr: "البائع", value: (r) => r.seller },
          { key: "customer", label: "Customer", labelAr: "العميل", value: (r) => r.customer || null },
          { key: "units", label: "Items", kind: "int", value: (r) => r.units },
          { key: "subtotal", label: "Shelf value", kind: "money", value: (r) => r.subtotal, total: t.subtotal, muted: true },
          { key: "offers", label: "Offers", kind: "money", value: (r) => r.offers, total: t.offers },
          { key: "discount", label: "Discount", kind: "money", value: (r) => r.discount, total: t.discount },
          { key: "shipping", label: "Delivery", kind: "money", value: (r) => r.shipping, total: t.shipping },
          { key: "vat", label: "VAT", kind: "money", value: (r) => r.vat, total: t.vat },
          { key: "total", label: "Total", labelAr: "الإجمالي", kind: "money", value: (r) => r.total, total: t.total, className: "font-semibold" },
          { key: "paidBy", label: "Paid by", labelAr: "طريقة الدفع", value: paidBy, className: "whitespace-nowrap" },
          { key: "refunded", label: "Refunded", kind: "money", value: (r) => r.refunded, total: t.refunded },
          {
            key: "status",
            label: "Status",
            value: (r) => `${orderStatusLabel(r.status)} · ${paymentStatusLabel(r.paymentStatus)}`,
            render: (r) => (
              <span className="text-xs whitespace-nowrap">
                {orderStatusLabel(r.status)} · <span className={r.paymentStatus === "PAID" ? "text-emerald-700" : r.paymentStatus === "REFUNDED" ? "text-rose-700" : "text-amber-700"}>{paymentStatusLabel(r.paymentStatus)}</span>
              </span>
            ),
          },
        ]}
      />
      {openId && <ReceiptModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

type Detail = Record<string, unknown> & {
  id: string;
  orderNumber: string;
  invoiceNumber: string | null;
  createdAt: string;
  source: string;
  status: string;
  paymentStatus: string;
  total: string | number;
  refundedAmount: string | number;
  items: { id: string; quantity: number; unitPrice: string; total: string; discountAmount: string; promotionDiscount: string; taxRate: string; taxAmount: string; taxableAmount: string | null; productSnapshot: Record<string, unknown> | null }[];
  payments: { method: string; amount: string; status: string }[];
  refunds: { id: string; amount: string; taxAmount: string; method: string; reason: string | null; creditNoteNumber: string | null; createdAt: string }[];
  cashier: { nameEn: string | null } | null;
};

function ReceiptModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { store, tax } = useReportCtx();
  const { data, loading, error } = useReport<Detail>(`/api/reports/sales/receipts/${id}`, "");
  const inv = data ? orderToInvoice(data, { copyLabel: "Copy" }) : null;
  const n = (v: unknown) => Number(v ?? 0);

  return (
    <AdminModal
      open
      onClose={onClose}
      className="!max-w-3xl"
      title={data ? `Receipt ${data.invoiceNumber || data.orderNumber}` : "Receipt"}
      footer={
        inv && (
          <>
            <button onClick={() => printArea("report-receipt-80", { page: "receipt", title: inv.invoiceNumber || inv.orderNumber })} className="admin-btn admin-btn-secondary">
              <LuReceipt size={15} /> Reprint receipt
            </button>
            <button onClick={() => printArea("report-receipt-a4", { page: "a4", title: inv.invoiceNumber || inv.orderNumber })} className="admin-btn admin-btn-secondary">
              <LuFileText size={15} /> A4 invoice
            </button>
            <button onClick={onClose} className="admin-btn admin-btn-primary">Close</button>
          </>
        )
      }
    >
      <StatusLine loading={loading && !data} error={error} />
      {data && inv && (
        <div className="space-y-4 text-sm">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Invoice", data.invoiceNumber || "-"],
                ["Order", data.orderNumber],
                ["Date", fmtDateTime(data.createdAt)],
                ["Channel", channelName(data.source)],
                ["Salesperson", data.source === "ONLINE" ? "Online store" : data.cashier?.nameEn || "Unassigned"],
                ["Customer", inv.customerName || "-"],
                ["Status", `${orderStatusLabel(data.status)} · ${paymentStatusLabel(data.paymentStatus)}`],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100">
                  <td className="py-1 pr-4 text-slate-500 w-36">{k}</td>
                  <td className="py-1 text-slate-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="overflow-x-auto">
            <table className="admin-table tabular-nums">
              <thead>
                <tr>
                  <th className="!px-2.5 !py-1.5">Item</th>
                  <th className="!px-2.5 !py-1.5 text-right">Quantity</th>
                  <th className="!px-2.5 !py-1.5 text-right">Price</th>
                  <th className="!px-2.5 !py-1.5 text-right">Offer</th>
                  <th className="!px-2.5 !py-1.5 text-right">Discount</th>
                  <th className="!px-2.5 !py-1.5 text-right">VAT</th>
                  <th className="!px-2.5 !py-1.5 text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="!px-2.5 !py-1.5">
                      <div className="font-medium text-slate-800">{l.nameEn}</div>
                      {l.variant && <div className="text-xs text-slate-500">{l.variant}</div>}
                    </td>
                    <td className="!px-2.5 !py-1.5 text-right">{l.quantity}</td>
                    <td className="!px-2.5 !py-1.5 text-right">{f3(l.unitPrice)}</td>
                    <td className="!px-2.5 !py-1.5 text-right">{f3(l.promotionDiscount)}</td>
                    <td className="!px-2.5 !py-1.5 text-right">{f3(Math.max(0, l.discount - l.promotionDiscount))}</td>
                    <td className="!px-2.5 !py-1.5 text-right">{f3(l.tax)}</td>
                    <td className="!px-2.5 !py-1.5 text-right font-medium">{f3(l.gross)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td className="!px-2.5 !py-1.5" colSpan={5}>Total{inv.shipping > 0 ? ` (incl. delivery ${f3(inv.shipping)})` : ""}</td>
                  <td className="!px-2.5 !py-1.5 text-right">{f3(inv.taxTotal)}</td>
                  <td className="!px-2.5 !py-1.5 text-right">{f3(inv.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Payments</p>
              {data.payments.length === 0 && <p className="text-slate-400">No payment recorded.</p>}
              {data.payments.map((p, i) => (
                <div key={i} className="flex justify-between border-b border-slate-100 py-1">
                  <span>
                    {methodName(p.method)} <span className="text-xs text-slate-400">{paymentStatusLabel(p.status)}</span>
                  </span>
                  <span className="tabular-nums">{f3(n(p.amount))}</span>
                </div>
              ))}
              {inv.amountTendered != null && (
                <div className="flex justify-between py-1 text-slate-500">
                  <span>Cash tendered / change</span>
                  <span className="tabular-nums">
                    {f3(inv.amountTendered)} / {f3(inv.changeGiven ?? 0)}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Returns</p>
              {data.refunds.length === 0 && <p className="text-slate-400">None.</p>}
              {data.refunds.map((r) => (
                <div key={r.id} className="flex justify-between border-b border-slate-100 py-1 gap-2">
                  <span className="min-w-0">
                    {fmtDateTime(r.createdAt)} · {methodName(r.method)}
                    {r.creditNoteNumber && <span className="text-xs text-slate-400"> · {r.creditNoteNumber}</span>}
                    {r.reason && <span className="block text-xs text-slate-500 truncate">{r.reason}</span>}
                  </span>
                  <span className="tabular-nums text-rose-700 shrink-0">−{f3(n(r.amount))}</span>
                </div>
              ))}
            </div>
          </div>

          <PrintArea id="report-receipt-80">
            <SaleDocument data={inv} store={store} tax={tax} layout="thermal" />
          </PrintArea>
          <PrintArea id="report-receipt-a4">
            <SaleDocument data={inv} store={store} tax={tax} layout="a4" />
          </PrintArea>
        </div>
      )}
    </AdminModal>
  );
}
