"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  LuArrowLeft,
  LuBan,
  LuBarcode,
  LuCheck,
  LuCopy,
  LuFileText,
  LuHistory,
  LuListTodo,
  LuPackageCheck,
  LuPackageMinus,
  LuPencil,
  LuPrinter,
  LuReceipt,
  LuSend,
  LuTrash2,
  LuUndo2,
  LuWallet,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import PaymentModal from "./PaymentModal";
import { TaskList } from "./Tasks";
import { DebitNoteDoc, GoodsReceiptDoc, PurchaseOrderDoc, type PrintablePo, type PrintableReturn } from "./PrintDocs";
import {
  BalanceText,
  Field,
  PAYMENT_METHOD_OPTIONS,
  PayBadge,
  StatusBadge,
  api,
  fmt3,
  fmtDate,
  methodText,
  todayKey,
  useDocHeader,
  usePurchasingPerms,
  whatsappLink,
} from "./shared";

export type PoDetail = Omit<PrintablePo, "items" | "supplier"> & {
  id: string;
  orderedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  createdBy: string;
  paymentStatus: string;
  overdue: boolean;
  daysOverdue: number;
  attachments: { url: string; name: string }[];
  canEditAll: boolean;
  hasReceipts: boolean;
  supplier: PrintablePo["supplier"] & { id: string; whatsapp: string | null; isActive: boolean; balance: number };
  items: (PrintablePo["items"][number] & {
    productId: string | null;
    variantId: string | null;
    imageUrl: string | null;
    onHand: number | null;
    barcode: string | null;
    returnedQty: number;
    landedUnitCost: number | null;
  })[];
  receipts: { id: string; number: string; receivedAt: string; units: number; value: number; note: string | null; items: unknown; createdBy: string }[];
  returns: { id: string; number: string; returnedAt: string; subtotal: number; taxTotal: number; total: number; reason: string | null; items: unknown; createdBy: string }[];
  payments: { allocationId: string; amount: number; payment: { id: string; number: string; paidAt: string; method: string; reference: string | null; amount: number } }[];
};

type PrintTarget = { kind: "po" } | { kind: "grn"; id: string } | { kind: "dn"; id: string } | null;

/** Barcode-label link for what a delivery brought in. */
export function labelsLinkFor(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  const parts = (items as { variantId?: string | null; quantity?: number }[])
    .filter((i) => i.variantId && Number(i.quantity) > 0)
    .map((i) => `${i.variantId}:${Number(i.quantity)}`);
  return parts.length ? `/admin/products/labels?items=${parts.join(",")}` : null;
}

