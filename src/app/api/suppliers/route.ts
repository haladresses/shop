import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { supplierSchema } from "@/lib/validations/purchasing";
import { nextDocumentNumber } from "@/lib/sequences";
import {
  PAYABLE_STATUSES,
  TX_OPTIONS,
  dayKey,
  daysOverdue,
  isPoOverdue,
  num,
  poOutstanding,
  supplierBalances,
} from "@/lib/purchasing";
import { r3 } from "@/lib/taxCalc";

/**
 * Supplier list with live balances.
 *   ?search=  ?status=active|inactive|all  ?filter=owing|overdue|credit
 *   ?sort=name|balance|recent|overdue  ?page= &pageSize=
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.suppliers.view", "admin.purchases.manage"]);
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;
    const search = (sp.get("search") || "").trim();
    const status = sp.get("status") || "active";
    const filter = sp.get("filter") || "";
    const sort = sp.get("sort") || "name";
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(500, Math.max(1, parseInt(sp.get("pageSize") || "25")));

    const where: Prisma.SupplierWhereInput = {
      ...(status === "active" && { isActive: true }),
      ...(status === "inactive" && { isActive: false }),
      ...(search && {
        OR: [
          { nameEn: { contains: search, mode: "insensitive" } },
          { nameAr: { contains: search } },
          { code: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { contactPerson: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { vatNumber: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const suppliers = await prisma.supplier.findMany({
      where,
      select: {
        id: true,
        code: true,
        nameEn: true,
        nameAr: true,
        category: true,
        contactPerson: true,
        phone: true,
        whatsapp: true,
        email: true,
        city: true,
        country: true,
        vatNumber: true,
        paymentTermsDays: true,
        creditLimit: true,
        rating: true,
        isActive: true,
        createdAt: true,
      },
    });
    const ids = suppliers.map((s) => s.id);

    const [balances, openPos, activity] = await Promise.all([
      supplierBalances(ids),
      prisma.purchaseOrder.findMany({
        where: {
          supplierId: { in: ids },
          status: { in: PAYABLE_STATUSES },
          amountPaid: { lt: prisma.purchaseOrder.fields.total },
        },
        select: { supplierId: true, status: true, total: true, returnedTotal: true, amountPaid: true, dueDate: true },
      }),
      prisma.purchaseOrder.groupBy({
        by: ["supplierId"],
        where: { supplierId: { in: ids }, status: { not: "CANCELLED" } },
        _max: { orderDate: true },
        _count: { _all: true },
      }),
    ]);
    const awaiting = await prisma.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: ids }, status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
      _count: { _all: true },
    });
    const awaitingBy = new Map(awaiting.map((a) => [a.supplierId, a._count._all]));
    const activityBy = new Map(activity.map((a) => [a.supplierId, a]));

    const overdueBy = new Map<string, { amount: number; count: number; maxDays: number; nextDue: Date | null }>();
    for (const po of openPos) {
      if (poOutstanding(po) <= 0.0005) continue;
      const cur = overdueBy.get(po.supplierId) ?? { amount: 0, count: 0, maxDays: 0, nextDue: null };
      if (isPoOverdue(po)) {
        cur.amount = r3(cur.amount + poOutstanding(po));
        cur.count++;
        cur.maxDays = Math.max(cur.maxDays, daysOverdue(po.dueDate));
      }
      if (po.dueDate && (!cur.nextDue || po.dueDate < cur.nextDue)) cur.nextDue = po.dueDate;
      overdueBy.set(po.supplierId, cur);
    }

    let rows = suppliers.map((s) => {
      const b = balances.get(s.id);
      const o = overdueBy.get(s.id);
      const a = activityBy.get(s.id);
      const balance = b?.balance ?? 0;
      const creditLimit = s.creditLimit == null ? null : num(s.creditLimit);
      return {
        ...s,
        creditLimit,
        createdAt: s.createdAt.toISOString(),
        balance,
        purchased: b?.purchased ?? 0,
        paid: b?.paid ?? 0,
        overdue: o?.amount ?? 0,
        overdueCount: o?.count ?? 0,
        maxDaysOverdue: o?.maxDays ?? 0,
        nextDueDate: dayKey(o?.nextDue ?? null),
        openOrders: awaitingBy.get(s.id) ?? 0,
        ordersCount: a?._count._all ?? 0,
        lastOrderDate: dayKey(a?._max.orderDate ?? null),
        overCreditLimit: creditLimit != null && creditLimit > 0 && balance > creditLimit,
      };
    });

    if (filter === "owing") rows = rows.filter((r) => r.balance > 0.0005);
    else if (filter === "overdue") rows = rows.filter((r) => r.overdue > 0.0005);
    else if (filter === "credit") rows = rows.filter((r) => r.balance < -0.0005);

    rows.sort((a, b) => {
      if (sort === "balance") return b.balance - a.balance || a.nameEn.localeCompare(b.nameEn);
      if (sort === "overdue") return b.overdue - a.overdue || b.balance - a.balance;
      if (sort === "recent") return (b.lastOrderDate ?? "").localeCompare(a.lastOrderDate ?? "") || a.nameEn.localeCompare(b.nameEn);
      return a.nameEn.localeCompare(b.nameEn);
    });

    const total = rows.length;
    const totals = {
      balance: r3(rows.reduce((s, r) => s + r.balance, 0)),
      payable: r3(rows.reduce((s, r) => s + Math.max(0, r.balance), 0)),
      overdue: r3(rows.reduce((s, r) => s + r.overdue, 0)),
    };
    return ok({
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      totals,
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.suppliers.manage");
    if ("res" in g) return g.res;
    const parsed = supplierSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    const created = await prisma.$transaction(async (tx) => {
      const code = await nextDocumentNumber(tx, "SUP");
      return tx.supplier.create({
        data: { ...d, country: d.country.toUpperCase(), code, createdBy: g.user.id },
      });
    }, TX_OPTIONS);
    return ok({ ...created, creditLimit: created.creditLimit == null ? null : num(created.creditLimit), openingBalance: num(created.openingBalance) }, 201);
  } catch (e) {
    return serverError(e);
  }
}
