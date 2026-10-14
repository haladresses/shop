import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { computeShiftSummary, getOpenShift, parseMovements } from "@/lib/posShift";

/** The signed-in cashier's open register shift (with live totals), or null. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "pos.access"))) return forbidden();

    const shift = await getOpenShift(user.id);
    return ok(shift ? await computeShiftSummary(shift.id) : null);
  } catch (e) {
    return serverError(e);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), openingCash: z.number().min(0) }),
  z.object({ action: z.literal("close"), closingCash: z.number().min(0), notes: z.string().max(500).optional() }),
  z.object({
    action: z.literal("movement"),
    type: z.enum(["IN", "OUT"]),
    amount: z.number().positive(),
    reason: z.string().trim().min(1, "Give a reason").max(200),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "pos.access"))) return forbidden();

    const parsed = actionSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const body = parsed.data;
    const open = await getOpenShift(user.id);

    if (body.action === "open") {
      if (open) return error("You already have an open shift.", 409);
      const shift = await prisma.posShift.create({
        data: { cashierId: user.id, openingCash: body.openingCash },
      });
      return ok(await computeShiftSummary(shift.id), 201);
    }

    if (!open) return error("No open shift.", 409);

    if (body.action === "movement") {
      const movements = [
        ...parseMovements(open.movements),
        { type: body.type, amount: body.amount, reason: body.reason, at: new Date().toISOString() },
      ];
      await prisma.posShift.update({ where: { id: open.id }, data: { movements } });
      return ok(await computeShiftSummary(open.id));
    }

    // close
    const summary = await computeShiftSummary(open.id);
    await prisma.posShift.update({
      where: { id: open.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingCash: body.closingCash,
        expectedCash: summary?.expectedCash ?? 0,
        notes: body.notes || null,
      },
    });
    return ok(await computeShiftSummary(open.id));
  } catch (e) {
    return serverError(e);
  }
}
