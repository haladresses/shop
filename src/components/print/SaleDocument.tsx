"use client";
import { invoiceTitle, paymentLabels, type InvoiceData, type StoreInfo } from "@/lib/invoice";
import { rateLabel, type TaxSettings } from "@/lib/taxCalc";

// The customer's bill — English and Arabic together on one document.
//   layout="thermal"  80 mm roll (POS)          → print with page "receipt"
//   layout="a4"       full tax invoice (orders)  → print with page "a4"

type TaxInfo = Pick<TaxSettings, "enabled" | "vatNumber" | "legalNameEn" | "legalNameAr" | "crNumber" | "invoiceFooterEn" | "invoiceFooterAr">;

const f3 = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3);
const AR_FONT = 'Vazirmatn, SBC, Tahoma, "Segoe UI", Arial, sans-serif';

function dateParts(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { timeZone: "Asia/Muscat" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Muscat", hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

/** One bill line: English label · Arabic label · value. */
function Bi({ en, ar, value, strong, big }: { en: string; ar: string; value?: string; strong?: boolean; big?: boolean }) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "baseline", columnGap: 6 }}
      className={`${strong ? "font-bold" : ""} ${big ? "text-[15px]" : ""}`}
    >
      <span>{en}</span>
      <span dir="rtl" style={{ textAlign: "right", fontFamily: AR_FONT }}>{ar}</span>
      {value !== undefined && <span className="tabular-nums" style={{ textAlign: "right", minWidth: 64 }}>{value}</span>}
    </div>
  );
}

const Rule = ({ dashed = true }: { dashed?: boolean }) => (
  <div style={{ borderTop: `1px ${dashed ? "dashed" : "solid"} #000`, margin: "6px 0" }} />
);

export function SaleDocument({
  data,
  store,
  tax,
  layout = "thermal",
}: {
  data: InvoiceData;
  store: StoreInfo;
  tax: TaxInfo;
  layout?: "thermal" | "a4";
}) {
  return layout === "a4" ? <A4Invoice data={data} store={store} tax={tax} /> : <ThermalReceipt data={data} store={store} tax={tax} />;
}

// ───────────────────────── 80 mm receipt ─────────────────────────

