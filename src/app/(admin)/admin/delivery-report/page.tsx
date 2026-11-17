"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toBusinessDateKey } from "@/lib/finance";
import type { StoreInfo } from "@/lib/invoice";
import { DEFAULT_TAX_SETTINGS, type TaxSettings } from "@/lib/taxCalc";
import { PRESETS, presetRange, rangeLabel, type Preset } from "@/components/admin/reports/Filters";
import { DataTable, FigureTable, ReportContext, StatusLine, f3, fmtDateTime, fmtDay, int, useReport } from "@/components/admin/reports/shared";
import { orderStatusLabel, paymentStatusLabel } from "@/components/admin/labels";

// Shipping Report: how online orders get to customers (own driver, Wasellee,
// store pickup) next to in-store POS sales. Tables and plain figures only.
// Filters and the open tab live in the URL so a view can be bookmarked.

type Kind = "STANDARD" | "WASELLEE_HOME" | "WASELLEE_OFFICE" | "PICKUP" | "IN_STORE";

type Figures = {
  orders: number;
  waiting: number;
  transit: number;
  delivered: number;
  cancelled: number;
  deliveredRate: number;
  fees: number;
  avgFee: number;
  freeDeliveries: number;
  courierCost: number;
  costRecorded: number;
  avgShipHours: number | null;
  avgDeliverHours: number | null;
};

type ListRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customer: string;
  phone: string;
  area: string;
  kind: Kind;
  status: string;
  paymentStatus: string;
  total: number;
  fee: number;
  courierCost: number | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  ageDays: number;
  daysInTransit: number | null;
  daysToDeliver: number | null;
};

type Data = {
  summary: Figures & { online: Figures; deliveries: number; pickups: number; inStore: number; shippingTax: number };
  byMethod: (Figures & { kind: Kind })[];
  byArea: (Figures & { area: string })[];
  byDay: (Figures & { day: string; deliveries: number; pickups: number; inStore: number })[];
  open: { toShip: ListRow[]; inTransit: ListRow[]; toCollect: ListRow[] };
  shipments: ListRow[];
};

const KIND_LABEL: Record<Kind, { en: string; ar: string }> = {
  STANDARD: { en: "Standard delivery", ar: "توصيل عادي" },
  WASELLEE_HOME: { en: "Wasellee, home delivery", ar: "وصلي، توصيل للمنزل" },
  WASELLEE_OFFICE: { en: "Wasellee, office pickup", ar: "وصلي، استلام من المكتب" },
  PICKUP: { en: "Store pickup", ar: "استلام من المتجر" },
  IN_STORE: { en: "In store (POS)", ar: "داخل المتجر" },
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "open", label: "Open orders" },
  { id: "shipments", label: "All shipments" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 5.5 hours / 2.3 days. */
function duration(hours: number | null | undefined) {
  if (hours == null) return "-";
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}
const days = (d: number | null | undefined) => (d == null ? "-" : `${d.toFixed(1)}`);

export default function DeliveryReportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <DeliveryReport />
    </Suspense>
  );
}

