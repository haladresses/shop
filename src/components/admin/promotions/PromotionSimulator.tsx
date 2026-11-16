"use client";
import { useEffect, useMemo, useState } from "react";
import { LuFlaskConical, LuLightbulb, LuMinus, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu";
import { applyPromotions, isPromotionLive, type PromotionRule } from "@/lib/promotionEngine";
import { fetchJson, omr, type PickerProduct } from "./shared";

type SimLine = { product: PickerProduct; quantity: number; price: string };

/**
 * "Try it": build a sample basket and run the draft promotion through the
 * real engine (the same code the checkout and POS use) to see exactly what
 * the customer would save.
 */
export default function PromotionSimulator({
  rule,
  ancestry,
  suggestions,
}: {
  rule: PromotionRule | null;
  ancestry: Map<string, string[]>;
  /** Products already on the promotion — offered as one-tap additions. */
  suggestions: PickerProduct[];
}) {
  const [lines, setLines] = useState<SimLine[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [channel, setChannel] = useState<"ONLINE" | "POS">("ONLINE");
  const [ignoreSchedule, setIgnoreSchedule] = useState(true);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const d = await fetchJson<{ items: PickerProduct[] }>(`/api/promotions/products?search=${encodeURIComponent(q.trim())}&pageSize=8`);
      setResults(d.data?.items ?? []);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const add = (p: PickerProduct) => {
    setLines((prev) => {
      const ex = prev.find((l) => l.product.id === p.id);
      if (ex) return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { product: p, quantity: 1, price: p.price.toFixed(3) }];
    });
    setQ("");
    setResults([]);
  };

  const simRule = useMemo<PromotionRule | null>(() => {
    if (!rule) return null;
    return ignoreSchedule
      ? { ...rule, isActive: true, startsAt: null, endsAt: null, daysOfWeek: null, startTime: null, endTime: null, usageLimit: null, channel: "ALL" }
      : rule;
  }, [rule, ignoreSchedule]);

  const result = useMemo(() => {
    if (!simRule || lines.length === 0) return null;
    const input = lines.map((l) => ({
      productId: l.product.id,
      categoryIds: ancestry.get(l.product.categoryId) ?? [l.product.categoryId],
      unitPrice: Math.max(0, parseFloat(l.price) || 0),
      quantity: l.quantity,
      onSale: l.product.onSale,
    }));
    const r = applyPromotions(input, [simRule], channel);
    const before = input.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return { ...r, before, after: before - r.total };
  }, [simRule, lines, ancestry, channel]);

  const notLive = rule && !ignoreSchedule && !isPromotionLive({ ...rule, isActive: true }, channel);
  const quick = suggestions.filter((s) => !lines.some((l) => l.product.id === s.id)).slice(0, 4);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
          <LuFlaskConical size={16} />
        </span>
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Try it</h3>
          <p className="text-[11px] text-slate-400">Build a sample basket to see the saving.</p>
        </div>
      </div>

      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input className="admin-input !pl-9 !py-2 text-sm" placeholder="Add a product…" value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg ring-1 ring-slate-200 max-h-64 overflow-y-auto">
            {results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => add(p)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50">
                  <span className="text-sm text-slate-700 truncate">{p.nameEn}</span>
                  <span className="text-xs text-slate-500 tabular-nums shrink-0">{p.price.toFixed(3)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((p) => (
            <button key={p.id} type="button" onClick={() => add(p)} className="rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] text-slate-600 max-w-[160px] truncate">
              + {p.nameEn}
            </button>
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {lines.map((l, i) => {
            const saving = result?.lineDiscounts[i] ?? 0;
            return (
              <li key={l.product.id} className="px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{l.product.nameEn}</span>
                  <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-1 text-slate-300 hover:text-rose-500" aria-label="Remove">
                    <LuTrash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-slate-200">
                    <button type="button" className="w-7 h-7 flex items-center justify-center text-slate-500" onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))} aria-label="Fewer">
                      <LuMinus size={12} />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.quantity}</span>
                    <button type="button" className="w-7 h-7 flex items-center justify-center text-slate-500" onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x)))} aria-label="More">
                      <LuPlus size={12} />
                    </button>
                  </div>
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={l.price}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                    className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right tabular-nums"
                    aria-label="Unit price"
                  />
                  <span className={`ml-auto text-xs font-semibold tabular-nums ${saving > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                    {saving > 0 ? `−${saving.toFixed(3)}` : "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(["ONLINE", "POS"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setChannel(c)} className={`px-2.5 py-1 ${channel === c ? "bg-slate-800 text-white" : "bg-white text-slate-500"}`}>
              {c === "ONLINE" ? "Online" : "POS"}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" className="rounded" checked={ignoreSchedule} onChange={(e) => setIgnoreSchedule(e.target.checked)} />
          Ignore schedule
        </label>
      </div>

      {!rule && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Finish the rule above to try it.</p>}
      {notLive && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">With its schedule/channel this promotion isn&apos;t running right now.</p>}

      {result && (
        <div className="rounded-xl bg-slate-50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Basket</span>
            <span className="tabular-nums">{omr(result.before)}</span>
          </div>
          <div className="flex justify-between font-medium text-emerald-700">
            <span>Promotion saves</span>
            <span className="tabular-nums">−{omr(result.total)}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
            <span>Customer pays</span>
            <span className="tabular-nums">{omr(result.after)}</span>
          </div>
          {result.applied[0] && (
            <p className="text-[11px] text-slate-500">
              Applied {result.applied[0].applications}× on {result.applied[0].units} item{result.applied[0].units === 1 ? "" : "s"}
            </p>
          )}
          {result.hints.map((h, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] text-indigo-700">
              <LuLightbulb size={13} className="shrink-0 mt-px" /> {h.messageEn}
            </p>
          ))}
          {result.total === 0 && result.hints.length === 0 && (
            <p className="text-[11px] text-slate-500">No saving for this basket — check the qualifying items and quantities.</p>
          )}
        </div>
      )}
    </div>
  );
}
