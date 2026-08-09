import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { z } from "zod";

const updateSchema = z.object({
  nameEn: z.string().min(2).optional(),
  nameAr: z.string().min(2).optional(),
  parentId: z.string().optional().nullable(),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: { select: { products: true } },
      },
    });
    if (!category) return notFound("Category");
    return ok(category);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.categories.manage"))) return forbidden();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    if (parsed.data.parentId === id) return error("A category cannot be its own parent");

    const category = await prisma.category.update({ where: { id }, data: parsed.data });
    return ok(category);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.categories.manage"))) return forbidden();

    const { id } = await params;
    const hasProducts = await prisma.product.count({ where: { categoryId: id } });
    if (hasProducts > 0) return error("Cannot delete category with products");

    const hasChildren = await prisma.category.count({ where: { parentId: id } });
    if (hasChildren > 0) return error("Cannot delete category with sub-categories");

    await prisma.category.delete({ where: { id } });
    return ok({ message: "Category deleted" });
  } catch (e) {
    return serverError(e);
  }
}
