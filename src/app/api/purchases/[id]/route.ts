import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, notFound } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { purchaseOrderUpdateSchema } from "@/lib/validations/purchasing";
import {
  EDITABLE_STATUSES,
  PurchasingError,
  TASK_INCLUDE,
  TX_OPTIONS,
  buildPurchaseItems,
  dayKey,
  num,
  parseDay,
  purchasingErrorResponse,
  recalcPurchaseOrder,
  serializePoMoney,
  serializeTask,
  supplierBalances,
} from "@/lib/purchasing";

/** Full purchase order: lines, deliveries, returns, payments, tasks and supplier. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, ["admin.suppliers.view", "admin.purchases.manage", "admin.purchases.receive"]);
    if ("res" in g) return g.res;
    const { id } = await params;
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: { select: { id: true, isActive: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
            variant: { select: { id: true, isActive: true, inventory: { select: { quantity: true } } } },
          },
        },
        receipts: { orderBy: { receivedAt: "desc" } },
        returns: { orderBy: { returnedAt: "desc" } },
        allocations: {
          include: { payment: { select: { id: true, number: true, paidAt: true, method: true, reference: true, amount: true } } },
          orderBy: { payment: { paidAt: "desc" } },
        },
        tasks: { include: TASK_INCLUDE, orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }] },
      },
    });
    if (!po) return notFound("Purchase order");

    const userIds = [po.createdBy, ...po.receipts.map((r) => r.createdBy), ...po.returns.map((r) => r.createdBy)].filter((x): x is string => !!x);
    const [users, balances] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, nameEn: true, email: true } }),
      supplierBalances([po.supplierId]),
    ]);
    const nameOf = new Map(users.map((u) => [u.id, u.nameEn || u.email]));
    const hasReceipts = po.items.some((i) => i.receivedQty > 0);

    return ok({
      id: po.id,
      number: po.number,
      status: po.status,
      supplierReference: po.supplierReference,
      invoiceDate: dayKey(po.invoiceDate),
      orderDate: dayKey(po.orderDate),
      expectedDate: dayKey(po.expectedDate),
      dueDate: dayKey(po.dueDate),
      orderedAt: po.orderedAt?.toISOString() ?? null,
      receivedAt: po.receivedAt?.toISOString() ?? null,
      cancelledAt: po.cancelledAt?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      createdBy: po.createdBy ? nameOf.get(po.createdBy) ?? "" : "",
      pricesIncludeTax: po.pricesIncludeTax,
      notes: po.notes,
      attachments: Array.isArray(po.attachments) ? po.attachments : [],
      ...serializePoMoney(po),
      canEditAll: EDITABLE_STATUSES.includes(po.status) && !hasReceipts,
      hasReceipts,
      supplier: {
        id: po.supplier.id,
        code: po.supplier.code,
        nameEn: po.supplier.nameEn,
        nameAr: po.supplier.nameAr,
        contactPerson: po.supplier.contactPerson,
        phone: po.supplier.phone,
        whatsapp: po.supplier.whatsapp,
        email: po.supplier.email,
        address: po.supplier.address,
        city: po.supplier.city,
        country: po.supplier.country,
        vatNumber: po.supplier.vatNumber,
        crNumber: po.supplier.crNumber,
        paymentTermsDays: po.supplier.paymentTermsDays,
        isActive: po.supplier.isActive,
        balance: balances.get(po.supplierId)?.balance ?? 0,
      },
      items: po.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        nameEn: i.nameEn,
        nameAr: i.nameAr,
        variantLabel: i.variantLabel,
        sku: i.sku,
        barcode: i.barcode,
        imageUrl: i.product?.images[0]?.url ?? null,
        productActive: i.product?.isActive ?? null,
        onHand: i.variant?.inventory?.quantity ?? null,
        quantity: i.quantity,
        receivedQty: i.receivedQty,
        returnedQty: i.returnedQty,
        unitCost: num(i.unitCost),
        discountPct: num(i.discountPct),
        taxRate: num(i.taxRate),
        taxCode: i.taxCode,
        netAmount: num(i.netAmount),
        taxAmount: num(i.taxAmount),
        landedUnitCost: i.landedUnitCost == null ? null : num(i.landedUnitCost),
      })),
      receipts: po.receipts.map((r) => ({
        id: r.id,
        number: r.number,
        receivedAt: r.receivedAt.toISOString(),
        units: r.units,
        value: num(r.value),
        note: r.note,
        items: r.items,
        createdBy: r.createdBy ? nameOf.get(r.createdBy) ?? "" : "",
      })),
      returns: po.returns.map((r) => ({
        id: r.id,
        number: r.number,
        returnedAt: r.returnedAt.toISOString(),
        subtotal: num(r.subtotal),
        taxTotal: num(r.taxTotal),
        total: num(r.total),
        reason: r.reason,
        items: r.items,
        createdBy: r.createdBy ? nameOf.get(r.createdBy) ?? "" : "",
      })),
      payments: po.allocations.map((a) => ({
        allocationId: a.id,
        amount: num(a.amount),
        payment: { ...a.payment, amount: num(a.payment.amount), paidAt: a.payment.paidAt.toISOString() },
      })),
      tasks: po.tasks.map(serializeTask),
    });
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}

const HEADER_FIELDS = ["supplierReference", "invoiceDate", "expectedDate", "dueDate", "notes", "attachments"] as const;

/**
 * Edit an order. Everything can change while it's a draft / placed and
 * nothing has arrived; after that only references, dates, notes and
 * attachments (prices are already in the stock value).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.purchases.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const parsed = purchaseOrderUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;

    await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: { select: { id: true, receivedQty: true } }, _count: { select: { allocations: true } } },
      });
      if (!po) throw new PurchasingError("Purchase order not found", 404);
      const hasReceipts = po.items.some((i) => i.receivedQty > 0);
      const fullEdit = EDITABLE_STATUSES.includes(po.status) && !hasReceipts;

      const touched = Object.keys(d).filter((k) => (d as Record<string, unknown>)[k] !== undefined);
      if (po.status === "CANCELLED" && touched.some((k) => k !== "notes" && k !== "attachments")) {
        throw new PurchasingError("A cancelled order can only have its notes changed.", 409);
      }
      if (!fullEdit && touched.some((k) => !(HEADER_FIELDS as readonly string[]).includes(k))) {
        throw new PurchasingError("Goods have been received on this order. Only references, dates, notes and attachments can be changed now.", 409);
      }
      if (d.supplierId && d.supplierId !== po.supplierId) {
        if (po._count.allocations > 0) throw new PurchasingError("This order has payments against it. The supplier can't be changed.", 409);
        const s = await tx.supplier.findUnique({ where: { id: d.supplierId }, select: { isActive: true } });
        if (!s || !s.isActive) throw new PurchasingError("Choose an active supplier.");
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(d.supplierId !== undefined && { supplierId: d.supplierId }),
          ...(d.supplierReference !== undefined && { supplierReference: d.supplierReference }),
          ...(d.invoiceDate !== undefined && { invoiceDate: parseDay(d.invoiceDate) }),
          ...(d.orderDate !== undefined && { orderDate: parseDay(d.orderDate) ?? po.orderDate }),
          ...(d.expectedDate !== undefined && { expectedDate: parseDay(d.expectedDate) }),
          ...(d.dueDate !== undefined && { dueDate: parseDay(d.dueDate) }),
          ...(d.pricesIncludeTax !== undefined && { pricesIncludeTax: d.pricesIncludeTax }),
          ...(d.discount !== undefined && { discount: d.discount }),
          ...(d.shippingCost !== undefined && { shippingCost: d.shippingCost }),
          ...(d.otherCharges !== undefined && { otherCharges: d.otherCharges }),
          ...(d.notes !== undefined && { notes: d.notes }),
          ...(d.attachments !== undefined && { attachments: d.attachments }),
        },
      });

      if (d.items) {
        const built = await buildPurchaseItems(tx, d.items);
        const keep = new Set(d.items.map((i) => i.id).filter((x): x is string => !!x && po.items.some((e) => e.id === x)));
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id, id: { notIn: Array.from(keep) } } });
        for (let i = 0; i < built.length; i++) {
          const existingId = d.items[i].id;
          if (existingId && keep.has(existingId)) {
            await tx.purchaseOrderItem.update({ where: { id: existingId }, data: built[i] });
          } else {
            await tx.purchaseOrderItem.create({ data: { ...built[i], purchaseOrderId: id } });
          }
        }
      }
      if (fullEdit) await recalcPurchaseOrder(tx, id);
    }, TX_OPTIONS);
    return ok({ id });
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}

/** Deletes a draft (placed orders are cancelled instead, to keep the trail). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.purchases.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
    if (!po) return notFound("Purchase order");
    if (po.status !== "DRAFT") return error("Only drafts can be deleted. Cancel the order instead.", 409);
    await prisma.purchaseOrder.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
