import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, error, forbidden, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { userHasAnyPermission } from "@/lib/auth";
import { businessDayEnd, businessDayStart, isDateKey, toBusinessDateKey } from "@/lib/finance";
import { supplierReturnSchema } from "@/lib/validations/purchasing";
import {
  TX_OPTIONS,
  createSupplierReturn,
  num,
  parseDay,
  purchasingErrorResponse,
  refundNoteFor,
  serializePurchaseReturn,
} from "@/lib/purchasing";
import { r3 } from "@/lib/taxCalc";

const RETURN_INCLUDE = {
  supplier: { select: { id: true, code: true, nameEn: true, nameAr: true } },
  purchaseOrder: { select: { id: true, number: true } },
} satisfies Prisma.PurchaseReturnInclude;

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Returns to suppliers (debit notes).
 *   ?from=&to= (YYYY-MM-DD)  ?supplierId=  ?search=  ?page=&pageSize=  ?format=csv
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.suppliers.view");
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const search = (sp.get("search") || "").trim();
    const csv = sp.get("format") === "csv";
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "25")));

    const where: Prisma.PurchaseReturnWhereInput = {
      ...(sp.get("supplierId") && { supplierId: sp.get("supplierId")! }),
      ...(isDateKey(from) || isDateKey(to)
        ? {
            returnedAt: {
              ...(isDateKey(from) ? { gte: businessDayStart(from) } : {}),
              ...(isDateKey(to) ? { lte: businessDayEnd(to) } : {}),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { number: { contains: search, mode: "insensitive" } },
          { reason: { contains: search, mode: "insensitive" } },
          { supplier: { nameEn: { contains: search, mode: "insensitive" } } },
          { supplier: { code: { contains: search, mode: "insensitive" } } },
          { purchaseOrder: { number: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const monthStart = businessDayStart(`${toBusinessDateKey(new Date()).slice(0, 7)}-01`);
    const [rows, total, sum, month] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        orderBy: [{ returnedAt: "desc" }, { createdAt: "desc" }],
        include: RETURN_INCLUDE,
        skip: csv ? 0 : (page - 1) * pageSize,
        take: csv ? 10000 : pageSize,
      }),
      prisma.purchaseReturn.count({ where }),
      prisma.purchaseReturn.aggregate({ where, _sum: { total: true, taxTotal: true, subtotal: true } }),
      prisma.purchaseReturn.aggregate({ where: { returnedAt: { gte: monthStart } }, _sum: { total: true }, _count: { _all: true } }),
    ]);

    const userIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x)));
    const [users, refunds] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nameEn: true, email: true } }),
      prisma.supplierPayment.findMany({
        where: { note: { in: rows.map((r) => refundNoteFor(r.number)) }, amount: { lt: 0 } },
        select: { id: true, number: true, note: true, method: true, reference: true, amount: true },
      }),
    ]);
    const nameOf = new Map(users.map((u) => [u.id, u.nameEn || u.email]));
    const refundOf = new Map(refunds.map((p) => [p.note, p]));

    const items = rows.map((r) => {
      const refund = refundOf.get(refundNoteFor(r.number));
      return {
        ...serializePurchaseReturn(r),
        createdBy: r.createdBy ? nameOf.get(r.createdBy) ?? "" : "",
        settlement: refund ? "REFUND" : "CREDIT",
        refund: refund ? { id: refund.id, number: refund.number, method: refund.method, reference: refund.reference, amount: -num(refund.amount) } : null,
      };
    });

    if (csv) {
      const header = ["Debit note", "Date", "Supplier code", "Supplier", "Purchase order", "Units", "Net (OMR)", "VAT (OMR)", "Total (OMR)", "Settlement", "Reason", "Created by"];
      const lines = items.map((r) =>
        [r.number, r.returnedOn, r.supplier?.code, r.supplier?.nameEn, r.purchaseOrder?.number ?? "", r.units, r.subtotal.toFixed(3), r.taxTotal.toFixed(3), r.total.toFixed(3), r.settlement === "REFUND" ? `Refunded (${r.refund?.number})` : "Credit", r.reason ?? "", r.createdBy]
          .map(csvCell)
          .join(","),
      );
      return new NextResponse(`﻿${[header.join(","), ...lines].join("\n")}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="supplier-returns-${toBusinessDateKey(new Date())}.csv"`,
        },
      });
    }

    return ok({
      items,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      totals: {
        net: r3(num(sum._sum.subtotal)),
        vat: r3(num(sum._sum.taxTotal)),
        total: r3(num(sum._sum.total)),
      },
      month: { count: month._count._all, value: r3(num(month._sum.total)) },
    });
  } catch (e) {
    return serverError(e);
  }
}

/** Return goods to a supplier — against one of their orders or as stock not on any order. */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.purchases.receive", "admin.purchases.manage"]);
    if ("res" in g) return g.res;
    const parsed = supplierReturnSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    if (d.settlement === "REFUND" && !(await userHasAnyPermission(g.user, ["admin.supplier_payments.manage"]))) return forbidden();

    const res = await prisma.$transaction(
      (tx) =>
        createSupplierReturn(tx, {
          supplierId: d.supplierId,
          purchaseOrderId: d.purchaseOrderId ?? null,
          lines: d.purchaseOrderId ? d.lines : undefined,
          stockLines: d.purchaseOrderId ? undefined : d.stockLines,
          returnedAt: parseDay(d.returnedAt) ?? new Date(),
          reason: d.reason,
          settlement: d.settlement === "REFUND" ? { type: "REFUND", method: d.refundMethod, reference: d.refundReference } : { type: "CREDIT" },
          userId: g.user.id,
        }),
      TX_OPTIONS,
    );
    return ok(
      {
        id: res.ret.id,
        number: res.ret.number,
        units: res.units,
        subtotal: num(res.ret.subtotal),
        taxTotal: num(res.ret.taxTotal),
        total: num(res.ret.total),
        refund: res.refund,
      },
      201,
    );
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
