"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuArrowRightLeft, LuLoaderCircle, LuMinus, LuPlus, LuScanBarcode, LuTrash2 } from "react-icons/lu";
import { omr } from "@/components/pos/PosUi";

// Exchange step of the return dialog: the replacement items, the live balance
// (credit for what comes back vs. price of what goes out) and how the
// difference is settled. All figures come from the server (dry run) so they
// match the final sale exactly, offers and VAT included.

type LookupLine = {
  productId: string;
  variantId: string | null;
  nameEn: string;
  color: string | null;
  size: string | null;
  unitPrice: number;
  stock: number | null;
  imageUrl: string | null;
};
type NewLine = LookupLine & { quantity: number };

export type ExchangeResult = {
  order: Record<string, unknown> & { orderNumber: string; invoiceNumber?: string | null };
  refund: Record<string, unknown> & { creditNoteNumber: string | null; amount: number; taxAmount: number };
  credit: number;
  newTotal: number;
  difference: number;
  direction: "CUSTOMER_PAYS" | "STORE_PAYS" | "EVEN";
  changeGiven: number | null;
  settlementMethod: string;
};

type Quote = {
  credit: number;
  newTotal: number;
  newTax: number;
  promotionDiscount: number;
  appliedPromotions: { nameEn: string; discount: number }[];
  difference: number;
  direction: "CUSTOMER_PAYS" | "STORE_PAYS" | "EVEN";
};

const keyOf = (l: { variantId: string | null; productId: string }) => l.variantId || l.productId;
const label = (l: { color: string | null; size: string | null }) => [l.color, l.size].filter(Boolean).join(" / ") || "Standard";
const METHODS = [
  ["CASH", "Cash"],
  ["CARD", "Card"],
  ["BANK_TRANSFER", "Bank transfer"],
] as const;