export default function PurchaseOrderDetail({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const perms = usePurchasingPerms();
  const header = useDocHeader();
  const [po, setPo] = useState<PoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "cancel" | "close" | "draft" | "delete">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null);
  const [lastReceipt, setLastReceipt] = useState<{ number: string; items: unknown } | null>(null);
  const [tab, setTab] = useState<"history" | "tasks">("history");

  const load = useCallback(async () => {
    const d = await api<PoDetail>(`/api/purchases/${id}`);
    if (!d.success || !d.data) {
      setNotFound(true);
    } else {
      setPo(d.data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // "Place & receive now" lands here with ?received=1 — offer labels for it.
  useEffect(() => {
    if (search.get("received") && po?.receipts[0] && !lastReceipt) setLastReceipt({ number: po.receipts[0].number, items: po.receipts[0].items });
  }, [search, po, lastReceipt]);

  const doPrint = (t: Exclude<PrintTarget, null>, title: string) => {
    setPrintTarget(t);
    setTimeout(() => printArea("purchase-doc", { page: "a4", title }), 80);
  };

  const action = async (a: "order" | "cancel" | "close" | "draft") => {
    setBusy(true);
    const d = await api<{ status: string }>(`/api/purchases/${id}/action`, { body: { action: a, reason: reason || null } });
    setBusy(false);
    if (!d.success) return toast.error(d.error || "Action failed");
    toast.success(a === "order" ? "Order placed with the supplier" : a === "cancel" ? "Order cancelled" : a === "close" ? "Order closed" : "Back to draft");
    setConfirm(null);
    setReason("");
    load();
  };

  const remove = async () => {
    setBusy(true);
    const d = await api(`/api/purchases/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!d.success) return toast.error(d.error || "Could not delete");
    toast.success("Draft deleted");
    router.push("/admin/purchases");
  };

  if (loading) return <div className="flex justify-center py-20"><span className="spinner" /></div>;
  if (notFound || !po) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Purchase order not found.</p>
        <Link href="/admin/purchases" className="text-indigo-600 hover:underline text-sm">Back to purchase orders</Link>
      </div>
    );
  }

  const ordered = po.items.reduce((s, i) => s + i.quantity, 0);
  const received = po.items.reduce((s, i) => s + i.receivedQty, 0);
  const returned = po.items.reduce((s, i) => s + i.returnedQty, 0);
  const pct = ordered ? Math.round((received / ordered) * 100) : 0;
  const canReceive = perms.receive && ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"].includes(po.status) && received < ordered;
  const canReturn = perms.receive && received - returned > 0 && po.status !== "CANCELLED";
  const canPay = perms.pay && ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(po.status) && po.outstanding > 0.0005;
  const m = perms.managePurchases;
  const wa = whatsappLink(po.supplier.whatsapp || po.supplier.phone, `Hello ${po.supplier.contactPerson || po.supplier.nameEn}, regarding our purchase order ${po.number}.`);

  const doc = (() => {
    if (!printTarget) return null;
    if (printTarget.kind === "po") return <PurchaseOrderDoc po={po} header={header} />;
    if (printTarget.kind === "grn") {
      const r = po.receipts.find((x) => x.id === printTarget.id);
      return r ? <GoodsReceiptDoc po={po} receipt={r} header={header} /> : null;
    }
    const r = po.returns.find((x) => x.id === printTarget.id);
    if (!r) return null;
    const ret: PrintableReturn = {
      ...r,
      items: Array.isArray(r.items) ? (r.items as PrintableReturn["items"]) : [],
      purchaseOrder: { number: po.number },
      supplier: po.supplier,
    };
    return <DebitNoteDoc ret={ret} header={header} />;
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/purchases" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
            <LuArrowLeft size={15} /> Purchase orders
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">{po.number}</h1>
            <StatusBadge status={po.status} />
            <PayBadge status={po.paymentStatus} overdue={po.overdue} days={po.daysOverdue} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            <Link href={`/admin/suppliers/${po.supplier.id}`} className="font-medium text-indigo-600 hover:underline">{po.supplier.nameEn}</Link>
            {" · "}ordered {fmtDate(po.orderDate)}
            {po.supplierReference && ` · invoice ${po.supplierReference}`}
            {po.createdBy && ` · by ${po.createdBy}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {m && po.status === "DRAFT" && (
            <button onClick={() => action("order")} disabled={busy} className="admin-btn admin-btn-primary"><LuSend size={15} /> Place order</button>
          )}
          {canReceive && (
            <button onClick={() => setReceiveOpen(true)} className="admin-btn bg-emerald-600 text-white hover:bg-emerald-700"><LuPackageCheck size={15} /> Receive goods</button>
          )}
          {canPay && (
            <button onClick={() => setPayOpen(true)} className="admin-btn admin-btn-secondary"><LuWallet size={15} /> Record payment</button>
          )}
          {canReturn && (
            <button onClick={() => setReturnOpen(true)} className="admin-btn admin-btn-secondary"><LuPackageMinus size={15} /> Return to supplier</button>
          )}
          <button onClick={() => doPrint({ kind: "po" }, po.number)} className="admin-btn admin-btn-secondary"><LuPrinter size={15} /> Print</button>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary">WhatsApp</a>
          )}
          {m && (
            <Link href={`/admin/purchases/new?duplicate=${po.id}`} className="admin-btn admin-btn-secondary" title="Start a new order with the same items"><LuCopy size={15} /> Duplicate</Link>
          )}
        </div>
      </div>

      {lastReceipt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 text-emerald-800 px-4 py-3 admin-fade-in">
          <p className="text-sm font-medium flex items-center gap-2"><LuCheck size={16} /> {lastReceipt.number} booked — stock is updated.</p>
          <div className="flex gap-2">
            {labelsLinkFor(lastReceipt.items) && (
              <Link href={labelsLinkFor(lastReceipt.items)!} className="admin-btn admin-btn-secondary !py-1.5"><LuBarcode size={15} /> Print barcode labels</Link>
            )}
            <button onClick={() => setLastReceipt(null)} className="text-sm text-emerald-700 hover:underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Timeline + money */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 admin-card p-5">
          <Timeline po={po} />
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-600">Received <strong className="text-slate-800">{received}</strong> of {ordered} units{returned > 0 && ` · ${returned} returned`}</span>
              <span className="text-slate-500 tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
            <Info label="Expected" value={fmtDate(po.expectedDate)} warn={!!po.expectedDate && po.expectedDate < todayKey() && ["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)} />
            <Info label="Payment due" value={fmtDate(po.dueDate)} warn={po.overdue} />
            <Info label="Supplier invoice" value={po.supplierReference || "—"} sub={po.invoiceDate ? fmtDate(po.invoiceDate) : undefined} />
            <Info label="Prices" value={po.pricesIncludeTax ? "Incl. VAT" : "Excl. VAT"} />
          </dl>
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
            {m && po.canEditAll && (
              <Link href={`/admin/purchases/${po.id}?edit=1`} className="admin-btn admin-btn-secondary !py-1.5"><LuPencil size={14} /> Edit order</Link>
            )}
            {m && !po.canEditAll && po.status !== "CANCELLED" && (
              <button onClick={() => setEditOpen(true)} className="admin-btn admin-btn-secondary !py-1.5"><LuPencil size={14} /> Edit details</button>
            )}
            {m && po.status === "PARTIALLY_RECEIVED" && (
              <button onClick={() => setConfirm("close")} className="admin-btn admin-btn-secondary !py-1.5"><LuCheck size={14} /> Close short</button>
            )}
            {m && po.status === "ORDERED" && !po.hasReceipts && po.amountPaid === 0 && (
              <button onClick={() => setConfirm("draft")} className="admin-btn admin-btn-secondary !py-1.5"><LuUndo2 size={14} /> Back to draft</button>
            )}
            {m && ["DRAFT", "ORDERED"].includes(po.status) && !po.hasReceipts && (
              <button onClick={() => setConfirm("cancel")} className="admin-btn admin-btn-danger !py-1.5"><LuBan size={14} /> Cancel order</button>
            )}
            {m && po.status === "DRAFT" && (
              <button onClick={() => setConfirm("delete")} className="admin-btn admin-btn-danger !py-1.5"><LuTrash2 size={14} /> Delete draft</button>
            )}
          </div>
        </div>

        <div className="admin-card p-5 space-y-2 text-sm">
          <MoneyLine label="Subtotal (excl. VAT)" value={po.subtotal} />
          {po.discount > 0 && <MoneyLine label="Discount" value={-po.discount} />}
          {po.shippingCost > 0 && <MoneyLine label="Freight" value={po.shippingCost} />}
          {po.otherCharges > 0 && <MoneyLine label="Other charges" value={po.otherCharges} />}
          <MoneyLine label="VAT" value={po.taxTotal} />
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-800">Total</span>
            <span className="text-xl font-bold tabular-nums">{fmt3(po.total)}</span>
          </div>
          {po.returnedTotal > 0 && <MoneyLine label="Returned to supplier" value={-po.returnedTotal} />}
          <MoneyLine label="Paid" value={-po.amountPaid} />
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-800">Still to pay</span>
            <BalanceText value={po.outstanding} className="text-lg" />
          </div>
          <p className="text-xs text-slate-400 pt-1">Supplier balance (all orders): <BalanceText value={po.supplier.balance} className="!font-medium" /></p>
        </div>
      </div>

      {/* Lines */}
      <div className="admin-card">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Ordered</th>
                <th className="text-right">Received</th>
                <th className="text-right">Returned</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Net</th>
                <th className="text-right">Landed / unit</th>
                <th className="text-right">In stock</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((it) => (
                <tr key={it.id}>
                  <td className="min-w-[220px]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.imageUrl && <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{it.nameEn}</p>
                        <p className="text-xs text-slate-500 truncate">{[it.productId ? it.variantLabel || "Standard" : "Non-stock item", it.sku].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{it.quantity}</td>
                  <td className={`text-right tabular-nums font-semibold ${it.receivedQty >= it.quantity ? "text-emerald-600" : it.receivedQty > 0 ? "text-amber-600" : "text-slate-400"}`}>{it.receivedQty}</td>
                  <td className="text-right tabular-nums text-slate-500">{it.returnedQty || "—"}</td>
                  <td className="text-right tabular-nums">
                    {fmt3(it.unitCost)}
                    {it.discountPct > 0 && <span className="block text-[11px] text-slate-400">−{it.discountPct}%</span>}
                  </td>
                  <td className="text-right tabular-nums text-sm">{fmt3(it.taxAmount)}<span className="block text-[11px] text-slate-400">{it.taxRate}%</span></td>
                  <td className="text-right tabular-nums">{fmt3(it.netAmount)}</td>
                  <td className="text-right tabular-nums">{it.landedUnitCost == null ? "—" : fmt3(it.landedUnitCost)}</td>
                  <td className="text-right tabular-nums text-slate-500">{it.onHand ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {po.notes && <p className="px-4 py-3 border-t border-slate-100 text-sm text-slate-600 whitespace-pre-line">{po.notes}</p>}
        {po.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-100">
            {po.attachments.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden ring-1 ring-slate-200" title={a.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* History / tasks */}
      <div className="flex gap-2">
        {([["history", "History", LuHistory], ["tasks", "Tasks", LuListTodo]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === k ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === "history" ? (
        <div className="grid lg:grid-cols-3 gap-5">
          <HistoryCard title="Deliveries (GRN)" icon={LuPackageCheck} empty="Nothing received yet.">
            {po.receipts.map((r) => (
              <li key={r.id} className="px-4 py-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{r.number}</p>
                  <p className="text-xs text-slate-500">{fmtDate(r.receivedAt, true)} · {r.units} units · {fmt3(r.value)}{r.createdBy && ` · ${r.createdBy}`}</p>
                  {r.note && <p className="text-xs text-slate-500 mt-0.5">{r.note}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  {labelsLinkFor(r.items) && (
                    <Link href={labelsLinkFor(r.items)!} className="p-1.5 text-slate-400 hover:text-slate-700" title="Print barcode labels"><LuBarcode size={15} /></Link>
                  )}
                  <button onClick={() => doPrint({ kind: "grn", id: r.id }, r.number)} className="p-1.5 text-slate-400 hover:text-slate-700" title="Print GRN"><LuPrinter size={15} /></button>
                </div>
              </li>
            ))}
          </HistoryCard>
          <HistoryCard title="Payments" icon={LuReceipt} empty="No payments yet.">
            {po.payments.map((p) => (
              <li key={p.allocationId} className="px-4 py-3">
                <div className="flex justify-between gap-2">
                  <p className="font-medium text-slate-800">{p.payment.number}</p>
                  <p className="tabular-nums font-semibold">{fmt3(p.amount)}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {fmtDate(p.payment.paidAt)} · {methodText(p.payment.method)}
                  {p.payment.reference && ` · ${p.payment.reference}`}
                  {Math.abs(p.payment.amount - p.amount) > 0.0005 && ` · part of ${fmt3(p.payment.amount)}`}
                </p>
              </li>
            ))}
          </HistoryCard>
          <HistoryCard title="Returns to supplier" icon={LuPackageMinus} empty="No returns.">
            {po.returns.map((r) => (
              <li key={r.id} className="px-4 py-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{r.number}</p>
                  <p className="text-xs text-slate-500">{fmtDate(r.returnedAt)} · {fmt3(r.total)}{r.reason && ` · ${r.reason}`}</p>
                </div>
                <button onClick={() => doPrint({ kind: "dn", id: r.id }, r.number)} className="p-1.5 text-slate-400 hover:text-slate-700 shrink-0" title="Print debit note"><LuFileText size={15} /></button>
              </li>
            ))}
          </HistoryCard>
        </div>
      ) : (
        <TaskList purchaseOrderId={po.id} supplierForNew={{ id: po.supplier.id, nameEn: po.supplier.nameEn, code: po.supplier.code }} canManage={perms.manageSuppliers || perms.managePurchases} />
      )}

      <ReceiveModal
        open={receiveOpen}
        po={po}
        onClose={() => setReceiveOpen(false)}
        onDone={(r) => {
          setLastReceipt(r);
          load();
        }}
      />
      <ReturnModal open={returnOpen} po={po} canRefund={perms.pay} onClose={() => setReturnOpen(false)} onDone={load} />
      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        supplier={{ id: po.supplier.id, nameEn: po.supplier.nameEn, code: po.supplier.code, balance: po.supplier.balance }}
        purchaseOrderId={po.id}
        onDone={load}
      />
      <EditDetailsModal open={editOpen} po={po} onClose={() => setEditOpen(false)} onDone={load} />

      <AdminModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm === "cancel" ? `Cancel ${po.number}?` : confirm === "close" ? `Close ${po.number} short?` : confirm === "draft" ? "Back to draft?" : `Delete draft ${po.number}?`
        }
        footer={
          <>
            <button onClick={() => setConfirm(null)} className="admin-btn admin-btn-secondary">Keep it</button>
            <button
              disabled={busy}
              onClick={() => (confirm === "delete" ? remove() : action(confirm!))}
              className={`admin-btn ${confirm === "close" || confirm === "draft" ? "admin-btn-primary" : "admin-btn-danger"}`}
            >
              {busy ? "Working…" : confirm === "cancel" ? "Cancel order" : confirm === "close" ? "Close order" : confirm === "draft" ? "Back to draft" : "Delete"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          {confirm === "cancel" && <p>The order stops being money owed.{po.amountPaid > 0 && ` The ${fmt3(po.amountPaid)} OMR already paid stays as credit with ${po.supplier.nameEn}.`}</p>}
          {confirm === "close" && (
            <p>
              {ordered - received} unit(s) will never arrive. The order is settled on what was received ({received} units) and its total is recalculated.
            </p>
          )}
          {confirm === "draft" && <p>The order goes back to a draft you can edit; it&apos;s no longer money owed.</p>}
          {confirm === "delete" && <p>The draft is removed permanently.</p>}
          {(confirm === "cancel" || confirm === "close") && (
            <Field label="Reason (optional)">
              <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
        </div>
      </AdminModal>

      <PrintArea id="purchase-doc">{doc}</PrintArea>
    </div>
  );
}

function Timeline({ po }: { po: PoDetail }) {
  const cancelled = po.status === "CANCELLED";
  const steps = [
    { label: "Draft", at: po.createdAt, done: true },
    { label: "Ordered", at: po.orderedAt, done: !!po.orderedAt },
    { label: "Received", at: po.receivedAt ?? (po.hasReceipts ? po.receipts[po.receipts.length - 1]?.receivedAt : null), done: po.status === "RECEIVED", partial: po.status === "PARTIALLY_RECEIVED" },
    { label: "Paid", at: po.paymentStatus === "PAID" ? po.payments[0]?.payment.paidAt ?? null : null, done: po.paymentStatus === "PAID", partial: po.paymentStatus === "PARTIAL" },
  ];
  if (cancelled) {
    return (
      <p className="text-sm text-rose-700 bg-rose-50 rounded-xl px-4 py-3">
        Cancelled {fmtDate(po.cancelledAt)}. {po.amountPaid > 0 ? "" : "Nothing is owed on this order."}
      </p>
    );
  }
  return (
    <ol className="grid grid-cols-4 gap-2">
      {steps.map((s, i) => (
        <li key={s.label} className="relative">
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                s.done ? "bg-emerald-500 text-white" : s.partial ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.done ? <LuCheck size={14} /> : i + 1}
            </span>
            {i < steps.length - 1 && <span className={`flex-1 h-0.5 ${steps[i + 1].done || steps[i + 1].partial ? "bg-emerald-300" : "bg-slate-200"}`} />}
          </div>
          <p className={`text-sm font-medium mt-1.5 ${s.done ? "text-slate-800" : s.partial ? "text-amber-700" : "text-slate-400"}`}>
            {s.partial ? `Part ${s.label.toLowerCase()}` : s.label}
          </p>
          {s.at && <p className="text-[11px] text-slate-400">{fmtDate(s.at)}</p>}
        </li>
      ))}
    </ol>
  );
}

function Info({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`font-medium ${warn ? "text-rose-600" : "text-slate-800"}`}>{value}</dd>
      {sub && <dd className="text-[11px] text-slate-400">{sub}</dd>}
    </div>
  );
}

function MoneyLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums text-slate-800">{value < 0 ? `−${fmt3(-value)}` : fmt3(value)}</span>
    </div>
  );
}

function HistoryCard({ title, icon: Icon, empty, children }: { title: string; icon: React.ElementType; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="admin-card">
      <h3 className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">
        <Icon size={16} /> {title}
      </h3>
      {children.length === 0 ? <p className="px-4 py-6 text-sm text-slate-400 text-center">{empty}</p> : <ul className="divide-y divide-slate-100">{children}</ul>}
    </div>
  );
}

function ReceiveModal({ open, po, onClose, onDone }: { open: boolean; po: PoDetail; onClose: () => void; onDone: (r: { number: string; items: unknown }) => void }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [receivedAt, setReceivedAt] = useState(todayKey());
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const remaining = useMemo(() => po.items.map((i) => ({ ...i, left: Math.max(0, i.quantity - i.receivedQty) })).filter((i) => i.left > 0), [po]);

  useEffect(() => {
    if (!open) return;
    setQty(Object.fromEntries(remaining.map((i) => [i.id, String(i.left)])));
    setReceivedAt(todayKey());
    setNote("");
    setRef(po.supplierReference ?? "");
    setInvoiceDate(po.invoiceDate ?? "");
    setErr("");
  }, [open, remaining, po.supplierReference, po.invoiceDate]);

  const units = remaining.reduce((s, i) => s + (parseInt(qty[i.id] || "0") || 0), 0);

  const submit = async () => {
    const lines = remaining.map((i) => ({ itemId: i.id, quantity: parseInt(qty[i.id] || "0") || 0 })).filter((l) => l.quantity > 0);
    if (!lines.length) return setErr("Enter how many units arrived.");
    for (const i of remaining) {
      if ((parseInt(qty[i.id] || "0") || 0) > i.left) return setErr(`Only ${i.left} of ${i.nameEn} are still to come.`);
    }
    setSaving(true);
    setErr("");
    const d = await api<{ number: string; units: number; items: unknown }>(`/api/purchases/${po.id}/receive`, {
      body: { lines, receivedAt, note: note || null, supplierReference: ref || null, invoiceDate: invoiceDate || null },
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not receive the goods.");
    toast.success(`${d.data.number}: ${d.data.units} unit(s) added to stock`);
    onDone({ number: d.data.number, items: d.data.items });
    onClose();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Receive goods · ${po.number}`}
      className="!max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving || units === 0} className="admin-btn bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
            {saving ? "Receiving…" : `Receive ${units} unit${units === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Count what actually arrived. Anything not delivered stays open on the order.</p>
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setQty(Object.fromEntries(remaining.map((i) => [i.id, String(i.left)])))} className="text-indigo-600 hover:underline">All remaining</button>
            <button type="button" onClick={() => setQty({})} className="text-slate-500 hover:underline">Clear</button>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Ordered</th>
              <th className="text-right">Already in</th>
              <th className="text-right w-32">Arrived now</th>
            </tr>
          </thead>
          <tbody>
            {remaining.map((i) => (
              <tr key={i.id}>
                <td>
                  <p className="font-medium text-slate-800">{i.nameEn}</p>
                  <p className="text-xs text-slate-500">{i.productId ? i.variantLabel || "Standard" : "Non-stock item"}{i.productId && !i.variantId && " · stock tracking starts now"}</p>
                </td>
                <td className="text-right tabular-nums">{i.quantity}</td>
                <td className="text-right tabular-nums text-slate-500">{i.receivedQty}</td>
                <td className="text-right">
                  <input type="number" min="0" max={i.left} value={qty[i.id] ?? ""} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} className="admin-input !py-1 text-right !w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Received on">
            <input type="date" className="admin-input" value={receivedAt} max={todayKey()} onChange={(e) => setReceivedAt(e.target.value)} />
          </Field>
          <Field label="Supplier invoice no.">
            <input className="admin-input" value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Field label="Invoice date">
            <input type="date" className="admin-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 boxes damaged, delivered by …" />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}

function ReturnModal({ open, po, canRefund, onClose, onDone }: { open: boolean; po: PoDetail; canRefund: boolean; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [returnedAt, setReturnedAt] = useState(todayKey());
  const [settlement, setSettlement] = useState<"CREDIT" | "REFUND">("CREDIT");
  const [refundMethod, setRefundMethod] = useState("BANK_TRANSFER");
  const [refundReference, setRefundReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const returnable = useMemo(() => po.items.map((i) => ({ ...i, can: Math.max(0, i.receivedQty - i.returnedQty) })).filter((i) => i.can > 0), [po]);

  useEffect(() => {
    if (!open) return;
    setQty({});
    setReason("");
    setReturnedAt(todayKey());
    setSettlement("CREDIT");
    setRefundReference("");
    setErr("");
  }, [open]);

  const value = returnable.reduce((s, i) => {
    const q = parseInt(qty[i.id] || "0") || 0;
    return s + (i.quantity ? ((i.netAmount + i.taxAmount) / i.quantity) * q : 0);
  }, 0);

  const submit = async () => {
    const lines = returnable.map((i) => ({ itemId: i.id, quantity: parseInt(qty[i.id] || "0") || 0 })).filter((l) => l.quantity > 0);
    if (!lines.length) return setErr("Choose what is going back.");
    setSaving(true);
    setErr("");
    const d = await api<{ number: string; total: number }>(`/api/purchases/${po.id}/return`, {
      body: { lines, reason: reason || null, returnedAt, settlement, refundMethod, refundReference: refundReference || null },
    });
    setSaving(false);
    if (!d.success || !d.data) return setErr(d.error || "Could not record the return.");
    toast.success(`${d.data.number}: ${fmt3(d.data.total)} OMR ${settlement === "REFUND" ? "refunded" : "credited"}`);
    onDone();
    onClose();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Return to supplier · ${po.number}`}
      className="!max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving || value <= 0} className="admin-btn admin-btn-danger disabled:opacity-40">
            {saving ? "Saving…" : `Return ${fmt3(value)} OMR`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Stock goes down by what you send back, and you owe the supplier less (at the price you paid incl. VAT).</p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Received</th>
              <th className="text-right">In stock</th>
              <th className="text-right w-32">Return</th>
            </tr>
          </thead>
          <tbody>
            {returnable.map((i) => (
              <tr key={i.id}>
                <td>
                  <p className="font-medium text-slate-800">{i.nameEn}</p>
                  <p className="text-xs text-slate-500">{i.variantLabel || "Standard"}{i.returnedQty > 0 && ` · ${i.returnedQty} already returned`}</p>
                </td>
                <td className="text-right tabular-nums">{i.receivedQty}</td>
                <td className="text-right tabular-nums text-slate-500">{i.onHand ?? "—"}</td>
                <td className="text-right">
                  <input type="number" min="0" max={i.can} value={qty[i.id] ?? ""} placeholder="0" onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} className="admin-input !py-1 text-right !w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Reason">
            <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong colour, faulty…" />
          </Field>
          <Field label="Date">
            <input type="date" className="admin-input" value={returnedAt} max={todayKey()} onChange={(e) => setReturnedAt(e.target.value)} />
          </Field>
        </div>
        <SettlementPicker
          value={settlement}
          onChange={setSettlement}
          canRefund={canRefund}
          method={refundMethod}
          onMethod={setRefundMethod}
          reference={refundReference}
          onReference={setRefundReference}
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}

/** "Credit to our account" vs "supplier refunded the money". */
export function SettlementPicker({
  value,
  onChange,
  canRefund,
  method,
  onMethod,
  reference,
  onReference,
}: {
  value: "CREDIT" | "REFUND";
  onChange: (v: "CREDIT" | "REFUND") => void;
  canRefund: boolean;
  method: string;
  onMethod: (v: string) => void;
  reference: string;
  onReference: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-3">
      <p className="text-sm font-medium text-slate-700">How is it settled?</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {([
          ["CREDIT", "Credit to our account", "Reduces what we owe this supplier."],
          ["REFUND", "Supplier refunded the money", "They paid it back — recorded as a refund received."],
        ] as const).map(([k, title, hint]) => (
          <button
            key={k}
            type="button"
            disabled={k === "REFUND" && !canRefund}
            onClick={() => onChange(k)}
            className={`text-left rounded-xl px-3 py-2.5 ring-1 transition ${value === k ? "ring-indigo-400 bg-indigo-50/60" : "ring-slate-200 hover:ring-slate-300"} disabled:opacity-40`}
          >
            <span className="block text-sm font-medium text-slate-800">{title}</span>
            <span className="block text-xs text-slate-500">{hint}</span>
          </button>
        ))}
      </div>
      {value === "REFUND" && (
        <div className="grid sm:grid-cols-2 gap-3 admin-fade-in">
          <Field label="Refunded by">
            <select className="admin-input admin-select" value={method} onChange={(e) => onMethod(e.target.value)}>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.en}</option>
              ))}
            </select>
          </Field>
          <Field label="Reference">
            <input className="admin-input" value={reference} onChange={(e) => onReference(e.target.value)} />
          </Field>
        </div>
      )}
    </div>
  );
}

function EditDetailsModal({ open, po, onClose, onDone }: { open: boolean; po: PoDetail; onClose: () => void; onDone: () => void }) {
  const [ref, setRef] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setRef(po.supplierReference ?? "");
    setInvoiceDate(po.invoiceDate ?? "");
    setExpectedDate(po.expectedDate ?? "");
    setDueDate(po.dueDate ?? "");
    setNotes(po.notes ?? "");
    setErr("");
  }, [open, po]);

  const submit = async () => {
    setSaving(true);
    const d = await api(`/api/purchases/${po.id}`, {
      method: "PATCH",
      body: { supplierReference: ref || null, invoiceDate: invoiceDate || null, expectedDate: expectedDate || null, dueDate: dueDate || null, notes: notes || null },
    });
    setSaving(false);
    if (!d.success) return setErr(d.error || "Could not save.");
    toast.success("Details updated");
    onDone();
    onClose();
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Edit details · ${po.number}`}
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="admin-btn admin-btn-primary">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Goods have arrived, so quantities and prices are locked (they&apos;re in the stock value). You can still change these:</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Supplier invoice no."><input className="admin-input" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Field label="Invoice date"><input type="date" className="admin-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
          <Field label="Expected delivery"><input type="date" className="admin-input" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></Field>
          <Field label="Payment due"><input type="date" className="admin-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><textarea className="admin-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}
