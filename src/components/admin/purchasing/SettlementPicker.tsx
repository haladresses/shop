"use client";
import { Field, PAYMENT_METHOD_OPTIONS } from "./shared";

/** How a return to a supplier is settled: credit on our account, or the supplier refunds the money. */
export default function SettlementPicker({
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
          ["REFUND", "Supplier refunded the money", "They paid it back. Recorded as a refund received."],
        ] as const).map(([k, title, hint]) => (
          <button
            key={k}
            type="button"
            disabled={k === "REFUND" && !canRefund}
            onClick={() => onChange(k)}
            className={`text-left rounded-xl px-3 py-2.5 ring-1 transition ${value === k ? "ring-indigo-400 bg-indigo-50/60" : "ring-slate-200 hover:ring-slate-300"} disabled:opacity-40`}
            title={k === "REFUND" && !canRefund ? "Needs the Supplier Payments permission" : undefined}
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