function DeliveryReport() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tab = (TABS.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "overview") as Tab;
  const preset = (PRESETS.some((p) => p.id === sp.get("preset")) ? sp.get("preset") : "this-month") as Preset;
  const today = toBusinessDateKey(new Date());
  const range =
    preset === "custom"
      ? { from: DATE_RE.test(sp.get("from") || "") ? sp.get("from")! : today, to: DATE_RE.test(sp.get("to") || "") ? sp.get("to")! : today }
      : presetRange(preset, today);
  const from = range.from;
  const to = range.to < range.from ? range.from : range.to;
  const channel = sp.get("channel") || "";
  const method = sp.get("method") || "";

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (next.get("preset") !== "custom") {
        next.delete("from");
        next.delete("to");
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  const query = useMemo(() => {
    const q = new URLSearchParams({ from, to });
    if (channel) q.set("channel", channel);
    if (method) q.set("method", method);
    return q.toString();
  }, [from, to, channel, method]);

  const { data, loading, error } = useReport<Data>("/api/reports/delivery", query);

  const [store, setStore] = useState<StoreInfo>({});
  const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);
  useEffect(() => {
    fetch("/api/settings?group=general").then((r) => r.json()).then((d) => d.success && setStore(d.data)).catch(() => {});
    fetch("/api/tax/settings").then((r) => r.json()).then((d) => d.success && setTax(d.data)).catch(() => {});
  }, []);

  const filterParts = [
    channel && `Channel: ${channel === "POS" ? "In store" : "Online"}`,
    method && `Method: ${method === "STANDARD" ? "Standard delivery" : method === "WASELLEE" ? "Wasellee" : "Store pickup"}`,
  ].filter(Boolean);
  const ctx = useMemo(
    () => ({
      store,
      tax,
      rangeLabel: rangeLabel(from, to),
      filterLabel: filterParts.join(" · "),
      fileStem: `shipping-${from === to ? from : `${from}_${to}`}`,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, tax, from, to, channel, method],
  );

  const openCount = data ? data.open.toShip.length + data.open.inTransit.length + data.open.toCollect.length : 0;
  const openOrder = (r: ListRow) => router.push(`/admin/orders?view=${r.id}`);

  return (
    <ReportContext value={ctx}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            {ctx.rangeLabel}
            {ctx.filterLabel && ` · ${ctx.filterLabel}`}
          </p>
          <p className="text-xs text-slate-400 max-w-md">
            Orders placed in the period. Delivery fees count for orders that were not cancelled or refunded. &ldquo;Open orders&rdquo; shows what is waiting right now.
          </p>
        </div>

        {/* Filters */}
        <div className="admin-card p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  p.id === "custom"
                    ? setParams({ preset: "custom", from, to })
                    : setParams({ preset: p.id === "this-month" ? undefined : p.id })
                }
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  preset === p.id ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">From</span>
              <input type="date" className="admin-input" value={from} max={to} onChange={(e) => e.target.value && setParams({ preset: "custom", from: e.target.value, to })} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">To</span>
              <input type="date" className="admin-input" value={to} min={from} onChange={(e) => e.target.value && setParams({ preset: "custom", from, to: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Channel</span>
              <select className="admin-input admin-select" value={channel} onChange={(e) => setParams({ channel: e.target.value || undefined })}>
                <option value="">Online and in store</option>
                <option value="ONLINE">Online</option>
                <option value="POS">In store (POS)</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Delivery method</span>
              <select className="admin-input admin-select" value={method} onChange={(e) => setParams({ method: e.target.value || undefined })}>
                <option value="">All methods</option>
                <option value="STANDARD">Standard delivery</option>
                <option value="WASELLEE">Wasellee</option>
                <option value="STORE_PICKUP">Store pickup / in store</option>
              </select>
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 -mx-1 px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setParams({ tab: t.id === "overview" ? undefined : t.id })}
              className={`shrink-0 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.id ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {t.id === "open" && data ? ` (${openCount})` : ""}
            </button>
          ))}
        </div>

        <StatusLine loading={loading} error={error} />
        {data && tab === "overview" && <Overview data={data} />}
        {data && tab === "open" && <OpenOrders data={data} onOpen={openOrder} />}
        {data && tab === "shipments" && <Shipments rows={data.shipments} onOpen={openOrder} />}
      </div>
    </ReportContext>
  );
}

function Overview({ data }: { data: Data }) {
  const s = data.summary;
  const o = s.online;
  const net = o.fees - o.courierCost;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FigureTable
          title="Orders"
          titleAr="الطلبات"
          rows={[
            { label: "Online orders", labelAr: "طلبات أونلاين", value: int(o.orders), strong: true },
            { label: "Sent for delivery", labelAr: "للتوصيل", value: int(s.deliveries) },
            { label: "Store pickup", labelAr: "استلام من المتجر", value: int(s.pickups) },
            { label: "In-store sales (POS)", labelAr: "مبيعات داخل المتجر", value: int(s.inStore), muted: true },
            { label: "Waiting (not shipped yet)", labelAr: "بانتظار الشحن", value: int(o.waiting) },
            { label: "In transit", labelAr: "قيد التوصيل", value: int(o.transit) },
            { label: "Delivered / collected", labelAr: "تم التسليم", value: int(o.delivered), strong: true },
            { label: "Cancelled or refunded", labelAr: "ملغي أو مسترد", value: int(o.cancelled) },
            { label: "Delivered rate", labelAr: "نسبة التسليم", value: `${o.deliveredRate.toFixed(1)}%` },
          ]}
        />
        <FigureTable
          title="Fees, costs and timing"
          titleAr="الرسوم والتكلفة والمدة"
          rows={[
            { label: "Delivery fees charged", labelAr: "رسوم التوصيل المحصلة", value: `${f3(o.fees)} OMR`, strong: true },
            { label: "of which VAT", labelAr: "منها ضريبة القيمة المضافة", value: `${f3(s.shippingTax)} OMR`, muted: true },
            { label: "Average fee per order", labelAr: "متوسط الرسوم للطلب", value: `${f3(o.avgFee)} OMR` },
            { label: "Free deliveries", labelAr: "توصيل مجاني", value: int(o.freeDeliveries) },
            {
              label: `Courier cost (recorded on ${int(o.costRecorded)} orders)`,
              labelAr: "تكلفة التوصيل المسجلة",
              value: `${f3(o.courierCost)} OMR`,
            },
            { label: "Fees minus recorded courier cost", labelAr: "الرسوم ناقص التكلفة", value: `${f3(net)} OMR`, strong: true },
            { label: "Average time to ship", labelAr: "متوسط مدة الشحن", value: duration(o.avgShipHours) },
            { label: "Average time to deliver", labelAr: "متوسط مدة التسليم", value: duration(o.avgDeliverHours) },
          ]}
        />
      </div>

      <DataTable
        id="by-method"
        title="By delivery method"
        titleAr="حسب طريقة التوصيل"
        subtitle="Every order in the period, including in-store sales, grouped by how it reached the customer."
        rows={data.byMethod}
        rowKey={(r) => r.kind}
        emptyText="No orders in this period."
        columns={[
          { key: "kind", label: "Method", labelAr: "الطريقة", value: (r) => KIND_LABEL[r.kind].en, className: "font-medium" },
          { key: "orders", label: "Orders", labelAr: "الطلبات", kind: "int", value: (r) => r.orders, total: s.orders },
          { key: "waiting", label: "Waiting", kind: "int", value: (r) => r.waiting, total: s.waiting },
          { key: "transit", label: "In transit", kind: "int", value: (r) => r.transit, total: s.transit },
          { key: "delivered", label: "Delivered", labelAr: "تم التسليم", kind: "int", value: (r) => r.delivered, total: s.delivered },
          { key: "cancelled", label: "Cancelled", kind: "int", value: (r) => r.cancelled, total: s.cancelled, muted: true },
          { key: "rate", label: "Delivered %", kind: "pct", value: (r) => r.deliveredRate },
          { key: "fees", label: "Fees", labelAr: "الرسوم", kind: "money", value: (r) => r.fees, total: s.fees, className: "font-medium" },
          { key: "free", label: "Free", kind: "int", value: (r) => r.freeDeliveries, total: s.freeDeliveries },
          { key: "cost", label: "Courier cost", kind: "money", value: (r) => r.courierCost, total: s.courierCost },
          { key: "ship", label: "Avg. to ship", value: (r) => duration(r.avgShipHours) },
          { key: "deliver", label: "Avg. to deliver", value: (r) => duration(r.avgDeliverHours) },
        ]}
      />

      <DataTable
        id="by-area"
        title="Deliveries by area"
        titleAr="التوصيل حسب المنطقة"
        subtitle="Orders sent for delivery, grouped by the customer's city (or the Wasellee branch)."
        rows={data.byArea}
        rowKey={(r) => r.area}
        defaultSort={{ key: "orders", dir: "desc" }}
        emptyText="No deliveries in this period."
        columns={[
          { key: "area", label: "Area", labelAr: "المنطقة", value: (r) => r.area, className: "font-medium" },
          { key: "orders", label: "Orders", labelAr: "الطلبات", kind: "int", value: (r) => r.orders, total: data.byArea.reduce((n, r) => n + r.orders, 0) },
          { key: "waiting", label: "Waiting", kind: "int", value: (r) => r.waiting },
          { key: "transit", label: "In transit", kind: "int", value: (r) => r.transit },
          { key: "delivered", label: "Delivered", kind: "int", value: (r) => r.delivered, total: data.byArea.reduce((n, r) => n + r.delivered, 0) },
          { key: "cancelled", label: "Cancelled", kind: "int", value: (r) => r.cancelled, muted: true },
          { key: "fees", label: "Fees", kind: "money", value: (r) => r.fees, total: data.byArea.reduce((n, r) => n + r.fees, 0) },
          { key: "avgFee", label: "Avg. fee", kind: "money", value: (r) => r.avgFee },
          { key: "cost", label: "Courier cost", kind: "money", value: (r) => r.courierCost, total: data.byArea.reduce((n, r) => n + r.courierCost, 0) },
          { key: "deliver", label: "Avg. to deliver", value: (r) => duration(r.avgDeliverHours) },
        ]}
      />

      <DataTable
        id="by-day"
        title="By day"
        titleAr="حسب اليوم"
        subtitle="Orders placed each day and where they stand now."
        rows={data.byDay}
        rowKey={(r) => r.day}
        defaultSort={{ key: "day", dir: "asc" }}
        emptyText="No orders in this period."
        columns={[
          { key: "day", label: "Date", labelAr: "التاريخ", value: (r) => r.day, render: (r) => <span className="whitespace-nowrap">{fmtDay(r.day)}</span>, printValue: (r) => fmtDay(r.day) },
          { key: "deliveries", label: "For delivery", kind: "int", value: (r) => r.deliveries, total: s.deliveries },
          { key: "pickups", label: "Pickup", kind: "int", value: (r) => r.pickups, total: s.pickups },
          { key: "inStore", label: "In store", kind: "int", value: (r) => r.inStore, total: s.inStore, muted: true },
          { key: "delivered", label: "Delivered", kind: "int", value: (r) => r.delivered, total: s.delivered },
          { key: "open", label: "Still open", kind: "int", value: (r) => r.waiting + r.transit, total: s.waiting + s.transit },
          { key: "cancelled", label: "Cancelled", kind: "int", value: (r) => r.cancelled, total: s.cancelled, muted: true },
          { key: "fees", label: "Fees", kind: "money", value: (r) => r.fees, total: s.fees, className: "font-medium" },
        ]}
      />
    </div>
  );
}

const orderLink = (r: ListRow) => <span className="font-medium text-indigo-700 whitespace-nowrap">{r.orderNumber}</span>;

function OpenOrders({ data, onOpen }: { data: Data; onOpen: (r: ListRow) => void }) {
  const late = (r: ListRow) => (r.ageDays >= 2 ? "bg-amber-50" : "");
  return (
    <div className="space-y-4">
      <DataTable
        id="to-ship"
        title="Waiting to ship"
        titleAr="بانتظار الشحن"
        subtitle="Delivery orders not shipped yet, oldest first. Rows waiting 2 days or more are highlighted. Click a row to open the order."
        rows={data.open.toShip}
        rowKey={(r) => r.id}
        defaultSort={{ key: "created", dir: "asc" }}
        onRowClick={onOpen}
        rowClassName={late}
        emptyText="Nothing waiting to ship."
        columns={[
          { key: "order", label: "Order", labelAr: "الطلب", value: (r) => r.orderNumber, render: orderLink },
          { key: "created", label: "Placed", value: (r) => r.createdAt, render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>, printValue: (r) => fmtDateTime(r.createdAt) },
          { key: "age", label: "Days waiting", kind: "text", value: (r) => days(r.ageDays) },
          { key: "customer", label: "Customer", value: (r) => r.customer },
          { key: "phone", label: "Phone", value: (r) => r.phone },
          { key: "area", label: "Area", value: (r) => r.area },
          { key: "kind", label: "Method", value: (r) => KIND_LABEL[r.kind].en },
          { key: "status", label: "Status", value: (r) => orderStatusLabel(r.status) },
          { key: "payment", label: "Payment", value: (r) => paymentStatusLabel(r.paymentStatus) },
          { key: "total", label: "Total", kind: "money", value: (r) => r.total, total: data.open.toShip.reduce((n, r) => n + r.total, 0) },
        ]}
      />
      <DataTable
        id="in-transit"
        title="In transit"
        titleAr="قيد التوصيل"
        subtitle="Shipped but not delivered yet. Click a row to open the order."
        rows={data.open.inTransit}
        rowKey={(r) => r.id}
        defaultSort={{ key: "shipped", dir: "asc" }}
        onRowClick={onOpen}
        rowClassName={(r) => ((r.daysInTransit ?? 0) >= 3 ? "bg-amber-50" : "")}
        emptyText="Nothing in transit."
        columns={[
          { key: "order", label: "Order", labelAr: "الطلب", value: (r) => r.orderNumber, render: orderLink },
          { key: "shipped", label: "Shipped", value: (r) => r.shippedAt, render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.shippedAt)}</span>, printValue: (r) => fmtDateTime(r.shippedAt) },
          { key: "transit", label: "Days in transit", kind: "text", value: (r) => days(r.daysInTransit) },
          { key: "customer", label: "Customer", value: (r) => r.customer },
          { key: "phone", label: "Phone", value: (r) => r.phone },
          { key: "area", label: "Area", value: (r) => r.area },
          { key: "kind", label: "Method", value: (r) => KIND_LABEL[r.kind].en },
          { key: "tracking", label: "Tracking no.", value: (r) => r.trackingNumber },
          { key: "payment", label: "Payment", value: (r) => paymentStatusLabel(r.paymentStatus) },
          { key: "total", label: "Total", kind: "money", value: (r) => r.total, total: data.open.inTransit.reduce((n, r) => n + r.total, 0) },
        ]}
      />
      <DataTable
        id="to-collect"
        title="Waiting for collection"
        titleAr="بانتظار الاستلام من المتجر"
        subtitle="Store-pickup orders the customer has not collected yet. Click a row to open the order."
        rows={data.open.toCollect}
        rowKey={(r) => r.id}
        defaultSort={{ key: "created", dir: "asc" }}
        onRowClick={onOpen}
        rowClassName={late}
        emptyText="Nothing waiting for collection."
        columns={[
          { key: "order", label: "Order", labelAr: "الطلب", value: (r) => r.orderNumber, render: orderLink },
          { key: "created", label: "Placed", value: (r) => r.createdAt, render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>, printValue: (r) => fmtDateTime(r.createdAt) },
          { key: "age", label: "Days waiting", kind: "text", value: (r) => days(r.ageDays) },
          { key: "customer", label: "Customer", value: (r) => r.customer },
          { key: "phone", label: "Phone", value: (r) => r.phone },
          { key: "status", label: "Status", value: (r) => orderStatusLabel(r.status) },
          { key: "payment", label: "Payment", value: (r) => paymentStatusLabel(r.paymentStatus) },
          { key: "total", label: "Total", kind: "money", value: (r) => r.total, total: data.open.toCollect.reduce((n, r) => n + r.total, 0) },
        ]}
      />
    </div>
  );
}

function Shipments({ rows, onOpen }: { rows: ListRow[]; onOpen: (r: ListRow) => void }) {
  return (
    <DataTable
      id="shipments"
      title="All shipments"
      titleAr="جميع الشحنات"
      subtitle="Every online order placed in the period with its delivery details. Click a row to open the order."
      rows={rows}
      rowKey={(r) => r.id}
      defaultSort={{ key: "created", dir: "desc" }}
      onRowClick={onOpen}
      emptyText="No online orders in this period."
      printLandscape
      columns={[
        { key: "order", label: "Order", labelAr: "الطلب", value: (r) => r.orderNumber, render: orderLink },
        { key: "created", label: "Placed", value: (r) => r.createdAt, render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>, printValue: (r) => fmtDateTime(r.createdAt) },
        { key: "customer", label: "Customer", value: (r) => r.customer },
        { key: "phone", label: "Phone", value: (r) => r.phone },
        { key: "area", label: "Area", value: (r) => r.area },
        { key: "kind", label: "Method", value: (r) => KIND_LABEL[r.kind].en },
        { key: "status", label: "Status", value: (r) => orderStatusLabel(r.status) },
        { key: "fee", label: "Fee", kind: "money", value: (r) => r.fee, total: rows.reduce((n, r) => n + (["CANCELLED", "REFUNDED"].includes(r.status) ? 0 : r.fee), 0) },
        { key: "cost", label: "Courier cost", kind: "money", value: (r) => r.courierCost, total: rows.reduce((n, r) => n + (r.courierCost ?? 0), 0) },
        { key: "tracking", label: "Tracking no.", value: (r) => r.trackingNumber },
        { key: "shipped", label: "Shipped", value: (r) => r.shippedAt, render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.shippedAt)}</span>, printValue: (r) => fmtDateTime(r.shippedAt) },
        { key: "delivered", label: "Delivered", value: (r) => r.deliveredAt, render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.deliveredAt)}</span>, printValue: (r) => fmtDateTime(r.deliveredAt) },
        { key: "days", label: "Days to deliver", kind: "text", value: (r) => days(r.daysToDeliver) },
        { key: "total", label: "Order total", kind: "money", value: (r) => r.total, total: rows.reduce((n, r) => n + r.total, 0) },
      ]}
    />
  );
}
