import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ok, error, unauthorized, notFound, serverError } from "@/lib/api/response";
import { addressSchema } from "@/lib/validations/account";

type Ctx = { params: Promise<{ id: string }> };

/** Only ever finds the address when it belongs to the signed-in user. */
async function own(req: NextRequest, ctx: Ctx) {
  const me = await getAuthFromRequest(req);
  if (!me) return { me: null, address: null };
  const { id } = await ctx.params;
  const address = await prisma.address.findFirst({ where: { id, userId: me.id } });
  return { me, address };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { me, address } = await own(req, ctx);
    if (!me) return unauthorized();
    if (!address) return notFound("Address");
    const parsed = addressSchema.partial().safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) await tx.address.updateMany({ where: { userId: me.id }, data: { isDefault: false } });
      return tx.address.update({ where: { id: address.id }, data: parsed.data });
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { me, address } = await own(req, ctx);
    if (!me) return unauthorized();
    if (!address) return notFound("Address");
    await prisma.address.delete({ where: { id: address.id } });
    if (address.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId: me.id }, orderBy: { createdAt: "desc" } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return ok({ id: address.id });
  } catch (e) {
    return serverError(e);
  }
}
