"use client";
import { LuPrinter, LuReceipt } from "react-icons/lu";
import PrintArea from "@/components/print/PrintArea";
import { printArea } from "@/lib/print";
import {
  DataTable,
  FigureTable,
  PrintHeader,
  StatusLine,
  channelName,
  f3,
  fmtDateTime,
  fmtTime,
  int,
  methodName,
  methodNameAr,
  pct,
  printTable,
  printTd,
  printTh,
  useReport,
  useReportCtx,
  type Figures,
} from "./shared";

type SellerRow = Figures & { sellerId: string; name: string; share: number; firstSale: string | null; lastSale: string | null };
type MethodRow = { method: string; transactions: number; orders: number; amount: number; refundCount: number; refunds: number; net: number };
type Shift = {
  id: string;
  status: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  salesCount: number;
  salesTotal: number;
  byMethod: Record<string, number>;
  refunds: number;
  cashRefunds: number;
  payIns: number;
  payOuts: number;
  expectedCash: number;
  difference: number | null;
};

export type Summary = {
  range: { from: string; to: string };
  generatedAt: string;
  totals: Figures;
  byChannel: (Figures & { channel: string })[];
  byMethod: MethodRow[];
  unrecorded: number;
  cash: { sales: number; refunds: number; net: number };
  bySeller: SellerRow[];
  byHour: { hour: number; orders: number; items: number; gross: number; vat: number }[];
  topProducts: { productId: string; nameEn: string; nameAr: string; qty: number; shelf: number; paid: number }[];
  promotions: { promotionId: string; nameEn: string; nameAr: string; uses: number; units: number; discount: number }[];
  refundsByMethod: { method: string; count: number; amount: number; vat: number }[];
  shifts: Shift[];
};

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00 – ${String(h).padStart(2, "0")}:59`;

export function totalsRows(t: Figures) {
  return [
    { label: "Sales (receipts)", labelAr: "عدد المبيعات", value: int(t.orders) },
    { label: "Items sold", labelAr: "القطع المباعة", value: int(t.items) },
    { label: "Sales at shelf price", labelAr: "المبيعات بسعر الرف", value: f3(t.subtotal), muted: true },
    { label: "Offers", labelAr: "العروض", value: t.offers ? `−${f3(t.offers)}` : f3(0), muted: true },
    { label: "Discounts", labelAr: "الخصومات", value: t.discounts ? `−${f3(t.discounts)}` : f3(0), muted: true },
    { label: "Delivery fees", labelAr: "رسوم التوصيل", value: f3(t.shipping), muted: true },
    { label: "Gross sales (incl. VAT)", labelAr: "إجمالي المبيعات", value: f3(t.gross), strong: true },
    { label: `Refunds (${int(t.refundCount)})`, labelAr: "المرتجعات", value: t.refunds ? `−${f3(t.refunds)}` : f3(0) },
    { label: "Net sales", labelAr: "صافي المبيعات", value: f3(t.net), strong: true },
    { label: "VAT collected (net of refunds)", labelAr: "ضريبة القيمة المضافة", value: f3(t.vat - t.refundVat) },
    { label: "Net sales excl. VAT", labelAr: "صافي المبيعات قبل الضريبة", value: f3(t.netExVat), strong: true },
    { label: "Average sale", labelAr: "متوسط الفاتورة", value: f3(t.avgTicket) },
  ];
}

export default function SummaryTab({ query, single }: { query: string; single: boolean }) {
  const { data, loading, error } = useReport<Summary>("/api/reports/sales/summary", query);
  const { rangeLabel } = useReportCtx();
  const title = single ? "Daily sales summary" : "Sales summary";
  const titleAr = single ? "ملخص المبيعات اليومي" : "ملخص المبيعات";

  if (!data) return <StatusLine loading={loading} error={error} />;
  const t = data.totals;
  const sellerTotals = (k: keyof Figures) => data.bySeller.reduce((s, r) => s + (r[k] as number), 0);

  return (
    <div className="space-y-4">
      <StatusLine loading={loading} error={error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-800">
            {title} <span className="font-normal text-slate-400" dir="rtl">{titleAr}</span>
          </h2>
          <p className="text-xs text-slate-500">{rangeLabel} · generated {fmtDateTime(data.generatedAt)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => printArea("report-summary-a4", { page: "a4", title })} className="admin-btn admin-btn-secondary text-xs">
            <LuPrinter size={14} /> Print A4
          </button>
          <button onClick={() => printArea("report-summary-80", { page: "receipt", title })} className="admin-btn admin-btn-secondary text-xs">
            <LuReceipt size={14} /> Print 80 mm
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <FigureTable title="Totals" titleAr="الإجماليات" rows={totalsRows(t)} />
        <div className="space-y-4">
          <DataTable
            id="summary-methods"
            title="Payment methods"
            titleAr="طرق الدفع"
            compact
            rows={data.byMethod}
            rowKey={(r) => r.method}
            columns={[
              { key: "method", label: "Method", labelAr: "الطريقة", value: (r) => methodName(r.method) },
              { key: "tx", label: "Payments", kind: "int", value: (r) => r.transactions, total: data.byMethod.reduce((s, r) => s + r.transactions, 0) },
              { key: "amount", label: "Taken", labelAr: "المحصّل", kind: "money", value: (r) => r.amount, total: data.byMethod.reduce((s, r) => s + r.amount, 0) },
              { key: "refunds", label: "Refunded", labelAr: "المسترد", kind: "money", value: (r) => r.refunds, total: data.byMethod.reduce((s, r) => s + r.refunds, 0) },
              { key: "net", label: "Net", labelAr: "الصافي", kind: "money", value: (r) => r.net, total: data.byMethod.reduce((s, r) => s + r.net, 0) },
            ]}
            note={
              <>
                Cash in drawer from sales: <b>{f3(data.cash.sales)}</b> − cash refunds <b>{f3(data.cash.refunds)}</b> = <b>{f3(data.cash.net)} OMR</b>
                {data.unrecorded !== 0 && <> · {f3(data.unrecorded)} of paid sales have no payment record</>}
              </>
            }
          />
          <DataTable
            id="summary-channels"
            title="By channel"
            titleAr="حسب القناة"
            compact
            rows={data.byChannel}
            rowKey={(r) => r.channel}
            columns={[
              { key: "channel", label: "Channel", value: (r) => channelName(r.channel) },
              { key: "orders", label: "Sales", kind: "int", value: (r) => r.orders, total: t.orders },
              { key: "gross", label: "Gross", kind: "money", value: (r) => r.gross, total: t.gross },
              { key: "refunds", label: "Refunds", kind: "money", value: (r) => r.refunds, total: t.refunds },
              { key: "net", label: "Net", kind: "money", value: (r) => r.net, total: t.net },
            ]}
          />
        </div>
      </div>

      <DataTable
        id="summary-sellers"
        title="By salesperson"
        titleAr="حسب البائع"
        compact
        rows={data.bySeller}
        rowKey={(r) => r.sellerId}
        columns={[
          { key: "name", label: "Salesperson", labelAr: "البائع", value: (r) => r.name },
          { key: "orders", label: "Sales", kind: "int", value: (r) => r.orders, total: sellerTotals("orders") },
          { key: "items", label: "Items", kind: "int", value: (r) => r.items, total: sellerTotals("items") },
          { key: "gross", label: "Gross", kind: "money", value: (r) => r.gross, total: sellerTotals("gross") },
          { key: "refunds", label: "Refunds", kind: "money", value: (r) => r.refunds, total: sellerTotals("refunds") },
          { key: "net", label: "Net", kind: "money", value: (r) => r.net, total: sellerTotals("net") },
          { key: "avg", label: "Avg sale", kind: "money", value: (r) => r.avgTicket },
          { key: "share", label: "Share", kind: "pct", value: (r) => r.share },
          { key: "first", label: "First sale", value: (r) => (r.firstSale ? fmtTime(r.firstSale) : null), muted: true },
          { key: "last", label: "Last sale", value: (r) => (r.lastSale ? fmtTime(r.lastSale) : null), muted: true },
        ]}
      />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <DataTable
          id="summary-hours"
          title="By hour"
          titleAr="حسب الساعة"
          compact
          rows={data.byHour}
          rowKey={(r) => String(r.hour)}
          defaultSort={{ key: "hour", dir: "asc" }}
          columns={[
            { key: "hour", label: "Hour", value: (r) => r.hour, printValue: (r) => hourLabel(r.hour), render: (r) => hourLabel(r.hour) },
            { key: "orders", label: "Sales", kind: "int", value: (r) => r.orders, total: data.byHour.reduce((s, r) => s + r.orders, 0) },
            { key: "items", label: "Items", kind: "int", value: (r) => r.items, total: data.byHour.reduce((s, r) => s + r.items, 0) },
            { key: "gross", label: "Gross", kind: "money", value: (r) => r.gross, total: data.byHour.reduce((s, r) => s + r.gross, 0) },
            { key: "vat", label: "VAT", kind: "money", value: (r) => r.vat, total: data.byHour.reduce((s, r) => s + r.vat, 0) },
          ]}
        />
        <DataTable
          id="summary-top"
          title="Top 10 products"
          titleAr="أفضل المنتجات"
          compact
          rows={data.topProducts}
          rowKey={(r) => r.productId}
          columns={[
            { key: "name", label: "Product", value: (r) => r.nameEn },
            { key: "qty", label: "Qty", kind: "int", value: (r) => r.qty },
            { key: "shelf", label: "Shelf value", kind: "money", value: (r) => r.shelf, muted: true },
            { key: "paid", label: "Paid", kind: "money", value: (r) => r.paid },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <DataTable
          id="summary-refunds"
          title="Refunds by method"
          titleAr="المرتجعات حسب الطريقة"
          compact
          emptyText="No refunds in this period."
          rows={data.refundsByMethod}
          rowKey={(r) => r.method}
          columns={[
            { key: "method", label: "Refunded by", value: (r) => methodName(r.method) },
            { key: "count", label: "Returns", kind: "int", value: (r) => r.count, total: data.refundsByMethod.reduce((s, r) => s + r.count, 0) },
            { key: "vat", label: "VAT reversed", kind: "money", value: (r) => r.vat, total: data.refundsByMethod.reduce((s, r) => s + r.vat, 0) },
            { key: "amount", label: "Amount", kind: "money", value: (r) => r.amount, total: data.refundsByMethod.reduce((s, r) => s + r.amount, 0) },
          ]}
        />
        <DataTable
          id="summary-offers"
          title="Offers used"
          titleAr="العروض المستخدمة"
          compact
          emptyText="No offers were used in this period."
          rows={data.promotions}
          rowKey={(r) => r.promotionId}
          columns={[
            { key: "name", label: "Offer", value: (r) => r.nameEn },
            { key: "uses", label: "Sales", kind: "int", value: (r) => r.uses, total: data.promotions.reduce((s, r) => s + r.uses, 0) },
            { key: "units", label: "Units", kind: "int", value: (r) => r.units, total: data.promotions.reduce((s, r) => s + r.units, 0) },
            { key: "discount", label: "Discount given", kind: "money", value: (r) => r.discount, total: data.promotions.reduce((s, r) => s + r.discount, 0) },
          ]}
        />
      </div>

      <DataTable
        id="summary-shifts"
        title="POS register shifts"
        titleAr="ورديات نقاط البيع"
        compact
        emptyText="No POS shifts in this period."
        rows={data.shifts}
        rowKey={(r) => r.id}
        columns={[
          { key: "cashier", label: "Cashier", value: (r) => r.cashierName },
          { key: "opened", label: "Opened", value: (r) => fmtDateTime(r.openedAt) },
          { key: "closed", label: "Closed", value: (r) => (r.closedAt ? fmtDateTime(r.closedAt) : "Open") },
          { key: "sales", label: "Sales", kind: "int", value: (r) => r.salesCount },
          { key: "total", label: "Sales total", kind: "money", value: (r) => r.salesTotal },
          { key: "opening", label: "Opening cash", kind: "money", value: (r) => r.openingCash },
          { key: "cashSales", label: "Cash sales", kind: "money", value: (r) => r.byMethod.CASH ?? 0 },
          { key: "in", label: "Pay-ins", kind: "money", value: (r) => r.payIns },
          { key: "out", label: "Pay-outs", kind: "money", value: (r) => r.payOuts },
          { key: "cashRefunds", label: "Cash refunds", kind: "money", value: (r) => r.cashRefunds },
          { key: "expected", label: "Expected cash", kind: "money", value: (r) => r.expectedCash },
          { key: "counted", label: "Counted", kind: "money", value: (r) => r.closingCash },
          {
            key: "diff",
            label: "Difference",
            kind: "money",
            value: (r) => r.difference,
            render: (r) =>
              r.difference == null ? (
                "—"
              ) : (
                <span className={Math.abs(r.difference) < 0.0005 ? "text-emerald-700" : r.difference > 0 ? "text-amber-700" : "text-rose-700 font-semibold"}>
                  {r.difference > 0 ? "+" : ""}
                  {f3(r.difference)}
                </span>
              ),
          },
        ]}
      />

      <PrintArea id="report-summary-a4">
        <SummaryA4 data={data} title={title} titleAr={titleAr} />
      </PrintArea>
      <PrintArea id="report-summary-80">
        <Summary80 data={data} title={title} titleAr={titleAr} />
      </PrintArea>
    </div>
  );
}

// ───────────────────────── printouts ─────────────────────────

function PSection({ title, titleAr, children }: { title: string; titleAr: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }} className="print-avoid-break">
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 10.5, borderBottom: "1px solid #000", marginBottom: 3 }}>
        <span>{title}</span>
        <span dir="rtl">{titleAr}</span>
      </div>
      {children}
    </div>
  );
}

function PTable({ head, rows, foot }: { head: { label: string; right?: boolean }[]; rows: (string | number)[][]; foot?: (string | number)[] }) {
  return (
    <table style={printTable}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} style={printTh(h.right ? "right" : "left")}>{h.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} style={printTd(head[j]?.right ? "right" : "left")}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr>
            {foot.map((c, j) => (
              <td key={j} style={printTd(head[j]?.right ? "right" : "left", true)}>{c}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function SummaryA4({ data, title, titleAr }: { data: Summary; title: string; titleAr: string }) {
  const t = data.totals;
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
  return (
    <div style={{ fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif', color: "#000", fontSize: 10 }}>
      <PrintHeader title={title} titleAr={titleAr} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PSection title="Totals" titleAr="الإجماليات">
          <table style={printTable}>
            <tbody>
              {totalsRows(t).map((r, i) => (
                <tr key={i}>
                  <td style={printTd("left", !!r.strong)}>
                    {r.label} <span dir="rtl">· {r.labelAr}</span>
                  </td>
                  <td style={printTd("right", !!r.strong)}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PSection>
        <div>
          <PSection title="Payment methods" titleAr="طرق الدفع">
            <PTable
              head={[{ label: "Method / الطريقة" }, { label: "Taken", right: true }, { label: "Refunded", right: true }, { label: "Net", right: true }]}
              rows={data.byMethod.map((m) => [`${methodName(m.method)} / ${methodNameAr(m.method)}`, f3(m.amount), f3(m.refunds), f3(m.net)])}
              foot={["Total / الإجمالي", f3(sum(data.byMethod, (m) => m.amount)), f3(sum(data.byMethod, (m) => m.refunds)), f3(sum(data.byMethod, (m) => m.net))]}
            />
            <div style={{ marginTop: 3 }}>
              Cash from sales {f3(data.cash.sales)} − cash refunds {f3(data.cash.refunds)} = <b>{f3(data.cash.net)} OMR</b>
            </div>
          </PSection>
          <PSection title="By channel" titleAr="حسب القناة">
            <PTable
              head={[{ label: "Channel" }, { label: "Sales", right: true }, { label: "Gross", right: true }, { label: "Refunds", right: true }, { label: "Net", right: true }]}
              rows={data.byChannel.map((c) => [channelName(c.channel), int(c.orders), f3(c.gross), f3(c.refunds), f3(c.net)])}
            />
          </PSection>
        </div>
      </div>
      <PSection title="By salesperson" titleAr="حسب البائع">
        <PTable
          head={[{ label: "Salesperson" }, { label: "Sales", right: true }, { label: "Items", right: true }, { label: "Gross", right: true }, { label: "Refunds", right: true }, { label: "Net", right: true }, { label: "Share", right: true }]}
          rows={data.bySeller.map((s) => [s.name, int(s.orders), int(s.items), f3(s.gross), f3(s.refunds), f3(s.net), pct(s.share)])}
          foot={["Total / الإجمالي", int(sum(data.bySeller, (s) => s.orders)), int(sum(data.bySeller, (s) => s.items)), f3(sum(data.bySeller, (s) => s.gross)), f3(sum(data.bySeller, (s) => s.refunds)), f3(sum(data.bySeller, (s) => s.net)), ""]}
        />
      </PSection>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PSection title="By hour" titleAr="حسب الساعة">
          <PTable
            head={[{ label: "Hour" }, { label: "Sales", right: true }, { label: "Items", right: true }, { label: "Gross", right: true }]}
            rows={data.byHour.map((h) => [hourLabel(h.hour), int(h.orders), int(h.items), f3(h.gross)])}
          />
        </PSection>
        <PSection title="Top products" titleAr="أفضل المنتجات">
          <PTable head={[{ label: "Product" }, { label: "Qty", right: true }, { label: "Paid", right: true }]} rows={data.topProducts.map((p) => [p.nameEn, int(p.qty), f3(p.paid)])} />
        </PSection>
      </div>
      {data.refundsByMethod.length > 0 && (
        <PSection title="Refunds" titleAr="المرتجعات">
          <PTable
            head={[{ label: "Refunded by" }, { label: "Returns", right: true }, { label: "VAT", right: true }, { label: "Amount", right: true }]}
            rows={data.refundsByMethod.map((r) => [methodName(r.method), int(r.count), f3(r.vat), f3(r.amount)])}
          />
        </PSection>
      )}
      {data.promotions.length > 0 && (
        <PSection title="Offers used" titleAr="العروض المستخدمة">
          <PTable head={[{ label: "Offer" }, { label: "Sales", right: true }, { label: "Units", right: true }, { label: "Discount", right: true }]} rows={data.promotions.map((p) => [p.nameEn, int(p.uses), int(p.units), f3(p.discount)])} />
        </PSection>
      )}
      {data.shifts.length > 0 && (
        <PSection title="POS shifts" titleAr="الورديات">
          <PTable
            head={[{ label: "Cashier" }, { label: "Opened" }, { label: "Closed" }, { label: "Sales", right: true }, { label: "Expected cash", right: true }, { label: "Counted", right: true }, { label: "Difference", right: true }]}
            rows={data.shifts.map((s) => [s.cashierName, fmtDateTime(s.openedAt), s.closedAt ? fmtDateTime(s.closedAt) : "Open", f3(s.salesTotal), f3(s.expectedCash), s.closingCash == null ? "—" : f3(s.closingCash), s.difference == null ? "—" : f3(s.difference)])}
          />
        </PSection>
      )}
      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, fontSize: 9.5 }}>
        <div style={{ borderTop: "1px solid #000", paddingTop: 3 }}>Prepared by / أعدّه</div>
        <div style={{ borderTop: "1px solid #000", paddingTop: 3 }}>Checked by / راجعه</div>
      </div>
    </div>
  );
}

function Summary80({ data, title, titleAr }: { data: Summary; title: string; titleAr: string }) {
  const { store, rangeLabel, filterLabel } = useReportCtx();
  const t = data.totals;
  const Row = ({ l, v, b }: { l: string; v: string; b?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: b ? 700 : 400 }}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
  const Rule = () => <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />;
  return (
    <div style={{ width: "72mm", fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif', fontSize: 11, color: "#000", fontVariantNumeric: "tabular-nums" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{store.store_name_en || "Hala Dresses"}</div>
        {store.store_name_ar && <div dir="rtl" style={{ fontWeight: 700 }}>{store.store_name_ar}</div>}
        <div style={{ fontWeight: 700, marginTop: 4 }}>{title.toUpperCase()}</div>
        <div dir="rtl" style={{ fontWeight: 700 }}>{titleAr}</div>
        <div style={{ fontSize: 10 }}>{rangeLabel}</div>
        {filterLabel && <div style={{ fontSize: 10 }}>{filterLabel}</div>}
      </div>
      <Rule />
      <Row l="Sales" v={int(t.orders)} />
      <Row l="Items sold" v={int(t.items)} />
      <Row l="Offers" v={`-${f3(t.offers)}`} />
      <Row l="Discounts" v={`-${f3(t.discounts)}`} />
      <Row l="Delivery" v={f3(t.shipping)} />
      <Row l="Gross sales" v={f3(t.gross)} b />
      <Row l={`Refunds (${t.refundCount})`} v={`-${f3(t.refunds)}`} />
      <Row l="NET SALES" v={f3(t.net)} b />
      <Row l="VAT (net)" v={f3(t.vat - t.refundVat)} />
      <Row l="Net excl. VAT" v={f3(t.netExVat)} />
      <Rule />
      <div style={{ fontWeight: 700 }}>Payments / الدفع</div>
      {data.byMethod.map((m) => (
        <Row key={m.method} l={methodName(m.method)} v={f3(m.net)} />
      ))}
      <Row l="Net cash" v={f3(data.cash.net)} b />
      <Rule />
      <div style={{ fontWeight: 700 }}>Salespeople / البائعون</div>
      {data.bySeller.map((s) => (
        <Row key={s.sellerId} l={`${s.name} (${s.orders})`} v={f3(s.net)} />
      ))}
      {data.shifts.length > 0 && (
        <>
          <Rule />
          <div style={{ fontWeight: 700 }}>Shifts / الورديات</div>
          {data.shifts.map((s) => (
            <div key={s.id}>
              <Row l={`${s.cashierName} ${fmtTime(s.openedAt)}`} v={f3(s.salesTotal)} />
              <Row l="  Expected / counted" v={`${f3(s.expectedCash)} / ${s.closingCash == null ? "—" : f3(s.closingCash)}`} />
              {s.difference != null && <Row l="  Difference" v={f3(s.difference)} />}
            </div>
          ))}
        </>
      )}
      <Rule />
      <div style={{ textAlign: "center", fontSize: 10 }}>Printed {fmtDateTime(new Date().toISOString())}</div>
    </div>
  );
}
