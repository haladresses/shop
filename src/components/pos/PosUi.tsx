"use client";
import { useEffect } from "react";
import { LuX } from "react-icons/lu";
import { SaleDocument } from "@/components/print/SaleDocument";
import type { InvoiceData, StoreInfo } from "@/lib/invoice";
import type { TaxSettings } from "@/lib/taxCalc";

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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
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

export type { StoreInfo } from "@/lib/invoice";
/** A printed bill (sale or credit note) — see lib/invoice.ts. */
export type ReceiptData = InvoiceData;

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Bank transfer", STORE_CREDIT: "Store credit" };
export const methodLabel = (m: string) => METHOD_LABEL[m] ?? m;

type TaxInfo = Pick<TaxSettings, "enabled" | "vatNumber" | "legalNameEn" | "legalNameAr" | "crNumber" | "invoiceFooterEn" | "invoiceFooterAr">;

/**
 * On-screen preview of the 80 mm bilingual (English + Arabic) receipt. Print
 * it by rendering the same <SaleDocument> inside a <PrintArea> and calling
 * printArea(id, { page: "receipt" }).
 */
export function Receipt({ data, store, tax }: { data: InvoiceData; store: StoreInfo; tax: TaxInfo }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 overflow-x-auto">
      <div className="mx-auto w-fit">
        <SaleDocument data={data} store={store} tax={tax} layout="thermal" />
      </div>
    </div>
  );
}
