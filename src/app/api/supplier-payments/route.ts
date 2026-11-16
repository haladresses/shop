import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { businessDayEnd, businessDayStart, isDateKey } from "@/lib/finance";
import { num } from "@/lib/purchasing";
import { r3 } from "@/lib/taxCalc";

/** Payment history. ?supplierId= ?method= ?from= ?to= ?search= ?page= ?pageSize= */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.suppliers.view");
    if ("res" in g) return g.res;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "25")));
    const from = sp.get("from");
    const to = sp.get("to");
    const search = (sp.get("search") || "").trim();
    const where: Prisma.SupplierPaymentWhereInput = {
      ...(sp.get("supplierId") && { supplierId: sp.get("supplierId")! }),
      ...(sp.get("method") && { method: sp.get("method")! }),
      ...(isDateKey(from) || isDateKey(to)
        ? {
            paidAt: {
              ...(isDateKey(from) ? { gte: businessDayStart(from) } : {}),
              ...(isDateKey(to) ? { lte: businessDayEnd(to) } : {}),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { number: { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { supplier: { nameEn: { contains: search, mode: "insensitive" } } },
          { supplier: { code: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };
    const [rows, total, sum] = await Promise.all([
      prisma.supplierPayment.findMany({
        where,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplier: { select: { id: true, code: true, nameEn: true, nameAr: true } },
          allocations: { select: { amount: true, purchaseOrder: { select: { id: true, number: true } } } },
        },
      }),
      prisma.supplierPayment.count({ where }),
      prisma.supplierPayment.aggregate({ where, _sum: { amount: true } }),
    ]);
    const userIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x)));
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nameEn: true, email: true } }) : [];
    const nameOf = new Map(users.map((u) => [u.id, u.nameEn || u.email]));
    return ok({
      items: rows.map((p) => ({
        id: p.id,
        number: p.number,
        amount: num(p.amount),
        method: p.method,
        reference: p.reference,
        paidAt: p.paidAt.toISOString(),
        note: p.note,
        supplier: p.supplier,
        createdBy: p.createdBy ? nameOf.get(p.createdBy) ?? "" : "",
        allocated: r3(p.allocations.reduce((s, a) => s + num(a.amount), 0)),
        allocations: p.allocations.map((a) => ({ amount: num(a.amount), purchaseOrder: a.purchaseOrder })),
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      sum: r3(num(sum._sum.amount)),
    });
  } catch (e) {
    return serverError(e);
  }
}
