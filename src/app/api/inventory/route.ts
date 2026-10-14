import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission, userHasPermission } from "@/lib/auth";
import { ok, paginated, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { z } from "zod";
import { applyMovement, buildInventoryWhere, INVENTORY_TX_TYPES, StockFilter } from "@/lib/inventory";

const SORTS: Record<string, Prisma.InventoryOrderByWithRelationInput[]> = {
  updated: [{ updatedAt: "desc" }],
  "qty-asc": [{ quantity: "asc" }, { updatedAt: "desc" }],
  "qty-desc": [{ quantity: "desc" }, { updatedAt: "desc" }],
  name: [{ variant: { product: { nameEn: "asc" } } }, { variant: { size: "asc" } }],
};

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["admin.inventory.view", "seller.inventory.view"]))) {
      return forbidden();
    }
    const canViewAllInventory = await userHasPermission(user, "admin.inventory.view");

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20")));
    const skip = (page - 1) * pageSize;
    // `lowStock=true` kept for older callers (seller portal).
    const status = (sp.get("lowStock") === "true" ? "low" : sp.get("status") || "all") as StockFilter["status"];

    const where = buildInventoryWhere({
      search: (sp.get("search") || "").trim(),
      status,
      categoryId: sp.get("categoryId") || "",
      // Sellers only ever see stock for their own products.
      sellerId: canViewAllInventory ? "" : user.id,
    });

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: SORTS[sp.get("sort") || "updated"] ?? SORTS.updated,
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  nameEn: true,
                  nameAr: true,
                  sku: true,
                  basePrice: true,
                  salePrice: true,
                  costPrice: true,
                  category: { select: { nameEn: true } },
                  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
                },
              },
            },
          },
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    return paginated(inventory, { page, pageSize, total });
  } catch (e) {
    return serverError(e);
  }
}

const adjustSchema = z.object({
  variantId: z.string().min(1),
  type: z.enum(INVENTORY_TX_TYPES),
  quantity: z.number().int().refine((n) => n !== 0, "Quantity must not be zero"),
  note: z.string().max(300).optional(),
  reference: z.string().max(100).optional(),
  unitCost: z.number().min(0).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["admin.inventory.manage", "seller.inventory.manage"]))) {
      return forbidden();
    }
    const canManageAll = await userHasPermission(user, "admin.inventory.manage");

    const parsed = adjustSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const { variantId, type, quantity, note, reference, unitCost } = parsed.data;

    if (!canManageAll) {
      const owned = await prisma.productVariant.findFirst({ where: { id: variantId, product: { sellerId: user.id } } });
      if (!owned) return forbidden();
    }

    const updated = await prisma.$transaction((tx) =>
      applyMovement(tx, { variantId, type, quantity, note, reference, unitCost, userId: user.id }),
    );
    return ok(updated);
  } catch (e) {
    if (e instanceof Error && /Not enough stock|Inventory not found|must not be zero/.test(e.message)) return error(e.message, 409);
    return serverError(e);
  }
}
