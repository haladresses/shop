import { NextRequest } from "next/server";
import type { Prisma, PurchaseOrderStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, forbidden, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { userHasAnyPermission } from "@/lib/auth";
import { businessDayEnd, businessDayStart, isDateKey } from "@/lib/finance";
import { purchaseCreateSchema } from "@/lib/validations/purchasing";
import { nextDocumentNumber } from "@/lib/sequences";
import {
  PAYABLE_STATUSES,
  PurchasingError,
  TX_OPTIONS,
  buildPurchaseItems,
  num,
  parseDay,
  poOutstanding,
  purchasingErrorResponse,
  receivePurchaseLines,
  recalcPurchaseOrder,
  recordSupplierPayment,
  serializePurchaseOrderRow,
} from "@/lib/purchasing";
import { r3 } from "@/lib/taxCalc";
import { productCodeConditions } from "@/lib/barcodes";

const STATUSES: PurchaseOrderStatus[] = ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];

const LIST_SELECT = {
  id: true,
  number: true,
  status: true,
  supplierReference: true,
  orderDate: true,
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
  supplier: { select: { id: true, code: true, nameEn: true, nameAr: true } },
  items: { select: { quantity: true, receivedQty: true } },
} satisfies Prisma.PurchaseOrderSelect;

/**
 * Purchase orders.
 *   ?status=DRAFT|ORDERED|PARTIALLY_RECEIVED|RECEIVED|CANCELLED|open|received|all
 *     (open = awaiting delivery; received = has goods received — part or all)
 *   ?supplierId=  ?payment=unpaid|partial|paid|overdue|open  ?search=  ?from=&to= (order date)
 *   ?page=&pageSize=
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.suppliers.view", "admin.purchases.manage", "admin.purchases.receive"]);
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "all";
    const payment = sp.get("payment") || "";
    const search = (sp.get("search") || "").trim();
    const from = sp.get("from");
    const to = sp.get("to");
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "25")));

    const base: Prisma.PurchaseOrderWhereInput = {
      ...(sp.get("supplierId") && { supplierId: sp.get("supplierId")! }),
      ...(isDateKey(from) || isDateKey(to)
        ? {
            orderDate: {
              ...(isDateKey(from) ? { gte: businessDayStart(from) } : {}),
              ...(isDateKey(to) ? { lte: businessDayEnd(to) } : {}),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { number: { contains: search, mode: "insensitive" } },
          { supplierReference: { contains: search, mode: "insensitive" } },
          { supplier: { nameEn: { contains: search, mode: "insensitive" } } },
          { supplier: { code: { contains: search, mode: "insensitive" } } },
          { items: { some: { nameEn: { contains: search, mode: "insensitive" } } } },
          { items: { some: { OR: [{ barcode: search }, { sku: search }, { product: { OR: productCodeConditions(search) } }] } } },
        ],
      }),
    };
    const statusWhere: Prisma.PurchaseOrderWhereInput =
      status === "open"
        ? { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } }
        : status === "received"
          ? { status: { in: ["PARTIALLY_RECEIVED", "RECEIVED"] } }
          : STATUSES.includes(status as PurchaseOrderStatus)
          ? { status: status as PurchaseOrderStatus }
          : {};
    const paymentWhere: Prisma.PurchaseOrderWhereInput = payment
      ? payment === "paid"
        ? { status: { in: PAYABLE_STATUSES } }
        : { status: { in: PAYABLE_STATUSES }, amountPaid: { lt: prisma.purchaseOrder.fields.total } }
      : {};
    const where: Prisma.PurchaseOrderWhereInput = { AND: [base, statusWhere, paymentWhere] };
    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput[] = [{ orderDate: "desc" }, { createdAt: "desc" }];

    let rows: ReturnType<typeof serializePurchaseOrderRow>[];
    let total: number;
    if (payment) {
      // Payment state is derived (total − returns − paid), so filter in memory.
      const all = (await prisma.purchaseOrder.findMany({ where, orderBy, select: LIST_SELECT })).map(serializePurchaseOrderRow);
      const filtered = all.filter((r) =>
        payment === "unpaid"
          ? r.paymentStatus === "UNPAID"
          : payment === "partial"
            ? r.paymentStatus === "PARTIAL"
            : payment === "paid"
              ? r.paymentStatus === "PAID"
              : payment === "overdue"
                ? r.overdue
                : payment === "open"
                  ? r.outstanding > 0.0005
                  : true,
      );
      // Payables read best soonest-due first.
      if (payment === "open" || payment === "overdue") {
        filtered.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || (a.orderDate ?? "").localeCompare(b.orderDate ?? ""));
      }
      total = filtered.length;
      rows = filtered.slice((page - 1) * pageSize, page * pageSize);
    } else {
      const [list, count] = await Promise.all([
        prisma.purchaseOrder.findMany({ where, orderBy, select: LIST_SELECT, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.purchaseOrder.count({ where }),
      ]);
      rows = list.map(serializePurchaseOrderRow);
      total = count;
    }

    const [statusCounts, money] = await Promise.all([
      prisma.purchaseOrder.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
      prisma.purchaseOrder.findMany({
        where: { AND: [base, statusWhere, { status: { in: PAYABLE_STATUSES } }] },
        select: { status: true, total: true, returnedTotal: true, amountPaid: true, taxTotal: true },
      }),
    ]);
    const counts: Record<string, number> = { all: 0, open: 0 };
    for (const c of statusCounts) {
      counts[c.status] = c._count._all;
      counts.all += c._count._all;
      if (c.status === "ORDERED" || c.status === "PARTIALLY_RECEIVED") counts.open += c._count._all;
    }
    return ok({
      items: rows,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      counts,
      totals: {
        value: r3(money.reduce((s, p) => s + num(p.total), 0)),
        vat: r3(money.reduce((s, p) => s + num(p.taxTotal), 0)),
        outstanding: r3(money.reduce((s, p) => s + poOutstanding(p), 0)),
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Create a purchase order. mode: "draft" (default) · "order" (placed with the
 * supplier) · "receive" (placed and received in full right away — for goods
 * bought on the spot). An optional `payment` records money paid now.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.purchases.manage");
    if ("res" in g) return g.res;
    const parsed = purchaseCreateSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    if (d.payment && !(await userHasAnyPermission(g.user, ["admin.supplier_payments.manage"]))) return forbidden();

    const supplier = await prisma.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true, isActive: true } });
    if (!supplier) return error("Choose a supplier");
    if (!supplier.isActive) return error("This supplier is inactive. Reactivate it first.");

    const orderDate = parseDay(d.orderDate) ?? new Date();
    const result = await prisma.$transaction(async (tx) => {
      const items = await buildPurchaseItems(tx, d.items);
      const number = await nextDocumentNumber(tx, "PO", orderDate);
      const placed = d.mode !== "draft";
      const po = await tx.purchaseOrder.create({
        data: {
          number,
          supplierId: d.supplierId,
          status: placed ? "ORDERED" : "DRAFT",
          supplierReference: d.supplierReference,
          invoiceDate: parseDay(d.invoiceDate),
          orderDate,
          expectedDate: parseDay(d.expectedDate),
          dueDate: parseDay(d.dueDate),
          orderedAt: placed ? new Date() : null,
          pricesIncludeTax: d.pricesIncludeTax,
          discount: d.discount,
          shippingCost: d.shippingCost,
          otherCharges: d.otherCharges,
          notes: d.notes,
          attachments: d.attachments && d.attachments.length ? d.attachments : undefined,
          createdBy: g.user.id,
          items: { create: items },
        },
        include: { items: true },
      });
      await recalcPurchaseOrder(tx, po.id);

      let receiptNumber: string | null = null;
      if (d.mode === "receive") {
        const receipt = await receivePurchaseLines(
          tx,
          po.id,
          po.items.map((i) => ({ itemId: i.id, quantity: i.quantity })),
          { receivedAt: new Date(), userId: g.user.id, supplierReference: d.supplierReference, invoiceDate: parseDay(d.invoiceDate) },
        );
        receiptNumber = receipt.number;
      }

      let paymentNumber: string | null = null;
      if (d.payment) {
        if (d.mode === "draft") throw new PurchasingError("Place the order before paying for it.");
        const fresh = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: po.id },
          select: { status: true, total: true, returnedTotal: true, amountPaid: true },
        });
        const toThis = r3(Math.min(d.payment.amount, poOutstanding(fresh)));
        const res = await recordSupplierPayment(tx, {
          supplierId: d.supplierId,
          amount: d.payment.amount,
          method: d.payment.method,
          reference: d.payment.reference,
          paidAt: new Date(),
          note: `Paid with ${number}`,
          userId: g.user.id,
          autoAllocate: false,
          allocations: toThis > 0 ? [{ purchaseOrderId: po.id, amount: toThis }] : [],
        });
        paymentNumber = res.payment.number;
      }
      return { id: po.id, number, receiptNumber, paymentNumber };
    }, TX_OPTIONS);
    return ok(result, 201);
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