function ThermalReceipt({ data, store, tax }: { data: InvoiceData; store: StoreInfo; tax: TaxInfo }) {
  const title = invoiceTitle(data, tax, "thermal");
  const { date, time } = dateParts(data.createdAt);
  const isCN = data.kind === "credit-note";
  const vat = tax.enabled && (data.breakdown.length > 0 || data.taxTotal > 0);
  const manualDiscount = Math.max(0, data.discount - data.promotionDiscount);
  const nameEn = tax.legalNameEn || store.store_name_en || "Hala Dresses";
  const nameAr = tax.legalNameAr || store.store_name_ar || "";

  return (
    <div
      className="text-black bg-white"
      style={{ width: "72mm", fontFamily: AR_FONT, fontSize: 12, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="font-bold" style={{ fontSize: 16 }}>{nameEn}</div>
        {nameAr && <div dir="rtl" className="font-bold" style={{ fontSize: 15 }}>{nameAr}</div>}
        {store.store_address && <div style={{ fontSize: 11 }}>{store.store_address}</div>}
        {store.store_phone && <div style={{ fontSize: 11 }} dir="ltr">☎ {store.store_phone}</div>}
        {vat && tax.vatNumber && (
          <div style={{ fontSize: 11 }}>
            VATIN: {tax.vatNumber} <span dir="rtl">الرقم الضريبي</span>
          </div>
        )}
        {tax.crNumber && (
          <div style={{ fontSize: 11 }}>
            CR: {tax.crNumber} <span dir="rtl">السجل التجاري</span>
          </div>
        )}
        <div style={{ marginTop: 6, padding: "3px 0", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
          <div className="font-bold" style={{ fontSize: 13, letterSpacing: 0.5 }}>{title.en.toUpperCase()}</div>
          <div dir="rtl" className="font-bold" style={{ fontSize: 13 }}>{title.ar}</div>
          {data.copyLabel && <div style={{ fontSize: 11 }}>({data.copyLabel} / نسخة)</div>}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        {isCN && data.creditNote?.number && <Bi en="Credit note" ar="رقم الإشعار" value={data.creditNote.number} />}
        {data.invoiceNumber && <Bi en={isCN ? "Original invoice" : "Invoice no."} ar={isCN ? "الفاتورة الأصلية" : "رقم الفاتورة"} value={data.invoiceNumber} />}
        <Bi en="Order no." ar="رقم الطلب" value={data.orderNumber} />
        <Bi en="Date" ar="التاريخ" value={`${date} ${time}`} />
        {data.cashierName && <Bi en="Cashier" ar="الكاشير" value={data.cashierName} />}
        {data.customerName && <Bi en="Customer" ar="العميل" value={data.customerName} />}
        {data.customerPhone && <Bi en="Phone" ar="الهاتف" value={data.customerPhone} />}
        {data.customerVatNumber && <Bi en="Customer VATIN" ar="الرقم الضريبي للعميل" value={data.customerVatNumber} />}
      </div>

      <Rule />
      <div className="font-bold" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", columnGap: 6, fontSize: 11 }}>
        <span>Item <span dir="rtl">الصنف</span></span>
        <span style={{ textAlign: "right" }}>Qty <span dir="rtl">الكمية</span></span>
        <span style={{ textAlign: "right", minWidth: 58 }}>Total <span dir="rtl">المجموع</span></span>
      </div>
      <Rule />

      {data.lines.map((l, i) => (
        <div key={i} style={{ marginBottom: 5 }} className="print-avoid-break">
          <div className="font-bold">{l.nameEn}</div>
          {l.nameAr && l.nameAr !== l.nameEn && <div dir="rtl" style={{ textAlign: "right" }}>{l.nameAr}</div>}
          {(l.variant || (vat && l.taxRate > 0)) && (
            <div style={{ fontSize: 11 }}>
              {[l.variant, vat ? `VAT ${rateLabel({ rate: l.taxRate, type: l.taxRate > 0 ? "STANDARD" : "ZERO_RATED" })}` : ""].filter(Boolean).join(" · ")}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", columnGap: 6 }}>
            <span style={{ fontSize: 11 }}>@ {f3(l.unitPrice)}</span>
            <span style={{ textAlign: "right" }}>× {l.quantity}</span>
            <span style={{ textAlign: "right", minWidth: 58 }}>{f3(l.shelf)}</span>
          </div>
          {l.promotionDiscount > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", fontSize: 11 }}>
              <span>
                Offer <span dir="rtl">عرض</span>
              </span>
              <span style={{ textAlign: "right" }}>-{f3(l.promotionDiscount)}</span>
            </div>
          )}
        </div>
      ))}

      <Rule />
      <Bi en="Subtotal" ar="المجموع الفرعي" value={f3(data.subtotal)} />
      {data.promotions.map((p, i) => (
        <Bi key={i} en={p.nameEn} ar={p.nameAr} value={`-${f3(p.discount)}`} />
      ))}
      {data.promotions.length === 0 && data.promotionDiscount > 0 && <Bi en="Offers" ar="العروض" value={`-${f3(data.promotionDiscount)}`} />}
      {manualDiscount > 0.0005 && <Bi en="Discount" ar="الخصم" value={`-${f3(manualDiscount)}`} />}
      {data.shipping > 0 && <Bi en="Delivery" ar="رسوم التوصيل" value={f3(data.shipping)} />}
      {vat && (
        <>
          <Bi en={`Total excl. VAT`} ar="الإجمالي قبل الضريبة" value={f3(data.total - data.taxTotal)} />
          {data.breakdown.length > 0
            ? data.breakdown.map((b, i) => (
                <Bi key={i} en={`VAT ${rateLabel(b)}`} ar={`ضريبة القيمة المضافة ${rateLabel(b, "ar")}`} value={f3(b.tax)} />
              ))
            : <Bi en="VAT" ar="ضريبة القيمة المضافة" value={f3(data.taxTotal)} />}
        </>
      )}
      <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "3px 0", margin: "4px 0" }}>
        <Bi
          en={isCN ? "REFUND TOTAL" : "TOTAL"}
          ar={isCN ? "إجمالي المسترد" : "الإجمالي"}
          value={`${f3(data.total)} OMR`}
          strong
          big
        />
        {vat && data.pricesIncludeTax && !isCN && (
          <div style={{ fontSize: 10, textAlign: "center" }}>
            Prices include VAT · <span dir="rtl">الأسعار شاملة الضريبة</span>
          </div>
        )}
      </div>

      {data.payments.map((p, i) => {
        const m = paymentLabels(p.method, p.amount, isCN);
        return <Bi key={i} en={m.en} ar={m.ar} value={f3(Math.abs(p.amount))} />;
      })}
      {data.amountTendered != null && <Bi en="Cash tendered" ar="المبلغ المدفوع" value={f3(data.amountTendered)} />}
      {data.changeGiven != null && data.changeGiven > 0 && <Bi en="Change" ar="الباقي" value={f3(data.changeGiven)} strong />}
      {isCN && data.creditNote?.reason && <Bi en="Reason" ar="السبب" value={data.creditNote.reason} />}

      {data.promotions.length > 0 && !isCN && (
        <div style={{ textAlign: "center", marginTop: 6, fontSize: 11 }} className="font-bold">
          You saved {f3(data.promotionDiscount)} OMR · <span dir="rtl">وفّرت {f3(data.promotionDiscount)} ر.ع.</span>
        </div>
      )}

      <Rule />
      <div style={{ textAlign: "center", fontSize: 11 }}>
        {tax.invoiceFooterEn && <div>{tax.invoiceFooterEn}</div>}
        {tax.invoiceFooterAr && <div dir="rtl">{tax.invoiceFooterAr}</div>}
        {data.exchangeFor && !isCN && (
          <div className="font-bold" style={{ marginBottom: 2 }}>
            Exchange for order {data.exchangeFor} · <span dir="rtl">استبدال للطلب {data.exchangeFor}</span>
          </div>
        )}
        <div>Thank you for shopping with us!</div>
        <div dir="rtl">شكراً لتسوقكم معنا</div>
      </div>
    </div>
  );
}

// ───────────────────────── A4 tax invoice ─────────────────────────

function A4Invoice({ data, store, tax }: { data: InvoiceData; store: StoreInfo; tax: TaxInfo }) {
  const title = invoiceTitle(data, tax, "a4");
  const { date, time } = dateParts(data.createdAt);
  const isCN = data.kind === "credit-note";
  const vat = tax.enabled && (data.breakdown.length > 0 || data.taxTotal > 0);
  const manualDiscount = Math.max(0, data.discount - data.promotionDiscount);
  const nameEn = tax.legalNameEn || store.store_name_en || "Hala Dresses";
  const nameAr = tax.legalNameAr || store.store_name_ar || "";
  const th = "border border-black px-1.5 py-1 text-[10px] font-bold align-bottom";
  const td = "border border-black px-1.5 py-1 align-top";

  const Info = ({ en, ar, value }: { en: string; ar: string; value?: string | null }) =>
    value ? (
      <tr>
        <td className="pr-2 py-0.5 whitespace-nowrap font-semibold">{en}</td>
        <td className="py-0.5 tabular-nums">{value}</td>
        <td dir="rtl" className="pl-2 py-0.5 text-right whitespace-nowrap font-semibold" style={{ fontFamily: AR_FONT }}>{ar}</td>
      </tr>
    ) : null;

  return (
    <div className="bg-white text-black" style={{ fontFamily: AR_FONT, fontSize: 11.5, lineHeight: 1.4 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-3" style={{ borderBottom: "2px solid #000" }}>
        <div className="min-w-0">
          <div className="text-[20px] font-bold">{nameEn}</div>
          {store.store_address && <div>{store.store_address}</div>}
          {store.store_phone && <div>Tel: {store.store_phone}</div>}
          {store.store_email && <div>{store.store_email}</div>}
          {vat && tax.vatNumber && <div className="font-semibold">VATIN: {tax.vatNumber}</div>}
          {tax.crNumber && <div>CR No: {tax.crNumber}</div>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" style={{ width: 56, height: 56, objectFit: "contain" }} />
        <div className="min-w-0 text-right" dir="rtl">
          <div className="text-[20px] font-bold">{nameAr || nameEn}</div>
          {store.store_address && <div>{store.store_address}</div>}
          {store.store_phone && <div>هاتف: {store.store_phone}</div>}
          {vat && tax.vatNumber && <div className="font-semibold">الرقم الضريبي: {tax.vatNumber}</div>}
          {tax.crNumber && <div>السجل التجاري: {tax.crNumber}</div>}
        </div>
      </div>

      <div className="text-center my-3">
        <div className="text-[18px] font-bold tracking-wide">{title.en.toUpperCase()}</div>
        <div className="text-[18px] font-bold" dir="rtl">{title.ar}</div>
        {data.copyLabel && <div className="text-[11px]">({data.copyLabel} / نسخة)</div>}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-3">
        <table className="w-full text-[11px]">
          <tbody>
            {isCN && <Info en="Credit note no." ar="رقم الإشعار" value={data.creditNote?.number} />}
            <Info en={isCN ? "Original invoice" : "Invoice no."} ar={isCN ? "الفاتورة الأصلية" : "رقم الفاتورة"} value={data.invoiceNumber} />
            <Info en="Order no." ar="رقم الطلب" value={data.orderNumber} />
            <Info en="Date" ar="التاريخ" value={`${date} ${time}`} />
            <Info en="Channel" ar="القناة" value={data.source === "POS" ? "In store / المتجر" : "Online / متجر إلكتروني"} />
            {data.cashierName && <Info en="Served by" ar="الموظف" value={data.cashierName} />}
          </tbody>
        </table>
        <table className="w-full text-[11px]">
          <tbody>
            <Info en="Customer" ar="العميل" value={data.customerName || "Cash customer / عميل نقدي"} />
            <Info en="Phone" ar="الهاتف" value={data.customerPhone} />
            <Info en="Address" ar="العنوان" value={data.customerAddress} />
            <Info en="Customer VATIN" ar="الرقم الضريبي للعميل" value={data.customerVatNumber} />
            {data.paymentStatus && !isCN && <Info en="Payment" ar="حالة الدفع" value={data.paymentStatus} />}
            {isCN && <Info en="Reason" ar="السبب" value={data.creditNote?.reason} />}
          </tbody>
        </table>
      </div>

      <table className="w-full border-collapse text-[11px] tabular-nums">
        <thead style={{ background: "#eee" }}>
          <tr>
            <th className={`${th} text-center w-6`}>#</th>
            <th className={`${th} text-left`}>
              Description <div dir="rtl" className="text-right">الوصف</div>
            </th>
            <th className={`${th} text-right`}>Qty<div dir="rtl">الكمية</div></th>
            <th className={`${th} text-right`}>Unit price<div dir="rtl">سعر الوحدة</div></th>
            <th className={`${th} text-right`}>Discount<div dir="rtl">الخصم</div></th>
            {vat && <th className={`${th} text-right`}>Taxable<div dir="rtl">المبلغ الخاضع</div></th>}
            {vat && <th className={`${th} text-right`}>VAT %<div dir="rtl">النسبة</div></th>}
            {vat && <th className={`${th} text-right`}>VAT<div dir="rtl">الضريبة</div></th>}
            <th className={`${th} text-right`}>Total<div dir="rtl">الإجمالي</div></th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="print-avoid-break">
              <td className={`${td} text-center`}>{i + 1}</td>
              <td className={td}>
                <div className="font-semibold">{l.nameEn}</div>
                {l.nameAr && l.nameAr !== l.nameEn && <div dir="rtl" className="text-right">{l.nameAr}</div>}
                {(l.variant || l.sku) && <div className="text-[10px]">{[l.variant, l.sku && `SKU ${l.sku}`].filter(Boolean).join(" · ")}</div>}
              </td>
              <td className={`${td} text-right`}>{l.quantity}</td>
              <td className={`${td} text-right`}>{f3(l.unitPrice)}</td>
              <td className={`${td} text-right`}>{l.discount > 0 ? `-${f3(l.discount)}` : "-"}</td>
              {vat && <td className={`${td} text-right`}>{l.taxable != null ? f3(l.taxable) : "-"}</td>}
              {vat && <td className={`${td} text-right`}>{rateLabel({ rate: l.taxRate, type: l.taxRate > 0 ? "STANDARD" : "ZERO_RATED" })}</td>}
              {vat && <td className={`${td} text-right`}>{f3(l.tax)}</td>}
              <td className={`${td} text-right font-semibold`}>{f3(l.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between gap-6 mt-3 print-avoid-break">
        <div className="flex-1 min-w-0 text-[11px]">
          {vat && data.breakdown.length > 0 && (
            <table className="w-full border-collapse mb-2 tabular-nums">
              <thead style={{ background: "#eee" }}>
                <tr>
                  <th className={`${th} text-left`}>VAT summary <span dir="rtl">ملخص الضريبة</span></th>
                  <th className={`${th} text-right`}>Taxable <span dir="rtl">الخاضع</span></th>
                  <th className={`${th} text-right`}>VAT <span dir="rtl">الضريبة</span></th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((b, i) => (
                  <tr key={i}>
                    <td className={td}>
                      {b.nameEn} <span dir="rtl">· {b.nameAr}</span>
                    </td>
                    <td className={`${td} text-right`}>{f3(b.taxable)}</td>
                    <td className={`${td} text-right`}>{f3(b.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.payments.length > 0 && (
            <div>
              <div className="font-semibold">
                {isCN ? "Refunded by" : "Payment"} / <span dir="rtl">{isCN ? "طريقة الاسترداد" : "الدفع"}</span>
              </div>
              {data.payments.map((p, i) => {
                const m = paymentLabels(p.method, p.amount, isCN);
                return (
                  <div key={i}>
                    {m.en} / <span dir="rtl">{m.ar}</span>: {f3(Math.abs(p.amount))} OMR
                  </div>
                );
              })}
              {data.changeGiven != null && data.changeGiven > 0 && <div>Change / <span dir="rtl">الباقي</span>: {f3(data.changeGiven)} OMR</div>}
            </div>
          )}
          {data.notes && !isCN && <div className="mt-2">Notes / <span dir="rtl">ملاحظات</span>: {data.notes}</div>}
          {data.exchangeFor && !isCN && (
            <div className="mt-1 font-semibold">Exchange for order {data.exchangeFor} / <span dir="rtl">استبدال للطلب {data.exchangeFor}</span></div>
          )}
        </div>
        <div className="w-[300px] shrink-0 tabular-nums">
          <Bi en="Subtotal" ar="المجموع الفرعي" value={f3(data.subtotal)} />
          {data.promotions.map((p, i) => (
            <Bi key={i} en={p.nameEn} ar={p.nameAr} value={`-${f3(p.discount)}`} />
          ))}
          {manualDiscount > 0.0005 && <Bi en="Discount" ar="الخصم" value={`-${f3(manualDiscount)}`} />}
          {data.shipping > 0 && <Bi en="Delivery" ar="رسوم التوصيل" value={f3(data.shipping)} />}
          {vat && <Bi en="Total excl. VAT" ar="الإجمالي قبل الضريبة" value={f3(data.total - data.taxTotal)} />}
          {vat && <Bi en="VAT" ar="ضريبة القيمة المضافة" value={f3(data.taxTotal)} />}
          <div style={{ borderTop: "2px solid #000", marginTop: 4, paddingTop: 4 }}>
            <Bi en={isCN ? "Refund total" : "Total due"} ar={isCN ? "إجمالي المسترد" : "الإجمالي المستحق"} value={`${f3(data.total)} OMR`} strong big />
          </div>
          {!isCN && (data.refundedAmount ?? 0) > 0 && <Bi en="Refunded" ar="المسترد" value={`-${f3(data.refundedAmount ?? 0)}`} />}
        </div>
      </div>

      <div className="mt-6 pt-2 text-center text-[10.5px]" style={{ borderTop: "1px solid #000" }}>
        {tax.invoiceFooterEn && <div>{tax.invoiceFooterEn}</div>}
        {tax.invoiceFooterAr && <div dir="rtl">{tax.invoiceFooterAr}</div>}
        <div>Thank you for shopping with us! · <span dir="rtl">شكراً لتسوقكم معنا</span></div>
        {vat && data.pricesIncludeTax && !isCN && <div>All prices include VAT · <span dir="rtl">جميع الأسعار شاملة ضريبة القيمة المضافة</span></div>}
      </div>
    </div>
  );
}
