"use client";
import { useReport } from "./ReportContext";

/** Letterhead + footer for printed reports — black on white, English and Arabic. */
export function PrintFrame({ title, titleAr, subtitle, children }: { title: string; titleAr: string; subtitle?: string; children: React.ReactNode }) {
  const { store, periodLabel, filtersLabel } = useReport();
  const printed = new Date().toLocaleString("en-GB", { timeZone: "Asia/Muscat", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="bg-white text-black" style={{ fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif', fontSize: 10.5, lineHeight: 1.35 }}>
      <div className="flex items-start justify-between gap-6 pb-2" style={{ borderBottom: "2px solid #000" }}>
        <div>
          <div className="text-[15px] font-bold">{store.store_name_en || "Hala Dresses"}</div>
          {store.store_address && <div>{store.store_address}</div>}
          {store.store_phone && <div>Tel: {store.store_phone}</div>}
        </div>
        <div className="text-right" dir="rtl">
          <div className="text-[15px] font-bold">{store.store_name_ar || store.store_name_en || ""}</div>
          {store.store_address && <div>{store.store_address}</div>}
        </div>
      </div>
      <div className="text-center my-2">
        <div className="text-[14px] font-bold uppercase tracking-wide">{title}</div>
        <div className="text-[14px] font-bold" dir="rtl">{titleAr}</div>
        <div>
          Period / <span dir="rtl">الفترة</span>: <strong>{periodLabel}</strong>
          {subtitle ? ` · ${subtitle}` : ""}
        </div>
        {filtersLabel && <div>Filters / <span dir="rtl">عوامل التصفية</span>: {filtersLabel}</div>}
      </div>
      {children}
      <div className="mt-3 pt-1 flex justify-between text-[9px]" style={{ borderTop: "1px solid #000" }}>
        <span>Printed {printed} (Asia/Muscat) · Amounts in OMR</span>
        <span dir="rtl">جميع المبالغ بالريال العماني</span>
      </div>
    </div>
  );
}

/** Plain bordered table for print. */
export function PrintTable({
  head,
  rows,
  foot,
  align,
}: {
  head: { en: string; ar?: string }[];
  rows: (string | number)[][];
  foot?: (string | number)[];
  /** per column: "l" | "r" | "c" */
  align?: ("l" | "r" | "c")[];
}) {
  const cls = (i: number) => (align?.[i] === "r" ? "text-right" : align?.[i] === "c" ? "text-center" : "text-left");
  const cell = "border border-black px-1 py-0.5 align-top";
  return (
    <table className="w-full border-collapse tabular-nums" style={{ fontSize: 9.5 }}>
      <thead style={{ background: "#e5e5e5", display: "table-header-group" }}>
        <tr>
          {head.map((h, i) => (
            <th key={i} className={`${cell} ${cls(i)} font-bold`}>
              {h.en}
              {h.ar && <div dir="rtl" className="font-normal">{h.ar}</div>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="print-avoid-break">
            {r.map((c, j) => (
              <td key={j} className={`${cell} ${cls(j)}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr style={{ background: "#f0f0f0" }}>
            {foot.map((c, j) => (
              <td key={j} className={`${cell} ${cls(j)} font-bold`}>{c}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
