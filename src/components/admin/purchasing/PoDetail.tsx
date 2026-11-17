"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  LuBan,
  LuBarcode,
  LuCheck,
  LuChevronLeft,
  LuCircleCheck,
  LuCopy,
  LuFileText,
  LuLock,
  LuPackage,
  LuPackageCheck,
  LuPencil,
  LuPrinter,
  LuRotateCcw,
  LuSend,
  LuTrash2,
  LuTriangleAlert,
  LuUndo2,
  LuWallet,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import Attachments, { type Attachment } from "./Attachments";
import PaymentModal from "./PaymentModal";
import PoEditor, { newUid, type EditorInitial } from "./PoEditor";
import { ActionModal, ReceiveModal, ReturnToSupplierModal } from "./PoDialogs";
import { DebitNoteDoc, GoodsReceiptDoc, PurchaseOrderDoc, type PrintablePo } from "./PrintDocs";
import { TaskList } from "./Tasks";
import { Field, PayBadge, StatusBadge, api, fmt3, fmtDate, methodText, useDocHeader, usePurchasingPerms, whatsappLink } from "./shared";
import { labelsLinkFor, returnItems, type PoDetailData, type PoReceipt, type PoReturn } from "./types";

type Action = "order" | "cancel" | "close" | "draft" | "delete";

export function poToEditor(po: PoDetailData, duplicate = false): EditorInitial {
  return {
    id: duplicate ? undefined : po.id,
    number: duplicate ? undefined : po.number,
    supplier: {
      id: po.supplier.id,
      code: po.supplier.code,
      nameEn: po.supplier.nameEn,
      nameAr: po.supplier.nameAr,
      paymentTermsDays: po.supplier.paymentTermsDays,
      balance: po.supplier.balance,
      isActive: po.supplier.isActive,
      phone: po.supplier.phone,
      vatNumber: po.supplier.vatNumber,
    },
    supplierReference: duplicate ? "" : po.supplierReference ?? "",
    invoiceDate: duplicate ? "" : po.invoiceDate ?? "",
    orderDate: duplicate ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Muscat" }).format(new Date()) : po.orderDate ?? "",
    expectedDate: duplicate ? "" : po.expectedDate ?? "",
    dueDate: duplicate ? "" : po.dueDate ?? "",
    pricesIncludeTax: po.pricesIncludeTax,
    discount: po.discount ? String(po.discount) : "",
    shippingCost: po.shippingCost ? String(po.shippingCost) : "",
    otherCharges: po.otherCharges ? String(po.otherCharges) : "",
    notes: duplicate ? "" : po.notes ?? "",
    attachments: duplicate ? [] : po.attachments,
    lines: po.items.map((i) => ({
      uid: newUid(),
      id: duplicate ? undefined : i.id,
      productId: i.productId,
      variantId: i.variantId,
      nameEn: i.nameEn,
      nameAr: i.nameAr,
      variantLabel: i.variantLabel,
      sku: i.sku,
      barcode: i.barcode,
      imageUrl: i.imageUrl,
      onHand: i.onHand,
      quantity: String(i.quantity),
      unitCost: String(i.unitCost),
      discountPct: i.discountPct ? String(i.discountPct) : "",
      taxRate: String(i.taxRate),
      taxCode: i.taxCode,
    })),
  };
}

function toPrintable(po: PoDetailData): PrintablePo {
  return {
    ...po,
    supplier: {
      code: po.supplier.code,
      nameEn: po.supplier.nameEn,
      nameAr: po.supplier.nameAr,
      contactPerson: po.supplier.contactPerson,
      phone: po.supplier.phone,
      email: po.supplier.email,
      address: po.supplier.address,
      city: po.supplier.city,
      country: po.supplier.country,
      vatNumber: po.supplier.vatNumber,
      crNumber: po.supplier.crNumber,
      paymentTermsDays: po.supplier.paymentTermsDays,
    },
  };
}

