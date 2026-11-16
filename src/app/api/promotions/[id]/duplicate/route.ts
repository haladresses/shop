import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { normalizePromotion, promotionInputSchema } from "@/lib/validations/promotion";
import { PROMOTION_ADMIN_INCLUDE, promotionData, promotionToInput, serializePromotion, targetRows } from "@/lib/promotionAdmin";

/** Copies a promotion (rules, items, schedule) as a new, paused promotion with no usage. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.promotions.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const source = await prisma.promotion.findUnique({ where: { id }, include: PROMOTION_ADMIN_INCLUDE });
    if (!source) return notFound("Promotion");

    const input = promotionToInput(source);
    const parsed = promotionInputSchema.safeParse({
      ...input,
      nameEn: `Copy of ${source.nameEn}`.slice(0, 120),
      nameAr: `نسخة من ${source.nameAr}`.slice(0, 120),
      isActive: false,
    });
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const n = normalizePromotion(parsed.data);

    const created = await prisma.promotion.create({
      data: { ...promotionData(n), createdBy: g.user.id, targets: { create: targetRows(n) } },
      include: PROMOTION_ADMIN_INCLUDE,
    });
    return ok(serializePromotion(created), 201);
  } catch (e) {
    return serverError(e);
  }
}
