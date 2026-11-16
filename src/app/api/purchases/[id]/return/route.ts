import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, forbidden } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { userHasAnyPermission } from "@/lib/auth";
import { purchaseReturnSchema } from "@/lib/validations/purchasing";
import { TX_OPTIONS, num, parseDay, purchasingErrorResponse, returnPurchaseLines } from "@/lib/purchasing";

/** Send received goods back to the supplier (debit note). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, ["admin.purchases.receive", "admin.purchases.manage"]);
    if ("res" in g) return g.res;
    const { id } = await params;
    const parsed = purchaseReturnSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    if (d.settlement === "REFUND" && !(await userHasAnyPermission(g.user, ["admin.supplier_payments.manage"]))) return forbidden();
    const ret = await prisma.$transaction(
      (tx) =>
        returnPurchaseLines(tx, id, d.lines, {
          returnedAt: parseDay(d.returnedAt) ?? new Date(),
          reason: d.reason,
          userId: g.user.id,
          settlement: d.settlement === "REFUND" ? { type: "REFUND", method: d.refundMethod, reference: d.refundReference } : { type: "CREDIT" },
        }),
      TX_OPTIONS,
    );
    return ok({ id: ret.id, number: ret.number, subtotal: num(ret.subtotal), taxTotal: num(ret.taxTotal), total: num(ret.total), items: ret.items }, 201);
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
