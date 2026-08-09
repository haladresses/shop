import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { categoryAttributesPayloadSchema } from "@/lib/validations/attribute";
import { Prisma } from "@prisma/client";

/** List the attribute definitions for a category (public - used by the storefront and admin). */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) return notFound("Category");

    const attributes = await prisma.categoryAttribute.findMany({
      where: { categoryId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(attributes);
  } catch (e) {
    return serverError(e);
  }
}

/** Replace the full set of attribute definitions for a category (admin only). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.categories.manage"))) return forbidden();

    const { id } = await params;
    const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) return notFound("Category");

    const body = await req.json();
    const parsed = categoryAttributesPayloadSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const { attributes } = parsed.data;

    // Ensure keys are unique within the payload.
    const keys = attributes.map((a) => a.key);
    if (new Set(keys).size !== keys.length) {
      return error("Attribute keys must be unique within the category");
    }

    await prisma.$transaction([
      prisma.categoryAttribute.deleteMany({ where: { categoryId: id } }),
      ...(attributes.length
        ? [
            prisma.categoryAttribute.createMany({
              data: attributes.map((a, i) => ({
                categoryId: id,
                key: a.key,
                labelEn: a.labelEn,
                labelAr: a.labelAr,
                type: a.type,
                options: (a.options.length
                  ? a.options
                  : Prisma.JsonNull) as Prisma.InputJsonValue,
                unit: a.unit ?? null,
                placeholder: a.placeholder ?? null,
                isRequired: a.isRequired,
                isFilterable: a.isFilterable,
                sortOrder: a.sortOrder ?? i,
              })),
            }),
          ]
        : []),
    ]);

    const saved = await prisma.categoryAttribute.findMany({
      where: { categoryId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(saved);
  } catch (e) {
    return serverError(e);
  }
}
