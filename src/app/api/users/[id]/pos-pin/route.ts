import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { guard } from "@/lib/api/guard";
import { getActor, userBlockReason } from "@/lib/roles";
import { isValidPin, hashPin, PIN_LENGTH } from "@/lib/pos";
import { ok, error, notFound, serverError } from "@/lib/api/response";

const bodySchema = z.object({
  pin: z.string().nullable(),
});

/** Set (or clear, with `pin: null`) a user's POS PIN. Admin-only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.users.manage");
    if ("res" in g) return g.res;
    const admin = await getActor(g.user);

    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return notFound("User");
    // Your own PIN, or someone below you: never a peer or senior.
    if (admin.id !== user.id) {
      const reason = await userBlockReason(admin, user);
      if (reason) return error(reason, 403);
    }

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
