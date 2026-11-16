"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LuDownload, LuPrinter } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import { SupplierStatementDoc, type PrintableStatement } from "./PrintDocs";
import { addDaysKey, api, fmt3, fmtDate, todayKey, useDocHeader } from "./shared";

type Statement = Omit<PrintableStatement, "entries"> & {
  entries: (PrintableStatement["entries"][number] & { link: string | null })[];
};

const TYPE_LABEL: Record<string, string> = {
  OPENING: "Opening balance",
  PURCHASE: "Purchase",
  RETURN: "Return",
  PAYMENT: "Payment",
  REFUND: "Refund received",
};

const bal = (n: number) => (n < -0.0005 ? `${fmt3(-n)} CR` : fmt3(n));

/** Account statement with running balance — printable bilingual A4. */
export default function StatementView({ supplierId }: { supplierId: string }) {
  const header = useDocHeader();
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [st, setSt] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);

  const applyPreset = (p: string) => {
    setPreset(p);
    const today = todayKey();
    if (p === "all") {
      setFrom("");
      setTo("");
    } else if (p === "month") {
      setFrom(`${today.slice(0, 7)}-01`);
      setTo(today);
    } else if (p === "90") {
      setFrom(addDaysKey(today, -89));
      setTo(today);
    } else if (p === "year") {
      setFrom(`${today.slice(0, 4)}-01-01`);
      setTo(today);
    }
  };

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api<Statement>(`/api/suppliers/${supplierId}/statement?${p}`).then((d) => {
      if (d.success && d.data) setSt(d.data);
      setLoading(false);
    });
  }, [supplierId, from, to]);

  const exportCsv = () => {
    if (!st) return;
    const cell = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      ["Date", "Type", "Document", "Description", "Debit", "Credit", "Balance"].join(","),
      ...(st.from ? [["", "", "", "Brought forward", "", "", st.broughtForward.toFixed(3)].map(cell).join(",")] : []),
      ...st.entries.map((e) =>
        [e.date.slice(0, 10), TYPE_LABEL[e.type] ?? e.type, e.number ?? "", e.description, e.debit ? e.debit.toFixed(3) : "", e.credit ? e.credit.toFixed(3) : "", e.balance.toFixed(3)]
          .map(cell)
          .join(","),
      ),
    ];
    const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `statement-${st.supplier.code}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="admin-card">
      <div className="p-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            ["all", "All time"],
            ["month", "This month"],
            ["90", "Last 90 days"],
            ["year", "This year"],
            ["custom", "Custom"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => (id === "custom" ? setPreset("custom") : applyPreset(id))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="admin-input !py-1.5 text-sm !w-auto" aria-label="From" />
            <span className="text-slate-400 text-sm">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="admin-input !py-1.5 text-sm !w-auto" aria-label="To" />
          </div>
        )}
        <span className="flex-1" />
        <button onClick={exportCsv} disabled={!st} className="admin-btn admin-btn-secondary !py-1.5 text-sm"><LuDownload size={14} /> CSV</button>
        <button
          onClick={() => printArea("supplier-statement", { page: "a4", title: st ? `Statement ${st.supplier.code}` : "Statement" })}
          disabled={!st}
          className="admin-btn admin-btn-primary !py-1.5 text-sm"
        >
          <LuPrinter size={14} /> Print statement
        </button>
      </div>
      {loading && !st ? (
        <div className="flex justify-center py-12"><span className="spinner" /></div>
      ) : !st ? (
        <p className="px-4 py-8 text-center text-slate-400 text-sm">Could not load the statement.</p>
      ) : (
        <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
          <table className="admin-table min-w-[760px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Document</th>
                <th>Description</th>
                <th className="text-right">Debit (owed)</th>
                <th className="text-right">Credit (paid)</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {st.from && (
                <tr className="bg-slate-50">
                  <td className="text-sm">{fmtDate(st.from)}</td>
                  <td colSpan={3} className="text-sm font-medium text-slate-600">Brought forward</td>
                  <td />
                  <td />
                  <td className="text-right tabular-nums font-semibold">{bal(st.broughtForward)}</td>
                </tr>
              )}
              {st.entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-8">No transactions in this period.</td>
                </tr>
              )}
              {st.entries.map((e, i) => (
                <tr key={`${e.number}-${i}`}>
                  <td className="text-sm whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="text-sm">{TYPE_LABEL[e.type] ?? e.type}</td>
                  <td className="font-mono text-xs">
                    {e.link && e.number ? <Link href={e.link} className="text-indigo-600 hover:underline">{e.number}</Link> : e.number ?? "—"}
                  </td>
                  <td className="text-sm text-slate-600 max-w-[320px]">{e.description}</td>
                  <td className="text-right tabular-nums">{e.debit ? fmt3(e.debit) : ""}</td>
                  <td className="text-right tabular-nums text-emerald-700">{e.credit ? fmt3(e.credit) : ""}</td>
                  <td className={`text-right tabular-nums font-semibold ${e.balance < -0.0005 ? "text-emerald-700" : ""}`}>{bal(e.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right text-sm font-semibold text-slate-600">Totals for the period</td>
                <td className="text-right tabular-nums font-semibold">{fmt3(st.totals.debit)}</td>
                <td className="text-right tabular-nums font-semibold text-emerald-700">{fmt3(st.totals.credit)}</td>
                <td className="text-right tabular-nums font-bold">{bal(st.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="px-4 py-2 text-xs text-slate-400">Positive balance = we owe the supplier · CR = credit in our favour.</p>
        </div>
      )}
      {st && (
        <PrintArea id="supplier-statement">
          <SupplierStatementDoc st={st} header={header} />
        </PrintArea>
      )}
    </div>
  );
}