export default function PoDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const perms = usePurchasingPerms();
  const header = useDocHeader();
  const [po, setPo] = useState<PoDetailData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [justReceived, setJustReceived] = useState<{ number: string; items: unknown } | null>(null);
  const [printReceipt, setPrintReceipt] = useState<PoReceipt | null>(null);
  const [printReturn, setPrintReturn] = useState<PoReturn | null>(null);

  const load = useCallback(async () => {
    const d = await api<PoDetailData>(`/api/purchases/${id}`);
    if (d.success && d.data) {
      setPo(d.data);
      setLoadError("");
    } else setLoadError(d.error || "Could not load the purchase order.");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Arrived from "Bought & received now": offer labels for the delivery.
  useEffect(() => {
    if (searchParams.get("received") && po && !justReceived && po.receipts[0]) {
      setJustReceived({ number: po.receipts[0].number, items: po.receipts[0].items });
    }
  }, [searchParams, po, justReceived]);

  const printDoc = (target: "po" | "grn" | "dn", title: string) => {
    setTimeout(() => printArea(`purchase-${target}`, { page: "a4", title }), 60);
  };

  const runAction = async (a: Action, reason: string) => {
    if (!po) return;
    if (a === "delete") {
      const d = await api(`/api/purchases/${po.id}`, { method: "DELETE" });
      if (!d.success) return void toast.error(d.error || "Could not delete");
      toast.success(`${po.number} deleted`);
      router.push("/admin/purchases");
      return;
    }
    const d = await api<{ status: string }>(`/api/purchases/${po.id}/action`, { body: { action: a, reason: reason || null } });
    if (!d.success) return void toast.error(d.error || "Could not update the order");
    toast.success(
      a === "order" ? `${po.number} placed with ${po.supplier.nameEn}` : a === "cancel" ? `${po.number} cancelled` : a === "close" ? `${po.number} closed on what arrived` : `${po.number} is a draft again`,
    );
    setAction(null);
    load();
  };

  const saveAttachments = async (next: Attachment[]) => {
    if (!po) return;
    setPo({ ...po, attachments: next });
    const d = await api(`/api/purchases/${po.id}`, { method: "PATCH", body: { attachments: next } });
    if (!d.success) {
      toast.error(d.error || "Could not save attachments");
      load();
    }
  };

  const progress = useMemo(() => {
    if (!po) return { ordered: 0, received: 0, returned: 0 };
    return po.items.reduce(
      (s, i) => ({ ordered: s.ordered + i.quantity, received: s.received + i.receivedQty, returned: s.returned + i.returnedQty }),
      { ordered: 0, received: 0, returned: 0 },
    );
  }, [po]);

  if (loadError) {
    return (
      <div className="admin-card p-10 text-center">
        <p className="text-slate-600">{loadError}</p>
        <Link href="/admin/purchases" className="admin-btn admin-btn-secondary mt-4">Back to purchase orders</Link>
      </div>
    );
  }
  if (!po) return <div className="flex justify-center py-16"><span className="spinner" /></div>;

  if (editing) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <LuChevronLeft size={16} /> Back to {po.number}
        </button>
        <PoEditor
          initial={poToEditor(po)}
          onCancel={() => {
            setEditing(false);
            load();
          }}
        />
      </div>
    );
  }

  const s = po.status;
  const canManage = perms.managePurchases;
  const cancelled = s === "CANCELLED";
  const canReceive = perms.receive && ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"].includes(s);
  const canReturn = perms.receive && po.items.some((i) => i.receivedQty - i.returnedQty > 0);
  const canPay = perms.pay && ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(s) && po.outstanding > 0.0005;
  const printable = toPrintable(po);
  const wa = whatsappLink(po.supplier.whatsapp || po.supplier.phone, `Hello ${po.supplier.contactPerson || po.supplier.nameEn}, regarding our purchase order ${po.number}.`);

  const steps = [
    { label: "Created", at: po.createdAt, done: true },
    { label: "Ordered", at: po.orderedAt, done: !!po.orderedAt && !cancelled },
    { label: s === "PARTIALLY_RECEIVED" ? "Part received" : "Received", at: po.receivedAt, done: s === "RECEIVED" || s === "PARTIALLY_RECEIVED", partial: s === "PARTIALLY_RECEIVED" },
    { label: "Paid", at: null, done: po.paymentStatus === "PAID", partial: po.paymentStatus === "PARTIAL" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/purchases" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
            <LuChevronLeft size={16} /> Purchase orders
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-800 font-mono">{po.number}</h1>
            <StatusBadge status={s} />
            <PayBadge status={po.paymentStatus} overdue={po.overdue} days={po.daysOverdue} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            <Link href={`/admin/suppliers/${po.supplier.id}`} className="font-medium text-indigo-600 hover:underline">{po.supplier.nameEn}</Link>
            {" · "}ordered {fmtDate(po.orderDate)}
            {po.supplierReference && ` · invoice ${po.supplierReference}`}
            {po.createdBy && ` · by ${po.createdBy}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => printDoc("po", po.number)} className="admin-btn admin-btn-secondary">
            <LuPrinter size={15} /> Print PO
          </button>
          {canManage && (
            <button onClick={() => router.push(`/admin/purchases/new?from=${po.id}`)} className="admin-btn admin-btn-secondary" title="Start a new order with the same items">
              <LuCopy size={15} /> Duplicate
            </button>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener" className="admin-btn admin-btn-secondary">WhatsApp</a>
          )}
        </div>
      </div>

      {cancelled && (
        <div className="rounded-2xl bg-rose-50 text-rose-800 px-4 py-3 text-sm flex items-center gap-2">
          <LuBan size={16} /> Cancelled {fmtDate(po.cancelledAt, true)}. This order is no longer owed.
        </div>
      )}

      {justReceived && (
        <div className="rounded-2xl bg-emerald-50 text-emerald-900 px-4 py-3 text-sm flex flex-wrap items-center gap-3">
          <LuPackageCheck size={18} />
          <span className="flex-1 min-w-[200px]">
            Delivery <strong>{justReceived.number}</strong> is in stock. Label the new units before they go on the shelf.
          </span>
          {labelsLinkFor(justReceived.items) && (
            <Link href={labelsLinkFor(justReceived.items)!} className="admin-btn admin-btn-primary !py-1.5">
              <LuBarcode size={15} /> Print barcode labels
            </Link>
          )}
          <button
            onClick={() => {
              const r = po.receipts.find((x) => x.number === justReceived.number) ?? null;
              setPrintReceipt(r);
              if (r) printDoc("grn", r.number);
            }}
            className="admin-btn admin-btn-secondary !py-1.5"
          >
            <LuPrinter size={15} /> Print GRN
          </button>
          <button onClick={() => setJustReceived(null)} className="text-emerald-700 hover:underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Actions */}
      {!cancelled && (
        <div className="admin-card p-3 flex flex-wrap gap-2">
          {s === "DRAFT" && canManage && (
            <button onClick={() => setAction("order")} className="admin-btn admin-btn-primary"><LuSend size={15} /> Place order</button>
          )}
          {canReceive && (
            <button onClick={() => setReceiveOpen(true)} className="admin-btn admin-btn-primary"><LuPackageCheck size={15} /> Receive goods</button>
          )}
          {canPay && (
            <button onClick={() => setPayOpen(true)} className="admin-btn admin-btn-secondary"><LuWallet size={15} /> Record payment</button>
          )}
          {canReturn && (
            <button onClick={() => setReturnOpen(true)} className="admin-btn admin-btn-secondary"><LuUndo2 size={15} /> Return to supplier</button>
          )}
          {po.canEditAll && canManage && (
            <button onClick={() => setEditing(true)} className="admin-btn admin-btn-secondary"><LuPencil size={15} /> Edit order</button>
          )}
          {canManage && (
            <button onClick={() => setDetailsOpen(true)} className="admin-btn admin-btn-secondary"><LuFileText size={15} /> Dates &amp; references</button>
          )}
          <span className="flex-1" />
          {s === "PARTIALLY_RECEIVED" && canManage && (
            <button onClick={() => setAction("close")} className="admin-btn admin-btn-secondary" title="The rest will never arrive. Settle on what was delivered">
              <LuLock size={15} /> Close short
            </button>
          )}
          {s === "ORDERED" && !po.hasReceipts && canManage && (
            <button onClick={() => setAction("draft")} className="admin-btn admin-btn-secondary"><LuRotateCcw size={15} /> Back to draft</button>
          )}
          {["DRAFT", "ORDERED"].includes(s) && !po.hasReceipts && canManage && (
            <button onClick={() => setAction("cancel")} className="admin-btn admin-btn-danger"><LuBan size={15} /> Cancel order</button>
          )}
          {s === "DRAFT" && canManage && (
            <button onClick={() => setAction("delete")} className="admin-btn admin-btn-danger"><LuTrash2 size={15} /> Delete draft</button>
          )}
        </div>
      )}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* Timeline + progress */}
          <div className="admin-card p-5">
            <ol className="grid grid-cols-4 gap-2">
              {steps.map((st, i) => (
                <li key={st.label} className="flex flex-col items-center text-center">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      cancelled && i > 0 ? "bg-slate-100 text-slate-300" : st.done ? (st.partial ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700") : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {st.done && !st.partial ? <LuCheck size={15} /> : i + 1}
                  </span>
                  <span className="text-xs font-medium text-slate-700 mt-1">{st.label}</span>
                  <span className="text-[11px] text-slate-400">{st.at ? fmtDate(st.at) : st.partial ? "In progress" : ""}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Received <strong className="font-semibold text-slate-800 tabular-nums">{progress.received} of {progress.ordered}</strong> units
              {progress.received < progress.ordered && ["ORDERED", "PARTIALLY_RECEIVED"].includes(s) && <>, {progress.ordered - progress.received} still to come</>}
              {progress.returned > 0 && <>, {progress.returned} returned to the supplier</>}.
            </p>
          </div>

          {/* Lines */}
          <div className="admin-card">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="font-semibold text-slate-700">Items ({po.items.length})</p>
              <p className="text-xs text-slate-500">{po.pricesIncludeTax ? "Unit costs include VAT" : "Unit costs exclude VAT"}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Ordered</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Returned</th>
                    <th className="text-right">Unit cost</th>
                    <th className="text-right">Disc</th>
                    <th className="text-right">VAT</th>
                    <th className="text-right">Net</th>
                    <th className="text-right">Landed / unit</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((i) => {
                    const done = i.receivedQty >= i.quantity && i.quantity > 0;
                    return (
                      <tr key={i.id}>
                        <td className="min-w-[220px]">
                          <div className="flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {i.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={i.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <LuPackage size={15} className="text-slate-300" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{i.nameEn}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {i.productId ? [i.variantLabel || "Standard", i.barcode || i.sku].filter(Boolean).join(" · ") : "Not a stock item"}
                                {i.onHand != null && ` · ${i.onHand} in stock`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{i.quantity}</td>
                        <td className={`text-right tabular-nums font-medium ${done ? "text-emerald-600" : i.receivedQty > 0 ? "text-amber-600" : "text-slate-400"}`}>{i.receivedQty}</td>
                        <td className="text-right tabular-nums text-slate-500">{i.returnedQty || "-"}</td>
                        <td className="text-right tabular-nums">{fmt3(i.unitCost)}</td>
                        <td className="text-right tabular-nums text-slate-500">{i.discountPct ? `${i.discountPct}%` : "-"}</td>
                        <td className="text-right tabular-nums text-slate-500">
                          {i.taxRate ? `${i.taxRate}%` : "-"}
                          {i.taxAmount > 0 && <span className="block text-[11px]">{fmt3(i.taxAmount)}</span>}
                        </td>
                        <td className="text-right tabular-nums">{fmt3(i.netAmount)}</td>
                        <td className="text-right tabular-nums text-slate-600">{i.productId && i.landedUnitCost != null ? fmt3(i.landedUnitCost) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deliveries */}
          <div className="admin-card">
            <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Deliveries ({po.receipts.length})</p>
            {po.receipts.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-400">Nothing received yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {po.receipts.map((r) => {
                  const labels = labelsLinkFor(r.items);
                  return (
                    <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                      <LuPackageCheck size={18} className="text-emerald-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800">
                          <span className="font-mono">{r.number}</span> · {r.units} unit{r.units === 1 ? "" : "s"} · {fmt3(r.value)} OMR
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtDate(r.receivedAt, true)}
                          {r.createdBy && ` · ${r.createdBy}`}
                          {r.note && ` · ${r.note}`}
                        </p>
                      </div>
                      {labels && (
                        <Link href={labels} className="admin-btn admin-btn-secondary !py-1.5 text-xs"><LuBarcode size={14} /> Labels</Link>
                      )}
                      <button
                        onClick={() => {
                          setPrintReceipt(r);
                          printDoc("grn", r.number);
                        }}
                        className="admin-btn admin-btn-secondary !py-1.5 text-xs"
                      >
                        <LuPrinter size={14} /> GRN
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Returns */}
          {po.returns.length > 0 && (
            <div className="admin-card">
              <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Returned to supplier ({po.returns.length})</p>
              <ul className="divide-y divide-slate-100">
                {po.returns.map((r) => (
                  <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                    <LuUndo2 size={18} className="text-rose-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">
                        <span className="font-mono">{r.number}</span> · {fmt3(r.total)} OMR
                        {r.taxTotal > 0 && <span className="text-slate-400 font-normal"> (incl. {fmt3(r.taxTotal)} VAT)</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmtDate(r.returnedAt)}
                        {r.reason && ` · ${r.reason}`}
                        {r.createdBy && ` · ${r.createdBy}`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPrintReturn(r);
                        printDoc("dn", r.number);
                      }}
                      className="admin-btn admin-btn-secondary !py-1.5 text-xs"
                    >
                      <LuPrinter size={14} /> Debit note
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <TaskList purchaseOrderId={po.id} supplierForNew={{ id: po.supplier.id, nameEn: po.supplier.nameEn, code: po.supplier.code }} canManage={perms.manageSuppliers || perms.managePurchases} compact />

          <div className="admin-card p-5 grid md:grid-cols-2 gap-5">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Notes</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{po.notes || <span className="text-slate-400">No notes.</span>}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Attachments</p>
              <Attachments value={po.attachments} onChange={saveAttachments} canEdit={canManage} />
            </div>
          </div>
        </div>

        {/* Money */}
        <div className="space-y-4 xl:sticky xl:top-4">
          <div className="admin-card p-5 space-y-2 text-sm">
            <h3 className="font-semibold text-slate-800 mb-1">Totals</h3>
            <Line label="Items (excl. VAT)" value={po.subtotal} />
            {po.discount > 0 && <Line label="Order discount" value={-po.discount} />}
            <Line label="VAT" value={po.taxTotal} />
            {po.shippingCost > 0 && <Line label="Freight" value={po.shippingCost} />}
            {po.otherCharges > 0 && <Line label="Other charges" value={po.otherCharges} />}
            <div className="flex justify-between items-baseline border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-800">Total</span>
              <span className="text-lg font-bold tabular-nums">{fmt3(po.total)} OMR</span>
            </div>
            {po.returnedTotal > 0 && <Line label="Returned to supplier" value={-po.returnedTotal} />}
            {po.amountPaid > 0 && <Line label="Paid" value={-po.amountPaid} />}
            {["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(s) && (
              <div className={`flex justify-between items-baseline rounded-xl px-3 py-2 mt-1 ${po.outstanding > 0.0005 ? (po.overdue ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800") : "bg-emerald-50 text-emerald-700"}`}>
                <span className="font-semibold">{po.outstanding > 0.0005 ? "Balance due" : "Fully paid"}</span>
                <span className="font-bold tabular-nums">{fmt3(po.outstanding)}</span>
              </div>
            )}
            <dl className="pt-2 space-y-1 text-xs text-slate-500">
              <div className="flex justify-between"><dt>Expected</dt><dd>{fmtDate(po.expectedDate)}</dd></div>
              <div className="flex justify-between">
                <dt>Payment due</dt>
                <dd className={po.overdue ? "text-rose-600 font-medium" : ""}>
                  {po.dueDate ? fmtDate(po.dueDate) : po.supplier.paymentTermsDays ? `${po.supplier.paymentTermsDays} days after delivery` : "On delivery"}
                  {po.overdue && ` · ${po.daysOverdue}d late`}
                </dd>
              </div>
              <div className="flex justify-between"><dt>Supplier invoice</dt><dd>{po.supplierReference || "-"}{po.invoiceDate ? ` · ${fmtDate(po.invoiceDate)}` : ""}</dd></div>
            </dl>
          </div>

          <div className="admin-card">
            <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Payments ({po.payments.length})</p>
            {po.payments.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {po.payments.map((p) => (
                  <li key={p.allocationId} className="px-4 py-2.5 flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-slate-700">{p.payment.number}</span>
                      <span className="block text-xs text-slate-500">
                        {fmtDate(p.payment.paidAt)} · {methodText(p.payment.method)}
                        {p.payment.reference && ` · ${p.payment.reference}`}
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold text-emerald-700 shrink-0">{fmt3(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="admin-card p-4 text-sm">
            <p className="font-semibold text-slate-700 mb-1">{po.supplier.nameEn}</p>
            <p className="text-xs text-slate-500">
              {po.supplier.code}
              {po.supplier.contactPerson && ` · ${po.supplier.contactPerson}`}
              {po.supplier.phone && ` · ${po.supplier.phone}`}
            </p>
            <p className="text-xs mt-2">
              Account balance:{" "}
              <span className={`font-semibold tabular-nums ${po.supplier.balance > 0.0005 ? "text-rose-600" : po.supplier.balance < -0.0005 ? "text-emerald-600" : "text-slate-500"}`}>
                {po.supplier.balance < -0.0005 ? `${fmt3(-po.supplier.balance)} credit` : `${fmt3(po.supplier.balance)} owed`}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ReceiveModal open={receiveOpen} po={po} onClose={() => setReceiveOpen(false)} onDone={(r) => { setJustReceived(r); load(); }} />
      <ReturnToSupplierModal open={returnOpen} po={po} canRefund={perms.pay} onClose={() => setReturnOpen(false)} onDone={() => load()} />
      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        supplier={{ id: po.supplier.id, nameEn: po.supplier.nameEn, code: po.supplier.code, balance: po.supplier.balance }}
        purchaseOrderId={po.id}
        onDone={load}
      />
      <DetailsModal open={detailsOpen} po={po} onClose={() => setDetailsOpen(false)} onSaved={() => { setDetailsOpen(false); load(); }} />
      <ActionModal
        open={action !== null}
        title={
          action === "order" ? `Place ${po.number}?` : action === "cancel" ? `Cancel ${po.number}?` : action === "close" ? `Close ${po.number} short?` : action === "draft" ? `Back to draft?` : `Delete ${po.number}?`
        }
        danger={action === "cancel" || action === "delete"}
        askReason={action === "cancel" || action === "close"}
        confirmLabel={action === "order" ? "Place order" : action === "cancel" ? "Cancel order" : action === "close" ? "Close short" : action === "draft" ? "Make draft" : "Delete"}
        body={
          action === "order" ? (
            <p>The order becomes money owed to {po.supplier.nameEn} ({fmt3(po.total)} OMR) and waits for delivery.</p>
          ) : action === "cancel" ? (
            <p>Nothing has been received. The order is no longer owed{po.amountPaid > 0 ? ` and the ${fmt3(po.amountPaid)} OMR paid on it stays as credit with the supplier` : ""}.</p>
          ) : action === "close" ? (
            <p className="flex gap-2">
              <LuTriangleAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
              {progress.ordered - progress.received} unit(s) will never arrive. The order is settled on what was delivered and its total drops accordingly.
            </p>
          ) : action === "draft" ? (
            <p>The order stops being owed to the supplier until it is placed again.</p>
          ) : (
            <p>The draft is deleted permanently.</p>
          )
        }
        onClose={() => setAction(null)}
        onConfirm={(reason) => (action ? runAction(action, reason) : undefined)}
      />

      {/* Printable documents */}
      <PrintArea id="purchase-po">
        <PurchaseOrderDoc po={printable} header={header} />
      </PrintArea>
      {printReceipt && (
        <PrintArea id="purchase-grn">
          <GoodsReceiptDoc po={printable} receipt={printReceipt} header={header} />
        </PrintArea>
      )}
      {printReturn && (
        <PrintArea id="purchase-dn">
          <DebitNoteDoc
            header={header}
            ret={{
              number: printReturn.number,
              returnedAt: printReturn.returnedAt,
              subtotal: printReturn.subtotal,
              taxTotal: printReturn.taxTotal,
              total: printReturn.total,
              reason: printReturn.reason,
              purchaseOrder: { number: po.number },
              createdBy: printReturn.createdBy,
              items: returnItems(printReturn.items),
              supplier: printable.supplier,
            }}
          />
        </PrintArea>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums">{value < 0 ? `−${fmt3(-value)}` : fmt3(value)}</span>
    </div>
  );
}

/** References, dates and notes — editable at any stage. */
function DetailsModal({ open, po, onClose, onSaved }: { open: boolean; po: PoDetailData; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ supplierReference: "", invoiceDate: "", expectedDate: "", dueDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    setF({
      supplierReference: po.supplierReference ?? "",
      invoiceDate: po.invoiceDate ?? "",
      expectedDate: po.expectedDate ?? "",
      dueDate: po.dueDate ?? "",
      notes: po.notes ?? "",
    });
    setErr("");
  }, [open, po]);
  const cancelled = po.status === "CANCELLED";
  const submit = async () => {
    setSaving(true);
    const body = cancelled
      ? { notes: f.notes || null }
      : {
          supplierReference: f.supplierReference || null,
          invoiceDate: f.invoiceDate || null,
          expectedDate: f.expectedDate || null,
          dueDate: f.dueDate || null,
          notes: f.notes || null,
        };
    const d = await api(`/api/purchases/${po.id}`, { method: "PATCH", body });
    setSaving(false);
    if (!d.success) return setErr(d.error || "Could not save");
    toast.success("Saved");
    onSaved();
  };
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Dates & references · ${po.number}`}
      className="!max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="admin-btn admin-btn-primary">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Supplier invoice no.">
          <input className="admin-input" disabled={cancelled} value={f.supplierReference} onChange={(e) => setF({ ...f, supplierReference: e.target.value })} />
        </Field>
        <Field label="Invoice date">
          <input type="date" className="admin-input" disabled={cancelled} value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} />
        </Field>
        <Field label="Expected delivery">
          <input type="date" className="admin-input" disabled={cancelled} value={f.expectedDate} onChange={(e) => setF({ ...f, expectedDate: e.target.value })} />
        </Field>
        <Field label="Payment due">
          <input type="date" className="admin-input" disabled={cancelled} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea className="admin-input min-h-[90px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      {err && <p className="text-sm text-rose-600 mt-3">{err}</p>}
      {!po.canEditAll && !cancelled && (
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
          <LuCircleCheck size={13} /> Goods have been received, so items and prices are locked. Return goods to the supplier to correct them.
        </p>
      )}
    </AdminModal>
  );
}
