import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { isValidPin, hashPin, PIN_LENGTH } from "@/lib/pos";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";

const bodySchema = z.object({
  pin: z.string().nullable(),
});

/** Set (or clear, with `pin: null`) a user's POS PIN. Admin-only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.users.manage"))) return forbidden();

    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return notFound("User");

    if (parsed.data.pin === null) {
      await prisma.user.update({
        where: { id },
        data: { posPinHash: null, posPinAttempts: 0, posPinLockedUntil: null },
      });
      return ok({ posPinSet: false });
    }

    if (!isValidPin(parsed.data.pin)) {
      return error(`PIN must be exactly ${PIN_LENGTH} digits`);
    }

    await prisma.user.update({
      where: { id },
      data: {
        posPinHash: await hashPin(parsed.data.pin),
        posPinAttempts: 0,
        posPinLockedUntil: null,
      },
    });

    return ok({ posPinSet: true });
  } catch (e) {
    return serverError(e);
  }
}
