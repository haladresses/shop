import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { applyMovement } from "@/lib/inventory";

const receiveSchema = z.object({
  reference: z.string().trim().max(100).optional(),
  supplier: z.string().trim().max(100).optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitCost: z.number().min(0).optional().nullable(),
      }),
    )
    .min(1, "Add at least one item")
    .max(500),
});

/** Goods receipt: books a whole delivery (many lines) in one go. */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.inventory.manage"))) return forbidden();

    const parsed = receiveSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { reference, supplier, lines } = parsed.data;
    const note = supplier ? `Received from ${supplier}` : "Goods received";

    const result = await prisma.$transaction(
      async (tx) => {
        let units = 0;
        let value = 0;
        for (const l of lines) {
          await applyMovement(tx, { variantId: l.variantId, type: "PURCHASE", quantity: l.quantity, unitCost: l.unitCost ?? null, reference, note, userId: user.id });
          units += l.quantity;
          value += l.quantity * (l.unitCost ?? 0);
        }
        return { lines: lines.length, units, value: Math.round(value * 1000) / 1000 };
      },
      { timeout: 60000 },
    );
    return ok(result, 201);
  } catch (e) {
    if (e instanceof Error && /Inventory not found/.test(e.message)) return error(e.message, 409);
    return serverError(e);
  }
}
