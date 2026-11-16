import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { businessDayStart, toBusinessDateKey } from "@/lib/finance";
import {
  PAYABLE_STATUSES,
  addDaysTo,
  dayKey,
  daysOverdue,
  isPoOverdue,
  num,
  poOutstanding,
  supplierBalances,
  todayStart,
} from "@/lib/purchasing";
import { r3 } from "@/lib/taxCalc";

/** Purchasing dashboard: what we owe, what's overdue, what's coming, what needs doing. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.suppliers.view");
    if ("res" in g) return g.res;

    const today = todayStart();
    const tomorrow = addDaysTo(today, 1);
    const in7 = addDaysTo(today, 8);
    const monthStart = businessDayStart(`${toBusinessDateKey(new Date()).slice(0, 7)}-01`);

    const [suppliers, balances, openPos, awaiting, monthPurchases, monthPayments, tasks, monthReturns, monthRefunds] = await Promise.all([
      prisma.supplier.findMany({ select: { id: true, code: true, nameEn: true, nameAr: true, isActive: true } }),
      supplierBalances(),
      prisma.purchaseOrder.findMany({
        where: { status: { in: PAYABLE_STATUSES }, amountPaid: { lt: prisma.purchaseOrder.fields.total } },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          returnedTotal: true,
          amountPaid: true,
          dueDate: true,
          orderDate: true,
          supplier: { select: { id: true, nameEn: true, code: true } },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
        select: { id: true, number: true, total: true, expectedDate: true, supplier: { select: { id: true, nameEn: true } } },
        orderBy: [{ expectedDate: { sort: "asc", nulls: "last" } }],
      }),
      prisma.purchaseOrder.aggregate({
        where: { status: { in: PAYABLE_STATUSES }, orderDate: { gte: monthStart } },
        _sum: { total: true, taxTotal: true },
        _count: { _all: true },
      }),
      prisma.supplierPayment.aggregate({ where: { paidAt: { gte: monthStart }, amount: { gt: 0 } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.supplierTask.findMany({ where: { status: { not: "DONE" } }, select: { dueDate: true } }),
      prisma.purchaseReturn.aggregate({ where: { returnedAt: { gte: monthStart } }, _sum: { total: true }, _count: { _all: true } }),
      prisma.supplierPayment.aggregate({ where: { paidAt: { gte: monthStart }, amount: { lt: 0 } }, _sum: { amount: true } }),
    ]);

    let totalPayable = 0;
    let totalCredit = 0;
    let netBalance = 0;
    for (const b of balances.values()) {
      netBalance += b.balance;
      if (b.balance > 0) totalPayable += b.balance;
      else totalCredit += -b.balance;
    }

    const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    let outstandingSum = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let dueSoonAmount = 0;
    let dueSoonCount = 0;
    const open = openPos
      .map((po) => ({ po, outstanding: poOutstanding(po) }))
      .filter((x) => x.outstanding > 0.0005);
    for (const { po, outstanding } of open) {
      outstandingSum += outstanding;
      const days = isPoOverdue(po, today) ? daysOverdue(po.dueDate, today) : 0;
      if (days === 0) aging.current += outstanding;
      else if (days <= 30) aging.d1_30 += outstanding;
      else if (days <= 60) aging.d31_60 += outstanding;
      else if (days <= 90) aging.d61_90 += outstanding;
      else aging.d90plus += outstanding;
      if (days > 0) {
        overdueAmount += outstanding;
        overdueCount++;
      } else if (po.dueDate && po.dueDate < in7) {
        dueSoonAmount += outstanding;
        dueSoonCount++;
      }
    }

    const nameOf = new Map(suppliers.map((s) => [s.id, s]));
    const topSuppliers = Array.from(balances.entries())
      .filter(([, b]) => b.balance > 0.0005)
      .sort((a, b) => b[1].balance - a[1].balance)
      .slice(0, 5)
      .map(([id, b]) => ({ id, code: nameOf.get(id)?.code ?? "", nameEn: nameOf.get(id)?.nameEn ?? "", balance: b.balance }));

    const upcoming = open
      .filter((x) => x.po.dueDate)
      .sort((a, b) => (a.po.dueDate!.getTime() - b.po.dueDate!.getTime()))
      .slice(0, 10)
      .map(({ po, outstanding }) => ({
        id: po.id,
        number: po.number,
        supplier: po.supplier,
        dueDate: dayKey(po.dueDate),
        outstanding,
        daysOverdue: isPoOverdue(po, today) ? daysOverdue(po.dueDate, today) : 0,
      }));

    const late = awaiting.filter((p) => p.expectedDate && p.expectedDate < today);

    return ok({
      suppliers: { total: suppliers.length, active: suppliers.filter((s) => s.isActive).length },
      totalPayable: r3(totalPayable),
      totalCredit: r3(totalCredit),
      netBalance: r3(netBalance),
      overdue: { amount: r3(overdueAmount), count: overdueCount },
      dueSoon: { amount: r3(dueSoonAmount), count: dueSoonCount },
      aging: {
        current: r3(aging.current),
        d1_30: r3(aging.d1_30),
        d31_60: r3(aging.d31_60),
        d61_90: r3(aging.d61_90),
        d90plus: r3(aging.d90plus),
        // Opening balances still owed, minus payments not tied to an order.
        onAccount: r3(netBalance - outstandingSum),
      },
      awaitingDelivery: {
        count: awaiting.length,
        value: r3(awaiting.reduce((s, p) => s + num(p.total), 0)),
        late: late.length,
        lateOrders: late.slice(0, 5).map((p) => ({ id: p.id, number: p.number, supplier: p.supplier, expectedDate: dayKey(p.expectedDate) })),
      },
      month: {
        purchases: r3(num(monthPurchases._sum.total)),
        purchaseVat: r3(num(monthPurchases._sum.taxTotal)),
        orders: monthPurchases._count._all,
        payments: r3(num(monthPayments._sum.amount)),
        paymentsCount: monthPayments._count._all,
        returns: r3(num(monthReturns._sum.total)),
        returnsCount: monthReturns._count._all,
        refunds: r3(-num(monthRefunds._sum.amount)),
      },
      tasks: {
        open: tasks.length,
        overdue: tasks.filter((t) => t.dueDate && t.dueDate < today).length,
        dueToday: tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow).length,
      },
      topSuppliers,
      upcoming,
    });
  } catch (e) {
    return serverError(e);
  }
}
