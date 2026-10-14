"use client";
import { useEffect } from "react";
import { LuX } from "react-icons/lu";

export const omr = (n: number) => `${n.toFixed(3)} OMR`;

/** Short confirmation / error tones so the cashier can scan without looking. */
export function beep(kind: "ok" | "error" = "ok") {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "ok" ? 1320 : 220;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "ok" ? 0.09 : 0.25));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    /* audio is a nicety — ignore */
  }
}

export function PosModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] pos-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${width} bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] pos-pop-in`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 -m-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Close">
            <LuX size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export type ReceiptData = {
  orderNumber: string;
  items: { name: string; nameAr?: string; variant: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  payments: { method: string; amount: number }[];
  amountTendered: number | null;
  changeGiven: number | null;
  cashierName: string;
  customerName?: string;
  createdAt: string;
  title?: string;
};

export type StoreInfo = { store_name_en?: string; store_name_ar?: string; store_address?: string; store_phone?: string };

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Bank transfer", STORE_CREDIT: "Store credit" };
export const methodLabel = (m: string) => METHOD_LABEL[m] ?? m;

/** 80mm thermal-printer friendly receipt; it's the only thing that prints. */
export function Receipt({ data, store }: { data: ReceiptData; store: StoreInfo }) {
  return (
    <div className="pos-receipt w-full max-w-[340px] bg-white rounded-2xl shadow-sm border border-slate-200 p-5 font-mono text-[13px] text-slate-800">
      <div className="text-center mb-3">
        <p className="font-bold text-base">{store.store_name_en || "Hala Dresses"}</p>
        {store.store_name_ar && <p className="text-sm" dir="rtl">{store.store_name_ar}</p>}
        {store.store_address && <p className="text-slate-500 text-xs">{store.store_address}</p>}
        {store.store_phone && <p className="text-slate-500 text-xs">{store.store_phone}</p>}
        {data.title && <p className="mt-2 font-semibold uppercase tracking-wider">{data.title}</p>}
      </div>
      <div className="border-t border-dashed border-slate-300 my-2" />
      <p>No: {data.orderNumber}</p>
      <p>Date: {new Date(data.createdAt).toLocaleString("en-GB")}</p>
      <p>Cashier: {data.cashierName}</p>
      {data.customerName && <p>Customer: {data.customerName}</p>}
      <div className="border-t border-dashed border-slate-300 my-2" />
      {data.items.map((it, i) => (
        <div key={i} className="mb-1.5">
          <div className="flex justify-between gap-2">
            <span className="min-w-0 break-words">{it.name}</span>
            <span className="shrink-0">{it.total.toFixed(3)}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {[it.variant, `${it.quantity} × ${it.unitPrice.toFixed(3)}`].filter(Boolean).join(" · ")}
          </div>
        </div>
      ))}
      <div className="border-t border-dashed border-slate-300 my-2" />
      <Row label="Subtotal" value={data.subtotal} />
      {data.discount > 0 && <Row label="Discount" value={-data.discount} />}
      <div className="flex justify-between font-bold text-base mt-1">
        <span>TOTAL</span>
        <span>{omr(data.total)}</span>
      </div>
      <div className="border-t border-dashed border-slate-300 my-2" />
      {data.payments.map((p, i) => (
        <Row key={i} label={methodLabel(p.method)} value={p.amount} />
      ))}
      {data.amountTendered != null && <Row label="Cash tendered" value={data.amountTendered} />}
      {data.changeGiven != null && data.changeGiven > 0 && <Row label="Change" value={data.changeGiven} bold />}
      <div className="border-t border-dashed border-slate-300 my-2" />
      <p className="text-center text-xs text-slate-500">Thank you for shopping with us!</p>
      <p className="text-center text-xs text-slate-500" dir="rtl">شكراً لتسوقكم معنا</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value.toFixed(3)}</span>
    </div>
  );
}
