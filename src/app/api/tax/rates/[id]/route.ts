import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, notFound, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { normalizeRateForType, taxRateSchema } from "@/lib/tax";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.tax.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const existing = await prisma.taxRate.findUnique({ where: { id } });
    if (!existing) return notFound("Tax rate");

    const parsed = taxRateSchema.partial().safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    if (existing.isDefault && (d.isActive === false || d.isDefault === false)) {
      return error("This is the default rate — make another rate the default first.");
    }
    const type = d.type ?? existing.type;
    const rate = d.rate ?? Number(existing.rate);

    const updated = await prisma.$transaction(async (tx) => {
      if (d.isDefault) await tx.taxRate.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      return tx.taxRate.update({
        where: { id },
        data: {
          ...(d.code !== undefined && { code: d.code }),
          ...(d.nameEn !== undefined && { nameEn: d.nameEn }),
          ...(d.nameAr !== undefined && { nameAr: d.nameAr }),
          ...(d.description !== undefined && { description: d.description ?? null }),
          ...(d.isDefault !== undefined && { isDefault: d.isDefault }),
          ...(d.isActive !== undefined && { isActive: d.isActive }),
          ...(d.sortOrder !== undefined && { sortOrder: d.sortOrder }),
          type,
          rate: normalizeRateForType(type, rate),
        },
      });
    });
    return ok({ ...updated, rate: Number(updated.rate) });
  } catch (e) {
    return serverError(e);
  }
}

/** Deletes an unused rate. A rate in use (or the default) can only be deactivated — past invoices keep their own snapshot either way. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard(req, "admin.tax.manage");
    if ("res" in g) return g.res;
    const { id } = await params;
    const rate = await prisma.taxRate.findUnique({
      where: { id },
      include: { _count: { select: { products: true, categories: true } } },
    });
    if (!rate) return notFound("Tax rate");
    if (rate.isDefault) return error("The default rate can't be deleted.", 409);
    const used = rate._count.products + rate._count.categories;
    if (used > 0) {
      return error(`This rate is used by ${rate._count.products} product(s) and ${rate._count.categories} categor(ies). Reassign them or deactivate the rate instead.`, 409);
    }
    await prisma.taxRate.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
