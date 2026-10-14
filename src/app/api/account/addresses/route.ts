import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ok, error, unauthorized, serverError } from "@/lib/api/response";
import { addressSchema } from "@/lib/validations/account";

export async function GET(req: NextRequest) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const items = await prisma.address.findMany({ where: { userId: me.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getAuthFromRequest(req);
    if (!me) return unauthorized();
    const parsed = addressSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const count = await prisma.address.count({ where: { userId: me.id } });
    if (count >= 10) return error("You can save up to 10 addresses");
    const makeDefault = parsed.data.isDefault || count === 0;
    const created = await prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.address.updateMany({ where: { userId: me.id }, data: { isDefault: false } });
      return tx.address.create({ data: { ...parsed.data, isDefault: makeDefault, userId: me.id } });
    });
    return ok(created, 201);
  } catch (e) {
    return serverError(e);
  }
}
