import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { supplierUpdateSchema } from "@/lib/validations/purchasing";
import {
  PAYABLE_STATUSES,
  TASK_INCLUDE,
  dayKey,
  num,
  refundNoteFor,
  serializePurchaseOrderRow,
  serializePurchaseReturn,
  serializeTask,
  supplierBalances,
} from "@/lib/purchasing";
import { r3 } from "@/lib/taxCalc";
import { productImageUrl } from "@/lib/productImage";

/** Supplier profile: details, balance, stats, orders, payments, returns, tasks, top products. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, ["admin.suppliers.view", "admin.purchases.manage"]);
    if ("res" in g) return g.res;
    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return notFound("Supplier");

    const [balances, orders, payments, returns, tasks, items] = await Promise.all([
      supplierBalances([id]),
      prisma.purchaseOrder.findMany({
        where: { supplierId: id },
        orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          number: true,
          status: true,
          supplierReference: true,
          orderDate: true,
          orderedAt: true,
          expectedDate: true,
          dueDate: true,
          receivedAt: true,
          createdAt: true,
          subtotal: true,
          discount: true,
          shippingCost: true,
          otherCharges: true,
          taxTotal: true,
          total: true,
          amountPaid: true,
          returnedTotal: true,
          items: { select: { quantity: true, receivedQty: true } },
        },
      }),
      prisma.supplierPayment.findMany({
        where: { supplierId: id },
        orderBy: { paidAt: "desc" },
        include: { allocations: { select: { amount: true, purchaseOrder: { select: { id: true, number: true } } } } },
      }),
      prisma.purchaseReturn.findMany({
        where: { supplierId: id },
        orderBy: { returnedAt: "desc" },
        include: { purchaseOrder: { select: { id: true, number: true } } },
      }),
      prisma.supplierTask.findMany({
        where: { supplierId: id },
        orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
        include: TASK_INCLUDE,
      }),
      prisma.purchaseOrderItem.findMany({
        where: { purchaseOrder: { supplierId: id, status: { in: PAYABLE_STATUSES } } },
        orderBy: { purchaseOrder: { orderDate: "desc" } },
        take: 3000,
        select: {
          productId: true,
          variantId: true,
          nameEn: true,
          nameAr: true,
          variantLabel: true,
          quantity: true,
          receivedQty: true,
          unitCost: true,
          netAmount: true,
          landedUnitCost: true,
          purchaseOrder: { select: { orderDate: true } },
          product: { select: { images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
        },
      }),
    ]);

    const refundNotes = new Set(payments.filter((p) => num(p.amount) < 0 && p.note).map((p) => p.note as string));
    const live = orders.filter((o) => PAYABLE_STATUSES.includes(o.status));
    const received = orders.filter((o) => o.status === "RECEIVED" && o.receivedAt);
    const leadTimes = received.map((o) => (o.receivedAt!.getTime() - (o.orderedAt ?? o.orderDate).getTime()) / 86400000);
    const withExpected = received.filter((o) => o.expectedDate);
    const onTime = withExpected.filter((o) => o.receivedAt! <= new Date(o.expectedDate!.getTime() + 86400000));

    // Top products by amount spent, with the most recent price paid.
    const top = new Map<string, { productId: string | null; nameEn: string; nameAr: string | null; imageUrl: string | null; units: number; spent: number; lastUnitCost: number; lastDate: string | null }>();
    for (const it of items) {
      const key = it.productId ?? `free:${it.nameEn}`;
      const cur = top.get(key);
      if (!cur) {
        top.set(key, {
          productId: it.productId,
          nameEn: it.nameEn,
          nameAr: it.nameAr,
          imageUrl: it.product ? productImageUrl(it.product.images) : null,
          units: it.quantity,
          spent: num(it.netAmount),
          lastUnitCost: num(it.unitCost),
          lastDate: dayKey(it.purchaseOrder.orderDate),
        });
      } else {
        cur.units += it.quantity;
        cur.spent = r3(cur.spent + num(it.netAmount));
      }
    }

    const b = balances.get(id)!;
    const creditLimit = supplier.creditLimit == null ? null : num(supplier.creditLimit);
    const rows = orders.map(serializePurchaseOrderRow);
    return ok({
      supplier: {
        ...supplier,
        creditLimit,
        openingBalance: num(supplier.openingBalance),
        createdAt: supplier.createdAt.toISOString(),
        updatedAt: supplier.updatedAt.toISOString(),
      },
      balance: b,
      stats: {
        purchasedTotal: r3(live.reduce((s, o) => s + num(o.total), 0)),
        ordersCount: orders.filter((o) => o.status !== "CANCELLED").length,
        openOrders: orders.filter((o) => o.status === "ORDERED" || o.status === "PARTIALLY_RECEIVED").length,
        drafts: orders.filter((o) => o.status === "DRAFT").length,
        lastOrderDate: dayKey(live[0]?.orderDate ?? null),
        avgLeadTimeDays: leadTimes.length ? Math.round((leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length) * 10) / 10 : null,
        onTimeRate: withExpected.length ? Math.round((onTime.length / withExpected.length) * 100) : null,
        unitsReceived: live.reduce((s, o) => s + o.items.reduce((t, i) => t + i.receivedQty, 0), 0),
        overdue: r3(rows.filter((r) => r.overdue).reduce((s, r) => s + r.outstanding, 0)),
        overdueCount: rows.filter((r) => r.overdue).length,
        returnedTotal: b.returned,
        overCreditLimit: creditLimit != null && creditLimit > 0 && b.balance > creditLimit,
      },
      orders: rows,
      payments: payments.map((p) => ({
        isRefund: num(p.amount) < 0,
        id: p.id,
        number: p.number,
        amount: num(p.amount),
        method: p.method,
        reference: p.reference,
        paidAt: p.paidAt.toISOString(),
        note: p.note,
        allocated: r3(p.allocations.reduce((s, a) => s + num(a.amount), 0)),
        allocations: p.allocations.map((a) => ({ amount: num(a.amount), purchaseOrder: a.purchaseOrder })),
      })),
      returns: returns.map((r) => ({
        ...serializePurchaseReturn(r),
        settlement: refundNotes.has(refundNoteFor(r.number)) ? "REFUND" : "CREDIT",
      })),
      tasks: tasks.map(serializeTask),
      topProducts: Array.from(top.values()).sort((a, b) => b.spent - a.spent).slice(0, 10),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.suppliers.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const existing = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFound("Supplier");
    const parsed = supplierUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    const updated = await prisma.supplier.update({
      where: { id },
      data: { ...d, ...(d.country ? { country: d.country.toUpperCase() } : {}) },
    });
    return ok({ ...updated, creditLimit: updated.creditLimit == null ? null : num(updated.creditLimit), openingBalance: num(updated.openingBalance) });
  } catch (e) {
    return serverError(e);
  }
}

/** Only a supplier with no history can be deleted; otherwise deactivate it. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.suppliers.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const s = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchaseOrders: true, payments: true, returns: true } } },
    });
    if (!s) return notFound("Supplier");
    const history = s._count.purchaseOrders + s._count.payments + s._count.returns;
    if (history > 0) {
      return error("This supplier has purchase orders or payments on record. Deactivate it instead so its history is kept.", 409);
    }
    await prisma.supplier.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