export default function ExchangePanel({
  orderId,
  returnItems,
  restock,
  reason,
  onDone,
}: {
  orderId: string;
  returnItems: { orderItemId: string; quantity: number }[];
  restock: boolean;
  reason: string;
  onDone: (r: ExchangeResult) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<LookupLine[]>([]);
  const [lines, setLines] = useState<NewLine[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [method, setMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Product search for the replacement items.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/pos/lookup?q=${encodeURIComponent(term)}&inStock=true`)
        .then((r) => r.json())
        .then((d) => setHits(d.success ? (d.data as LookupLine[]).slice(0, 10) : []))
        .catch(() => setHits([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const inSale = (k: string) => lines.find((l) => keyOf(l) === k)?.quantity ?? 0;
  const add = (l: LookupLine) => {
    if (l.stock !== null && inSale(keyOf(l)) >= l.stock) return setErr(`Only ${l.stock} of ${l.nameEn} (${label(l)}) in stock.`);
    setErr("");
    setLines((prev) => {
      const k = keyOf(l);
      return prev.some((x) => keyOf(x) === k) ? prev.map((x) => (keyOf(x) === k ? { ...x, quantity: x.quantity + 1 } : x)) : [...prev, { ...l, quantity: 1 }];
    });
    setQ("");
    setHits([]);
    inputRef.current?.focus();
  };
  const setQty = (k: string, n: number) =>
    setLines((prev) =>
      n <= 0 ? prev.filter((x) => keyOf(x) !== k) : prev.map((x) => (keyOf(x) === k ? { ...x, quantity: x.stock === null ? n : Math.min(n, x.stock) } : x)),
    );

  // A scanner sends the code + Enter: add that exact item.
  const onEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = q.trim();
    if (!code) return;
    const d = await fetch(`/api/pos/lookup?barcode=${encodeURIComponent(code)}`).then((r) => r.json()).catch(() => null);
    const found: LookupLine[] = d?.success ? d.data : [];
    if (found.length === 1) return add(found[0]);
    if (found.length > 1) return setHits(found);
    if (hits.length === 1) return add(hits[0]);
    setErr(`No item found for "${code}".`);
  };

  // Live balance from the server.
  const body = useMemo(
    () => ({
      orderId,
      returnItems,
      newItems: lines.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: l.quantity })),
      restock,
      reason: reason || undefined,
    }),
    [orderId, returnItems, lines, restock, reason],
  );
  useEffect(() => {
    if (returnItems.length === 0 || lines.length === 0) {
      setQuote(null);
      return;
    }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(() => {
      fetch("/api/pos/exchanges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, dryRun: true }) })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (d.success) {
            setQuote(d.data);
            setErr("");
          } else {
            setQuote(null);
            setErr(d.error || "Could not work out the exchange.");
          }
        })
        .catch(() => {})
        .finally(() => alive && setQuoting(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [body, returnItems.length, lines.length]);

  const owed = quote ? Math.abs(quote.difference) : 0;
  const tenderedNum = parseFloat(tendered) || 0;
  const change = quote?.direction === "CUSTOMER_PAYS" && method === "CASH" && tendered !== "" ? tenderedNum - owed : null;
  const canSubmit =
    !!quote && !busy && !quoting && returnItems.length > 0 && lines.length > 0 && (change === null || change >= -0.0005);

  const submit = async () => {
    if (!canSubmit || !quote) return;
    setBusy(true);
    setErr("");
    const d = await fetch("/api/pos/exchanges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        settlementMethod: method,
        amountTendered: quote.direction === "CUSTOMER_PAYS" && method === "CASH" && tendered !== "" ? tenderedNum : undefined,
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!d?.success) return setErr(d?.error || "The exchange failed. Nothing was changed.");
    onDone({ ...d.data, settlementMethod: method });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-1.5">Replacement items</p>
        <form onSubmit={onEnter} className="relative">
          <LuScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scan or search the item the customer takes instead"
            className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          {hits.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg ring-1 ring-slate-200 max-h-72 overflow-y-auto">
              {hits.map((h) => {
                const left = h.stock === null ? null : h.stock - inSale(keyOf(h));
                return (
                  <li key={keyOf(h)}>
                    <button type="button" onClick={() => add(h)} disabled={left !== null && left <= 0} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-40">
                      <span className="w-9 h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {h.imageUrl && <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-800 truncate">{h.nameEn}</span>
                        <span className="block text-xs text-slate-500">{label(h)} · {left === null ? "not stock-tracked" : `${left} in stock`}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-slate-800">{h.unitPrice.toFixed(3)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </form>
      </div>

      {lines.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {lines.map((l) => (
            <li key={keyOf(l)} className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50/50">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 truncate">{l.nameEn}</p>
                <p className="text-xs text-slate-500">{label(l)} · {l.unitPrice.toFixed(3)} each{l.stock !== null && ` · ${l.stock} in stock`}</p>
              </div>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white shrink-0">
                <button onClick={() => setQty(keyOf(l), l.quantity - 1)} className="w-9 h-9 flex items-center justify-center text-slate-500" aria-label="One less"><LuMinus size={14} /></button>
                <span className="w-8 text-center font-semibold tabular-nums">{l.quantity}</span>
                <button onClick={() => setQty(keyOf(l), l.quantity + 1)} disabled={l.stock !== null && l.quantity >= l.stock} className="w-9 h-9 flex items-center justify-center text-slate-500 disabled:opacity-30" aria-label="One more"><LuPlus size={14} /></button>
              </div>
              <button onClick={() => setQty(keyOf(l), 0)} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove"><LuTrash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      {/* Balance */}
      <div className="rounded-2xl bg-slate-50 p-4 space-y-1.5 text-sm">
        {returnItems.length === 0 ? (
          <p className="text-slate-500">Choose above which items are coming back.</p>
        ) : lines.length === 0 ? (
          <p className="text-slate-500">Add the item(s) the customer takes instead.</p>
        ) : !quote ? (
          <p className="flex items-center gap-2 text-slate-500"><LuLoaderCircle size={15} className="animate-spin" /> Working out the balance…</p>
        ) : (
          <>
            <div className="flex justify-between text-slate-600"><span>Credit for returned items</span><span className="tabular-nums">{quote.credit.toFixed(3)}</span></div>
            <div className="flex justify-between text-slate-600"><span>New items{quote.promotionDiscount > 0 ? ` (after ${quote.promotionDiscount.toFixed(3)} offers)` : ""}</span><span className="tabular-nums">{quote.newTotal.toFixed(3)}</span></div>
            {quote.newTax > 0 && <div className="flex justify-between text-xs text-slate-400"><span>Includes VAT</span><span className="tabular-nums">{quote.newTax.toFixed(3)}</span></div>}
            <div
              className={`flex justify-between items-center rounded-xl px-3 py-2.5 mt-2 font-semibold ${
                quote.direction === "CUSTOMER_PAYS" ? "bg-amber-100 text-amber-900" : quote.direction === "STORE_PAYS" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-800"
              }`}
            >
              <span className="flex items-center gap-2">
                <LuArrowRightLeft size={16} />
                {quote.direction === "CUSTOMER_PAYS" ? "Customer pays the difference" : quote.direction === "STORE_PAYS" ? "Pay the difference back to the customer" : "Even exchange, nothing to pay"}
              </span>
              {quote.direction !== "EVEN" && <span className="text-lg tabular-nums">{omr(owed)}</span>}
            </div>
          </>
        )}
      </div>

      {quote && quote.direction !== "EVEN" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">{quote.direction === "CUSTOMER_PAYS" ? "Customer pays by" : "Pay back by"}</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(([m, name]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-xl py-2.5 text-sm font-medium transition ${method === m ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {quote.direction === "CUSTOMER_PAYS" && method === "CASH" && (
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder={`Cash received, e.g. ${Math.ceil(owed)}`}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5"
              />
              {change !== null && (
                <span className={`text-sm font-semibold ${change < -0.0005 ? "text-rose-600" : "text-emerald-700"}`}>
                  {change < -0.0005 ? `Short ${omr(-change)}` : `Change ${omr(change)}`}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {err && <p className="text-rose-600 text-sm">{err}</p>}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {busy ? (
          <LuLoaderCircle className="animate-spin" />
        ) : (
          <>
            <LuArrowRightLeft size={18} /> Complete exchange
            {quote && quote.direction === "CUSTOMER_PAYS" && ` · collect ${omr(owed)}`}
            {quote && quote.direction === "STORE_PAYS" && ` · pay back ${omr(owed)}`}
          </>
        )}
      </button>
    </div>
  );
}
