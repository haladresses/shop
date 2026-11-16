import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { categoryAttributesPayloadSchema } from "@/lib/validations/attribute";
import {
  getAttributeUsage,
  getCategoryChain,
  getEffectiveAttributes,
  getSubtreeIds,
  renameAttributeKeys,
} from "@/lib/categorySpecs";
import { Prisma } from "@prisma/client";

const ORDER: Prisma.CategoryAttributeOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { createdAt: "asc" }];

/**
 * Attribute definitions for a category.
 *   (default)         the category's own fields — public
 *   ?scope=effective  inherited parent-category fields + own — public; what a product fills in
 *   ?view=editor      own + inherited + how many products use each field — admin
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, nameEn: true, nameAr: true, image: true, parentId: true, isActive: true },
    });
    if (!category) return notFound("Category");

    if (sp.get("scope") === "effective") {
      return ok(await getEffectiveAttributes(id));
    }

    if (sp.get("view") === "editor") {
      const user = await getAuthFromRequest(req);
      if (!user) return unauthorized();
      const allowed = await userHasAnyPermission(user, [
        "admin.categories.view",
        "admin.products.view",
        "admin.products.manage",
      ]);
      if (!allowed) return forbidden();

      const [effective, chain, subtree, canManage] = await Promise.all([
        getEffectiveAttributes(id),
        getCategoryChain(id),
        getSubtreeIds(id),
        userHasPermission(user, "admin.categories.manage"),
      ]);
      const [own, usage, productCount] = await Promise.all([
        prisma.categoryAttribute.findMany({ where: { categoryId: id }, orderBy: ORDER }),
        getAttributeUsage(subtree),
        prisma.product.count({ where: { categoryId: { in: subtree } } }),
      ]);

      return ok({
        category: {
          ...category,
          // Root first, ending with this category — for breadcrumbs.
          path: [...chain].reverse().map((c) => ({ id: c.id, nameEn: c.nameEn, nameAr: c.nameAr })),
        },
        own,
        inherited: effective.filter((a) => a.inheritedFrom),
        usage,
        productCount,
        canManage,
      });
    }

    return ok(await prisma.categoryAttribute.findMany({ where: { categoryId: id }, orderBy: ORDER }));
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Replace the full set of a category's own fields (admin only). When an
 * existing field's key changes, the values already stored on products in this
 * category (and its sub-categories) move to the new key so nothing is lost.
 */
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

    const keys = attributes.map((a) => a.key);
    if (new Set(keys).size !== keys.length) {
      return error("Two fields have the same key. Each field needs its own key.");
    }
    for (const a of attributes) {
      if ((a.type === "SELECT" || a.type === "MULTISELECT" || a.type === "COLOR") && a.options.length === 0) {
        return error(`"${a.labelEn}" needs at least one option.`);
      }
    }

    const existing = await prisma.categoryAttribute.findMany({
      where: { categoryId: id },
      select: { id: true, key: true },
    });
    const keyById = new Map(existing.map((e) => [e.id, e.key]));
    const renames = attributes
      .filter((a) => a.id && keyById.has(a.id) && keyById.get(a.id) !== a.key)
      .map((a) => ({ from: keyById.get(a.id!)!, to: a.key }));

    const subtree = renames.length ? await getSubtreeIds(id) : [];

    await prisma.$transaction(async (tx) => {
      await renameAttributeKeys(tx, subtree, renames);
      await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
      if (attributes.length) {
        await tx.categoryAttribute.createMany({
          data: attributes.map((a, i) => ({
            categoryId: id,
            key: a.key,
            labelEn: a.labelEn,
            labelAr: a.labelAr,
            type: a.type,
            options: (a.options.length ? a.options : Prisma.JsonNull) as Prisma.InputJsonValue,
            unit: a.unit || null,
            placeholder: a.placeholder || null,
            isRequired: a.isRequired,
            isFilterable: a.isFilterable,
            // The payload's order is the display order.
            sortOrder: i,
          })),
        });
      }
    });

    const saved = await prisma.categoryAttribute.findMany({ where: { categoryId: id }, orderBy: ORDER });
    return ok(saved);
  } catch (e) {
    return serverError(e);
  }
}
