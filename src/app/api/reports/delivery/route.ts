import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { ok, error, serverError } from "@/lib/api/response";
import { addDays, businessDayEnd, businessDayStart, daysBetween, isDateKey, round3, toBusinessDateKey } from "@/lib/finance";

/**
 * Shipping & delivery report.
 *   ?from=YYYY-MM-DD &to=YYYY-MM-DD   orders placed in this period (shop time)
 *   ?channel=ALL|ONLINE|POS           where the order was placed
 *   ?method=STANDARD|WASELLEE|STORE_PICKUP
 *
 * How orders are grouped:
 *   • Delivery = online orders sent to the customer (own driver or Wasellee).
 *   • Pickup   = online orders the customer collects from the shop.
 *   • In store = POS sales, handed over at the counter.
 * Stage comes from the order status: waiting (pending / confirmed /
 * processing), in transit (shipped), delivered, cancelled (cancelled or
 * refunded). Delivery fees count for orders that were not cancelled or
 * refunded. The "open" lists are the situation right now, whatever the period.
 */

type Kind = "STANDARD" | "WASELLEE_HOME" | "WASELLEE_OFFICE" | "PICKUP" | "IN_STORE";
type Stage = "waiting" | "transit" | "delivered" | "cancelled";

const KIND_ORDER: Kind[] = ["STANDARD", "WASELLEE_HOME", "WASELLEE_OFFICE", "PICKUP", "IN_STORE"];
const OPEN_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"] as const;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  source: true,
  shippingMethod: true,
  waselleeDeliveryType: true,
  waselleeBranch: { select: { cityEn: true } },
  shippingAddress: true,
  shippingCost: true,
  shippingTax: true,
  deliveryCost: true,
  trackingNumber: true,
  shippedAt: true,
  deliveredAt: true,
  total: true,
  guestName: true,
  user: { select: { nameEn: true, phone: true } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

const num = (v: unknown) => (v == null ? 0 : Number(v));
const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

function kindOf(o: OrderRow): Kind {
  if (o.source === "POS") return "IN_STORE";
  if (o.shippingMethod === "STORE_PICKUP") return "PICKUP";
  if (o.shippingMethod === "WASELLEE") return o.waselleeDeliveryType === "OFFICE_PICKUP" ? "WASELLEE_OFFICE" : "WASELLEE_HOME";
  return "STANDARD";
}

function stageOf(status: string): Stage {
  if (status === "DELIVERED") return "delivered";
  if (status === "SHIPPED") return "transit";
  if (status === "CANCELLED" || status === "REFUNDED") return "cancelled";
  return "waiting";
}

const isDelivery = (k: Kind) => k === "STANDARD" || k === "WASELLEE_HOME" || k === "WASELLEE_OFFICE";

function address(o: OrderRow) {
  const a = (o.shippingAddress ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  return { name: s("nameEn") || s("name"), phone: s("phone"), city: s("city"), area: s("area") };
}

/** Area used to group deliveries: the customer's city, else the Wasellee branch. */
function areaOf(o: OrderRow) {
  const city = address(o).city || o.waselleeBranch?.cityEn || "";
  if (!city) return "Not given";
  return city.replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function customerOf(o: OrderRow) {
  const a = address(o);
  return { customer: o.user?.nameEn || o.guestName || a.name || "Guest", phone: a.phone || o.user?.phone || "" };
}

type Bucket = {
  orders: number;
  waiting: number;
  transit: number;
  delivered: number;
  cancelled: number;
  fees: number;
  freeDeliveries: number;
  courierCost: number;
  costRecorded: number;
  shipHours: number[];
  deliverHours: number[];
};

const emptyBucket = (): Bucket => ({
  orders: 0, waiting: 0, transit: 0, delivered: 0, cancelled: 0, fees: 0,
  freeDeliveries: 0, courierCost: 0, costRecorded: 0, shipHours: [], deliverHours: [],
});

function add(b: Bucket, o: OrderRow) {
  const kind = kindOf(o);
  const stage = stageOf(o.status);
  b.orders++;
  b[stage]++;
  if (stage !== "cancelled") {
    b.fees += num(o.shippingCost);
    if (isDelivery(kind) && num(o.shippingCost) === 0) b.freeDeliveries++;
  }
  if (o.deliveryCost != null) {
    b.courierCost += num(o.deliveryCost);
    b.costRecorded++;
  }
  // Timing only means something for online orders (POS is handed over at once).
  if (kind !== "IN_STORE") {
    if (o.shippedAt && isDelivery(kind)) b.shipHours.push(hoursBetween(o.createdAt, o.shippedAt));
    if (o.deliveredAt) b.deliverHours.push(hoursBetween(o.createdAt, o.deliveredAt));
  }
}

const avg = (xs: number[]) => (xs.length ? round3(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

function finish(b: Bucket) {
  const active = b.orders - b.cancelled;
  return {
    orders: b.orders,
    waiting: b.waiting,
    transit: b.transit,
    delivered: b.delivered,
    cancelled: b.cancelled,
    deliveredRate: active > 0 ? round3((b.delivered / active) * 100) : 0,
    fees: round3(b.fees),
    avgFee: active > 0 ? round3(b.fees / active) : 0,
    freeDeliveries: b.freeDeliveries,
    courierCost: round3(b.courierCost),
    costRecorded: b.costRecorded,
    avgShipHours: avg(b.shipHours),
    avgDeliverHours: avg(b.deliverHours),
  };
}

function listRow(o: OrderRow, now: Date) {
  const { customer, phone } = customerOf(o);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    customer,
    phone,
    area: areaOf(o),
    kind: kindOf(o),
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: round3(num(o.total)),
    fee: round3(num(o.shippingCost)),
    courierCost: o.deliveryCost == null ? null : round3(num(o.deliveryCost)),
    trackingNumber: o.trackingNumber,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    ageDays: round3(hoursBetween(o.createdAt, now) / 24),
    daysInTransit: o.shippedAt && !o.deliveredAt ? round3(hoursBetween(o.shippedAt, now) / 24) : null,
    daysToDeliver: o.deliveredAt ? round3(hoursBetween(o.createdAt, o.deliveredAt) / 24) : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;

    const sp = req.nextUrl.searchParams;
    const todayKey = toBusinessDateKey(new Date());
    const toKey = isDateKey(sp.get("to")) ? sp.get("to")! : todayKey;
    const fromKey = isDateKey(sp.get("from")) ? sp.get("from")! : addDays(toKey, -29);
    if (fromKey > toKey) return error("'From' must be on or before 'To'.");
    if (daysBetween(fromKey, toKey) > 400) return error("That date range is too long for this report.");
    const channelRaw = (sp.get("channel") || "ALL").toUpperCase();
    const channel = channelRaw === "ONLINE" || channelRaw === "POS" ? channelRaw : "ALL";
    const methodRaw = (sp.get("method") || "").toUpperCase();
    const method = ["STANDARD", "WASELLEE", "STORE_PICKUP"].includes(methodRaw) ? methodRaw : "";

    const filter: Prisma.OrderWhereInput = {
      ...(channel !== "ALL" && { source: channel as "ONLINE" | "POS" }),
      ...(method && { shippingMethod: method as "STANDARD" | "WASELLEE" | "STORE_PICKUP" }),
    };

    const now = new Date();
    const [orders, open] = await Promise.all([
      prisma.order.findMany({
        where: { ...filter, createdAt: { gte: businessDayStart(fromKey), lte: businessDayEnd(toKey) } },
        select: ORDER_SELECT,
        orderBy: { createdAt: "asc" },
      }),
      // Right now: online orders that still need shipping, collecting or delivering.
      channel === "POS"
        ? Promise.resolve([] as OrderRow[])
        : prisma.order.findMany({
            where: { ...filter, source: "ONLINE", status: { in: [...OPEN_STATUSES] } },
            select: ORDER_SELECT,
            orderBy: { createdAt: "asc" },
          }),
    ]);

    // Summary, by delivery method, by area (deliveries only) and by day.
    const all = emptyBucket();
    const online = emptyBucket();
    const byKind = new Map<Kind, Bucket>();
    const byArea = new Map<string, Bucket>();
    const byDay = new Map<string, Bucket & { deliveries: number; pickups: number; inStore: number }>();
    let shippingTax = 0;
    for (const o of orders) {
      const kind = kindOf(o);
      add(all, o);
      if (kind !== "IN_STORE") add(online, o);
      if (!byKind.has(kind)) byKind.set(kind, emptyBucket());
      add(byKind.get(kind)!, o);
      if (isDelivery(kind)) {
        const area = areaOf(o);
        if (!byArea.has(area)) byArea.set(area, emptyBucket());
        add(byArea.get(area)!, o);
      }
      const day = toBusinessDateKey(o.createdAt);
      if (!byDay.has(day)) byDay.set(day, { ...emptyBucket(), deliveries: 0, pickups: 0, inStore: 0 });
      const d = byDay.get(day)!;
      add(d, o);
      if (isDelivery(kind)) d.deliveries++;
      else if (kind === "PICKUP") d.pickups++;
      else d.inStore++;
      if (stageOf(o.status) !== "cancelled") shippingTax += num(o.shippingTax);
    }

    const kinds = KIND_ORDER.filter((k) => byKind.has(k));
    const onlineRows = orders.filter((o) => o.source === "ONLINE");
    const openRows = open.map((o) => listRow(o, now));

    return ok({
      period: { from: fromKey, to: toKey },
      summary: {
        ...finish(all),
        online: finish(online),
        deliveries: kinds.filter(isDelivery).reduce((s, k) => s + byKind.get(k)!.orders, 0),
        pickups: byKind.get("PICKUP")?.orders ?? 0,
        inStore: byKind.get("IN_STORE")?.orders ?? 0,
        shippingTax: round3(shippingTax),
      },
      byMethod: kinds.map((k) => ({ kind: k, ...finish(byKind.get(k)!) })),
      byArea: [...byArea.entries()].map(([area, b]) => ({ area, ...finish(b) })),
      byDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, b]) => ({ day, deliveries: b.deliveries, pickups: b.pickups, inStore: b.inStore, ...finish(b) })),
      open: {
        toShip: openRows.filter((r) => isDelivery(r.kind) && r.status !== "SHIPPED"),
        inTransit: openRows.filter((r) => r.status === "SHIPPED"),
        toCollect: openRows.filter((r) => r.kind === "PICKUP" && r.status !== "SHIPPED"),
      },
      shipments: onlineRows.map((o) => listRow(o, now)).reverse(),
    });
  } catch (e) {
    return serverError(e);
  }
}
