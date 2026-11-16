"use client";
import { fmt3, fmtDate, methodText, type DocHeaderInfo } from "./shared";

// Bilingual (English + Arabic) A4 documents for printing via <PrintArea>.
// Plain black-on-white, tabular numbers, 3-decimal OMR.

const AR_METHOD: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CASH: "نقداً",
  CHEQUE: "شيك",
  CARD: "بطاقة",
  OTHER: "أخرى",
};

/** English label with its Arabic translation under it. */
export function Bi({ en, ar, className = "", align = "left" }: { en: string; ar: string; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <span className={`block leading-tight ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""} ${className}`}>
      <span className="block">{en}</span>
      <span className="block text-[0.85em] opacity-80" dir="rtl" lang="ar" style={{ textAlign: align === "left" ? "left" : align }}>
        {ar}
      </span>
    </span>
  );
}

function DocShell({
  header,
  titleEn,
  titleAr,
  number,
  children,
  meta,
}: {
  header: DocHeaderInfo | null;
  titleEn: string;
  titleAr: string;
  number: string;
  meta: { en: string; ar: string; value: React.ReactNode }[];
  children: React.ReactNode;
}) {
  const h = header;
  return (
    <div className="bg-white text-black text-[11px] leading-snug font-sans" style={{ width: "100%", fontVariantNumeric: "tabular-nums" }}>
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div className="min-w-0">
          <p className="text-lg font-bold">{h?.legalNameEn || h?.nameEn || "Hala Dresses"}</p>
          {h?.address && <p>{h.address}</p>}
          {h?.phone && <p>Tel: {h.phone}</p>}
          {h?.vatNumber && <p>VAT No: <strong>{h.vatNumber}</strong></p>}
          {h?.crNumber && <p>CR No: {h.crNumber}</p>}
        </div>
        <div className="min-w-0 text-right" dir="rtl" lang="ar">
          <p className="text-lg font-bold">{h?.legalNameAr || h?.nameAr || h?.nameEn || "هلا للفساتين"}</p>
          {h?.address && <p dir="ltr">{h.address}</p>}
          {h?.phone && <p>هاتف: <span dir="ltr">{h.phone}</span></p>}
          {h?.vatNumber && <p>الرقم الضريبي: <strong dir="ltr">{h.vatNumber}</strong></p>}
          {h?.crNumber && <p>السجل التجاري: <span dir="ltr">{h.crNumber}</span></p>}
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 mt-4">
        <div>
          <p className="text-xl font-bold tracking-wide uppercase">{titleEn}</p>
          <p className="text-lg font-bold" dir="rtl" lang="ar">{titleAr}</p>
        </div>
        <p className="text-base font-bold font-mono">{number}</p>
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-2 mt-3 mb-4">
        {meta.map((m) => (
          <div key={m.en} className="border-b border-gray-300 pb-1">
            <span className="flex justify-between gap-2 text-[10px] text-gray-700">
              <span>{m.en}</span>
              <span dir="rtl" lang="ar">{m.ar}</span>
            </span>
            <span className="block font-semibold mt-0.5">{m.value || "-"}</span>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

function PartyBox({ en, ar, lines }: { en: string; ar: string; lines: (string | null | undefined)[] }) {
  return (
    <div className="border border-black p-2.5">
      <p className="flex justify-between font-bold border-b border-gray-300 pb-1 mb-1">
        <span>{en}</span>
        <span dir="rtl" lang="ar">{ar}</span>
      </p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className={i === 0 ? "font-semibold" : ""}>{l}</p>
      ))}
    </div>
  );
}

function Th({ en, ar, right }: { en: string; ar: string; right?: boolean }) {
  return (
    <th className={`border border-black px-1.5 py-1 bg-gray-100 font-semibold ${right ? "text-right" : "text-left"}`}>
      <Bi en={en} ar={ar} align={right ? "right" : "left"} />
    </th>
  );
}

function TotalRow({ en, ar, value, strong }: { en: string; ar: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "font-bold text-[13px]" : ""}>
      <td className="border border-black px-2 py-1">{en}</td>
      <td className="border border-black px-2 py-1 text-right" dir="rtl" lang="ar">{ar}</td>
      <td className="border border-black px-2 py-1 text-right whitespace-nowrap">{value}</td>
    </tr>
  );
}

function Signatures({ left, right }: { left: { en: string; ar: string }; right: { en: string; ar: string } }) {
  return (
    <div className="grid grid-cols-2 gap-10 mt-12">
      {[left, right].map((s) => (
        <div key={s.en} className="border-t border-black pt-1 flex justify-between">
          <span>{s.en}</span>
          <span dir="rtl" lang="ar">{s.ar}</span>
        </div>
      ))}
    </div>
  );
}

// ───────── Purchase order ─────────

export type PrintablePo = {
  number: string;
  status: string;
  orderDate: string | null;
  expectedDate: string | null;
  dueDate: string | null;
  supplierReference: string | null;
  invoiceDate: string | null;
  pricesIncludeTax: boolean;
  notes: string | null;
  subtotal: number;
  discount: number;
  shippingCost: number;
  otherCharges: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  returnedTotal: number;
  outstanding: number;
  supplier: {
    code: string;
    nameEn: string;
    nameAr: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string;
    vatNumber: string | null;
    crNumber: string | null;
    paymentTermsDays: number;
  };
  items: {
    id: string;
    nameEn: string;
    nameAr: string | null;
    variantLabel: string | null;
    sku: string | null;
    quantity: number;
    receivedQty: number;
    unitCost: number;
    discountPct: number;
    taxRate: number;
    netAmount: number;
    taxAmount: number;
  }[];
};

function supplierLines(s: PrintablePo["supplier"]) {
  return [
    s.nameEn + (s.nameAr ? ` · ${s.nameAr}` : ""),
    s.contactPerson ? `Attn: ${s.contactPerson}` : null,
    [s.address, s.city, s.country].filter(Boolean).join(", "),
    [s.phone, s.email].filter(Boolean).join(" · "),
    s.vatNumber ? `VAT No: ${s.vatNumber}` : null,
    s.crNumber ? `CR No: ${s.crNumber}` : null,
    `Supplier code: ${s.code}`,
  ];
}

export function PurchaseOrderDoc({ po, header }: { po: PrintablePo; header: DocHeaderInfo | null }) {
  const terms = po.supplier.paymentTermsDays ? `Net ${po.supplier.paymentTermsDays} days` : "Cash on delivery";
  return (
    <DocShell
      header={header}
      titleEn="Purchase Order"
      titleAr="أمر شراء"
      number={po.number}
      meta={[
        { en: "Order date", ar: "تاريخ الطلب", value: fmtDate(po.orderDate) },
        { en: "Expected delivery", ar: "التسليم المتوقع", value: fmtDate(po.expectedDate) },
        { en: "Payment terms", ar: "شروط الدفع", value: terms },
        { en: "Supplier invoice", ar: "فاتورة المورد", value: po.supplierReference },
        { en: "Payment due", ar: "تاريخ الاستحقاق", value: fmtDate(po.dueDate) },
        { en: "Prices", ar: "الأسعار", value: po.pricesIncludeTax ? "Incl. VAT / شاملة الضريبة" : "Excl. VAT / غير شاملة الضريبة" },
      ]}
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <PartyBox en="Supplier" ar="المورد" lines={supplierLines(po.supplier)} />
        <PartyBox
          en="Deliver to"
          ar="التسليم إلى"
          lines={[header?.legalNameEn || header?.nameEn, header?.address, header?.phone ? `Tel: ${header.phone}` : null]}
        />
      </div>
      <ItemsTable po={po} />
      <div className="flex justify-between gap-6 mt-3 print-avoid-break">
        <div className="flex-1 min-w-0">
          {po.notes && (
            <div className="border border-gray-400 p-2">
              <Bi en="Notes" ar="ملاحظات" className="font-semibold mb-1" />
              <p className="whitespace-pre-line">{po.notes}</p>
            </div>
          )}
        </div>
        <PoTotals po={po} />
      </div>
      <Signatures left={{ en: "Prepared by", ar: "أعدّه" }} right={{ en: "Approved by", ar: "اعتمده" }} />
    </DocShell>
  );
}

function ItemsTable({ po, receivedOnly }: { po: PrintablePo; receivedOnly?: Map<string, number> }) {
  const rows = receivedOnly ? po.items.filter((i) => receivedOnly.has(i.id)) : po.items.filter((i) => i.quantity > 0);
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <Th en="#" ar="م" />
          <Th en="Item" ar="الصنف" />
          <Th en="Qty" ar="الكمية" right />
          {!receivedOnly && <Th en="Unit cost" ar="سعر الوحدة" right />}
          {!receivedOnly && <Th en="Disc %" ar="خصم %" right />}
          {!receivedOnly && <Th en="VAT %" ar="الضريبة %" right />}
          {!receivedOnly && <Th en="Net" ar="الصافي" right />}
          {!receivedOnly && <Th en="VAT" ar="الضريبة" right />}
          {!receivedOnly && <Th en="Total" ar="الإجمالي" right />}
          {receivedOnly && <Th en="Ordered" ar="المطلوب" right />}
          {receivedOnly && <Th en="Received to date" ar="المستلم حتى الآن" right />}
        </tr>
      </thead>
      <tbody>
        {rows.map((it, i) => (
          <tr key={it.id} className="print-avoid-break">
            <td className="border border-black px-1.5 py-1 align-top">{i + 1}</td>
            <td className="border border-black px-1.5 py-1 align-top">
              <span className="font-semibold">{it.nameEn}</span>
              {it.nameAr && <span className="block" dir="rtl" lang="ar">{it.nameAr}</span>}
              {(it.variantLabel || it.sku) && <span className="block text-[10px] text-gray-700">{[it.variantLabel, it.sku && `SKU ${it.sku}`].filter(Boolean).join(" · ")}</span>}
            </td>
            <td className="border border-black px-1.5 py-1 text-right align-top font-semibold">{receivedOnly ? receivedOnly.get(it.id) : it.quantity}</td>
            {!receivedOnly && (
              <>
                <td className="border border-black px-1.5 py-1 text-right align-top">{fmt3(it.unitCost)}</td>
                <td className="border border-black px-1.5 py-1 text-right align-top">{it.discountPct ? it.discountPct : "-"}</td>
                <td className="border border-black px-1.5 py-1 text-right align-top">{it.taxRate}%</td>
                <td className="border border-black px-1.5 py-1 text-right align-top">{fmt3(it.netAmount)}</td>
                <td className="border border-black px-1.5 py-1 text-right align-top">{fmt3(it.taxAmount)}</td>
                <td className="border border-black px-1.5 py-1 text-right align-top font-semibold">{fmt3(it.netAmount + it.taxAmount)}</td>
              </>
            )}
            {receivedOnly && (
              <>
                <td className="border border-black px-1.5 py-1 text-right align-top">{it.quantity}</td>
                <td className="border border-black px-1.5 py-1 text-right align-top">{it.receivedQty}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PoTotals({ po }: { po: PrintablePo }) {
  return (
    <table className="border-collapse w-[300px] shrink-0">
      <tbody>
        <TotalRow en="Subtotal (excl. VAT)" ar="المجموع قبل الضريبة" value={fmt3(po.subtotal)} />
        {po.discount > 0 && <TotalRow en="Discount" ar="الخصم" value={`−${fmt3(po.discount)}`} />}
        {po.shippingCost > 0 && <TotalRow en="Freight" ar="الشحن" value={fmt3(po.shippingCost)} />}
        {po.otherCharges > 0 && <TotalRow en="Other charges" ar="رسوم أخرى" value={fmt3(po.otherCharges)} />}
        <TotalRow en="VAT" ar="ضريبة القيمة المضافة" value={fmt3(po.taxTotal)} />
        <TotalRow en="Total (OMR)" ar="الإجمالي (ر.ع.)" value={fmt3(po.total)} strong />
        {po.amountPaid > 0 && <TotalRow en="Paid" ar="المدفوع" value={fmt3(po.amountPaid)} />}
        {po.returnedTotal > 0 && <TotalRow en="Returned" ar="المرتجع" value={`−${fmt3(po.returnedTotal)}`} />}
        {(po.amountPaid > 0 || po.returnedTotal > 0) && <TotalRow en="Balance due" ar="المبلغ المستحق" value={fmt3(po.outstanding)} strong />}
      </tbody>
    </table>
  );
}

// ───────── Goods received note ─────────

export type PrintableReceipt = {
  number: string;
  receivedAt: string;
  units: number;
  value: number;
  note: string | null;
  createdBy: string;
  items: unknown;
};

export function GoodsReceiptDoc({ po, receipt, header }: { po: PrintablePo; receipt: PrintableReceipt; header: DocHeaderInfo | null }) {
  const qty = new Map<string, number>();
  if (Array.isArray(receipt.items)) {
    for (const raw of receipt.items as { itemId?: string; quantity?: number }[]) {
      if (raw.itemId) qty.set(raw.itemId, (qty.get(raw.itemId) ?? 0) + Number(raw.quantity ?? 0));
    }
  }
  return (
    <DocShell
      header={header}
      titleEn="Goods Received Note"
      titleAr="إشعار استلام بضاعة"
      number={receipt.number}
      meta={[
        { en: "Received on", ar: "تاريخ الاستلام", value: fmtDate(receipt.receivedAt, true) },
        { en: "Purchase order", ar: "أمر الشراء", value: po.number },
        { en: "Supplier invoice", ar: "فاتورة المورد", value: po.supplierReference },
        { en: "Units received", ar: "الوحدات المستلمة", value: String(receipt.units) },
        { en: "Received by", ar: "استلمها", value: receipt.createdBy },
        { en: "Supplier", ar: "المورد", value: po.supplier.nameEn },
      ]}
    >
      <ItemsTable po={po} receivedOnly={qty} />
      {receipt.note && (
        <div className="border border-gray-400 p-2 mt-3">
          <Bi en="Notes" ar="ملاحظات" className="font-semibold mb-1" />
          <p className="whitespace-pre-line">{receipt.note}</p>
        </div>
      )}
      <Signatures left={{ en: "Delivered by", ar: "سلّمها" }} right={{ en: "Received & checked by", ar: "استلمها وفحصها" }} />
    </DocShell>
  );
}

// ───────── Debit note (return to supplier) ─────────

export type PrintableReturn = {
  number: string;
  returnedAt: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  reason: string | null;
  settlement?: string;
  refund?: { number: string; method: string; reference: string | null; amount: number } | null;
  purchaseOrder: { number: string } | null;
  createdBy?: string;
  items: { nameEn: string; nameAr: string | null; variantLabel: string | null; sku: string | null; quantity: number; unitCost: number; taxRate: number; net: number; tax: number }[];
  supplier: {
    code: string;
    nameEn: string;
    nameAr: string | null;
    vatNumber?: string | null;
    crNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
  };
};

export function DebitNoteDoc({ ret, header }: { ret: PrintableReturn; header: DocHeaderInfo | null }) {
  const s = ret.supplier;
  const refunded = ret.settlement === "REFUND";
  return (
    <DocShell
      header={header}
      titleEn="Debit Note · Return to Supplier"
      titleAr="إشعار مدين · مرتجع إلى المورد"
      number={ret.number}
      meta={[
        { en: "Date", ar: "التاريخ", value: fmtDate(ret.returnedAt) },
        { en: "Purchase order", ar: "أمر الشراء", value: ret.purchaseOrder?.number ?? "Not on an order / بدون أمر شراء" },
        { en: "Settlement", ar: "التسوية", value: refunded ? "Refunded / مسترد نقداً" : "Credit to account / رصيد دائن" },
      ]}
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <PartyBox
          en="Supplier"
          ar="المورد"
          lines={[
            s.nameEn + (s.nameAr ? ` · ${s.nameAr}` : ""),
            [s.address, s.city, s.country].filter(Boolean).join(", "),
            [s.phone, s.email].filter(Boolean).join(" · "),
            s.vatNumber ? `VAT No: ${s.vatNumber}` : null,
            `Supplier code: ${s.code}`,
          ]}
        />
        <div className="border border-black p-2.5">
          <Bi en="Reason for return" ar="سبب الإرجاع" className="font-bold border-b border-gray-300 pb-1 mb-1" />
          <p className="whitespace-pre-line">{ret.reason || "-"}</p>
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th en="#" ar="م" />
            <Th en="Item" ar="الصنف" />
            <Th en="Qty" ar="الكمية" right />
            <Th en="Unit cost" ar="سعر الوحدة" right />
            <Th en="VAT %" ar="الضريبة %" right />
            <Th en="Net" ar="الصافي" right />
            <Th en="VAT" ar="الضريبة" right />
            <Th en="Total" ar="الإجمالي" right />
          </tr>
        </thead>
        <tbody>
          {ret.items.map((it, i) => (
            <tr key={i} className="print-avoid-break">
              <td className="border border-black px-1.5 py-1">{i + 1}</td>
              <td className="border border-black px-1.5 py-1">
                <span className="font-semibold">{it.nameEn}</span>
                {it.nameAr && <span className="block" dir="rtl" lang="ar">{it.nameAr}</span>}
                {(it.variantLabel || it.sku) && <span className="block text-[10px] text-gray-700">{[it.variantLabel, it.sku && `SKU ${it.sku}`].filter(Boolean).join(" · ")}</span>}
              </td>
              <td className="border border-black px-1.5 py-1 text-right font-semibold">{it.quantity}</td>
              <td className="border border-black px-1.5 py-1 text-right">{fmt3(it.unitCost)}</td>
              <td className="border border-black px-1.5 py-1 text-right">{it.taxRate}%</td>
              <td className="border border-black px-1.5 py-1 text-right">{fmt3(it.net)}</td>
              <td className="border border-black px-1.5 py-1 text-right">{fmt3(it.tax)}</td>
              <td className="border border-black px-1.5 py-1 text-right font-semibold">{fmt3(it.net + it.tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between gap-6 mt-3 print-avoid-break">
        <div className="flex-1 min-w-0">
          {refunded && ret.refund && (
            <p className="border border-gray-400 p-2">
              Refund {ret.refund.number} · {methodText(ret.refund.method)} / {AR_METHOD[ret.refund.method] ?? ""}
              {ret.refund.reference ? ` · Ref ${ret.refund.reference}` : ""}
            </p>
          )}
        </div>
        <table className="border-collapse w-[300px] shrink-0">
          <tbody>
            <TotalRow en="Net (excl. VAT)" ar="الصافي قبل الضريبة" value={fmt3(ret.subtotal)} />
            <TotalRow en="VAT" ar="ضريبة القيمة المضافة" value={fmt3(ret.taxTotal)} />
            <TotalRow en="Total (OMR)" ar="الإجمالي (ر.ع.)" value={fmt3(ret.total)} strong />
          </tbody>
        </table>
      </div>
      <Signatures left={{ en: "Returned by", ar: "أرجعها" }} right={{ en: "Received by (supplier)", ar: "استلمها (المورد)" }} />
    </DocShell>
  );
}

// ───────── Supplier statement ─────────

export type PrintableStatement = {
  supplier: { code: string; nameEn: string; nameAr: string | null; vatNumber: string | null; phone: string | null; address: string | null; city: string | null; country: string };
  from: string | null;
  to: string | null;
  generatedOn: string | null;
  broughtForward: number;
  closingBalance: number;
  totals: { debit: number; credit: number };
  entries: { date: string; type: string; number: string | null; description: string; debit: number; credit: number; balance: number }[];
};

const TYPE_AR: Record<string, string> = {
  OPENING: "رصيد افتتاحي",
  PURCHASE: "مشتريات",
  RETURN: "مرتجع",
  PAYMENT: "دفعة",
  REFUND: "مبلغ مسترد",
};

const bal = (n: number) => (n < -0.0005 ? `${fmt3(-n)} CR` : fmt3(n));

export function SupplierStatementDoc({ st, header }: { st: PrintableStatement; header: DocHeaderInfo | null }) {
  const s = st.supplier;
  return (
    <DocShell
      header={header}
      titleEn="Statement of Account"
      titleAr="كشف حساب"
      number={s.code}
      meta={[
        { en: "Period from", ar: "من", value: st.from ? fmtDate(st.from) : "Start / البداية" },
        { en: "Period to", ar: "إلى", value: st.to ? fmtDate(st.to) : fmtDate(st.generatedOn) },
        { en: "Balance due", ar: "الرصيد المستحق", value: `${bal(st.closingBalance)} OMR` },
      ]}
    >
      <div className="mb-4">
        <PartyBox
          en="Supplier"
          ar="المورد"
          lines={[s.nameEn + (s.nameAr ? ` · ${s.nameAr}` : ""), [s.address, s.city, s.country].filter(Boolean).join(", "), s.phone, s.vatNumber ? `VAT No: ${s.vatNumber}` : null]}
        />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th en="Date" ar="التاريخ" />
            <Th en="Document" ar="المستند" />
            <Th en="Description" ar="البيان" />
            <Th en="Debit (we owe)" ar="مدين" right />
            <Th en="Credit (paid / returned)" ar="دائن" right />
            <Th en="Balance" ar="الرصيد" right />
          </tr>
        </thead>
        <tbody>
          {st.from && (
            <tr>
              <td className="border border-black px-1.5 py-1" colSpan={5}>
                Balance brought forward <span dir="rtl" lang="ar">· الرصيد المرحّل</span>
              </td>
              <td className="border border-black px-1.5 py-1 text-right font-semibold">{bal(st.broughtForward)}</td>
            </tr>
          )}
          {st.entries.map((e, i) => (
            <tr key={i} className="print-avoid-break">
              <td className="border border-black px-1.5 py-1 whitespace-nowrap">{fmtDate(e.date)}</td>
              <td className="border border-black px-1.5 py-1 whitespace-nowrap">
                {e.number ?? "-"}
                <span className="block text-[10px]" dir="rtl" lang="ar">{TYPE_AR[e.type] ?? ""}</span>
              </td>
              <td className="border border-black px-1.5 py-1">{e.description}</td>
              <td className="border border-black px-1.5 py-1 text-right">{e.debit ? fmt3(e.debit) : ""}</td>
              <td className="border border-black px-1.5 py-1 text-right">{e.credit ? fmt3(e.credit) : ""}</td>
              <td className="border border-black px-1.5 py-1 text-right font-semibold">{bal(e.balance)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border border-black px-1.5 py-1" colSpan={3}>
              Totals / الإجماليات
            </td>
            <td className="border border-black px-1.5 py-1 text-right">{fmt3(st.totals.debit)}</td>
            <td className="border border-black px-1.5 py-1 text-right">{fmt3(st.totals.credit)}</td>
            <td className="border border-black px-1.5 py-1 text-right">{bal(st.closingBalance)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[10px] text-gray-700">
        Positive balance = amount we owe the supplier; CR = credit in our favour. · الرصيد الموجب = المبلغ المستحق للمورد؛ CR = رصيد دائن لصالحنا.
      </p>
    </DocShell>
  );
}
