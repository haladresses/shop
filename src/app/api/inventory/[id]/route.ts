import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";

const patchSchema = z.object({
  lowStockAlert: z.number().int().min(0).max(100000).optional(),
  location: z.string().trim().max(60).optional().nullable(),
});

/** Edit an inventory record's reorder level and shelf/bin location. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.inventory.manage"))) return forbidden();
    const { id } = await params;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const existing = await prisma.inventory.findUnique({ where: { id } });
    if (!existing) return notFound("Inventory");
    const updated = await prisma.inventory.update({
      where: { id },
      data: { ...parsed.data, location: parsed.data.location === "" ? null : parsed.data.location },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
