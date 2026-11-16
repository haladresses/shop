import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { receiveSchema } from "@/lib/validations/purchasing";
import { TX_OPTIONS, num, parseDay, purchasingErrorResponse, receivePurchaseLines } from "@/lib/purchasing";

/**
 * Receive a delivery (all or part of the order). Stock goes up straight away
 * and each product's purchase price moves to the weighted-average landed cost.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, ["admin.purchases.receive", "admin.purchases.manage"]);
    if ("res" in g) return g.res;
    const { id } = await params;
    const parsed = receiveSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    const receipt = await prisma.$transaction(
      (tx) =>
        receivePurchaseLines(tx, id, d.lines, {
          receivedAt: parseDay(d.receivedAt) ?? new Date(),
          note: d.note,
          supplierReference: d.supplierReference,
          invoiceDate: parseDay(d.invoiceDate),
          userId: g.user.id,
        }),
      TX_OPTIONS,
    );
    return ok(
      {
        id: receipt.id,
        number: receipt.number,
        units: receipt.units,
        value: num(receipt.value),
        items: receipt.items,
      },
      201,
    );
  } catch (e) {
    return purchasingErrorResponse(e);
  }
}
