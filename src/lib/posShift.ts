import prisma from "@/lib/db";
import { round3 } from "@/lib/finance";

export type ShiftMovement = { type: "IN" | "OUT"; amount: number; reason: string; at: string };

export function parseMovements(raw: unknown): ShiftMovement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => (m ?? {}) as Record<string, unknown>)
    .filter((m) => (m.type === "IN" || m.type === "OUT") && Number(m.amount) > 0)
    .map((m) => ({
      type: m.type as "IN" | "OUT",
      amount: Number(m.amount),
      reason: String(m.reason ?? ""),
      at: String(m.at ?? ""),
    }));
}

export function getOpenShift(cashierId: string) {
  return prisma.posShift.findFirst({
    where: { cashierId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * Totals for one register shift: what was sold, how it was paid, and how much
 * cash should be in the drawer (opening float + cash taken − cash refunds ±
 * pay-ins/outs).
 */
export async function computeShiftSummary(shiftId: string) {
  const shift = await prisma.posShift.findUnique({
    where: { id: shiftId },
    include: { cashier: { select: { nameEn: true, nameAr: true } } },
  });
  if (!shift) return null;

  const end = shift.closedAt ?? new Date();
  const [orders, payments, refunds] = await Promise.all([
    prisma.order.aggregate({
      where: { posShiftId: shiftId },
      _count: true,
      _sum: { total: true, discount: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { order: { posShiftId: shiftId }, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.refund.findMany({
      where: { createdBy: shift.cashierId, createdAt: { gte: shift.openedAt, lte: end } },
      select: { amount: true, method: true },
    }),
  ]);

  const byMethod: Record<string, number> = {};
  for (const p of payments) byMethod[p.method] = round3(Number(p._sum.amount ?? 0));

  const movements = parseMovements(shift.movements);
  const payIns = movements.filter((m) => m.type === "IN").reduce((s, m) => s + m.amount, 0);
  const payOuts = movements.filter((m) => m.type === "OUT").reduce((s, m) => s + m.amount, 0);
  const cashRefunds = refunds.filter((r) => r.method === "CASH").reduce((s, r) => s + Number(r.amount), 0);
  const allRefunds = refunds.reduce((s, r) => s + Number(r.amount), 0);

  const expectedCash = Number(shift.openingCash) + (byMethod.CASH ?? 0) + payIns - payOuts - cashRefunds;

  return {
    id: shift.id,
    status: shift.status,
    cashierName: shift.cashier.nameEn || shift.cashier.nameAr || "",
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    openingCash: round3(Number(shift.openingCash)),
    closingCash: shift.closingCash == null ? null : round3(Number(shift.closingCash)),
    salesCount: orders._count,
    salesTotal: round3(Number(orders._sum.total ?? 0)),
    discounts: round3(Number(orders._sum.discount ?? 0)),
    byMethod,
    refunds: round3(allRefunds),
    cashRefunds: round3(cashRefunds),
    payIns: round3(payIns),
    payOuts: round3(payOuts),
    movements,
    expectedCash: round3(expectedCash),
    difference: shift.closingCash == null ? null : round3(Number(shift.closingCash) - expectedCash),
    notes: shift.notes,
  };
}

/** How many units of each order line earlier refunds already took back. */
export function returnedByLine(refunds: { items: unknown }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of refunds) {
    if (!Array.isArray(r.items)) continue;
    for (const raw of r.items) {
      const it = (raw ?? {}) as { orderItemId?: string; quantity?: number };
      if (it.orderItemId) map.set(it.orderItemId, (map.get(it.orderItemId) ?? 0) + Number(it.quantity ?? 0));
    }
  }
  return map;
}
