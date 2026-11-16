import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { normalizeRateForType, taxRateSchema } from "@/lib/tax";

const READERS = [
  "admin.tax.view",
  "admin.tax.manage",
  "admin.products.view",
  "admin.categories.view",
  "admin.suppliers.view",
  "pos.access",
];

/** VAT rates with how many products/categories use each one. ?active=true for the pickers. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, READERS);
    if ("res" in g) return g.res;
    const activeOnly = req.nextUrl.searchParams.get("active") === "true";
    const rates = await prisma.taxRate.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ sortOrder: "asc" }, { rate: "desc" }],
      include: { _count: { select: { products: true, categories: true } } },
    });
    return ok(
      rates.map(({ _count, ...r }) => ({
        ...r,
        rate: Number(r.rate),
        productCount: _count.products,
        categoryCount: _count.categories,
      })),
    );
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, "admin.tax.manage");
    if ("res" in g) return g.res;
    const parsed = taxRateSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const d = parsed.data;
    const created = await prisma.$transaction(async (tx) => {
      if (d.isDefault) await tx.taxRate.updateMany({ data: { isDefault: false } });
      return tx.taxRate.create({
        data: {
          code: d.code,
          nameEn: d.nameEn,
          nameAr: d.nameAr,
          rate: normalizeRateForType(d.type, d.rate),
          type: d.type,
          description: d.description ?? null,
          isDefault: !!d.isDefault,
          isActive: d.isActive ?? true,
          sortOrder: d.sortOrder ?? 0,
        },
      });
    });
    return ok({ ...created, rate: Number(created.rate) }, 201);
  } catch (e) {
    return serverError(e);
  }
}
