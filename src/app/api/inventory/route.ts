import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole, isSellerOrAdmin } from "@/lib/auth";
import { ok, paginated, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!isSellerOrAdmin(user.role)) return forbidden();

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = 20;
    const skip = (page - 1) * pageSize;
    const lowStock = sp.get("lowStock") === "true";

    const where = lowStock
      ? { quantity: { lte: prisma.inventory.fields.lowStockAlert } }
      : {};

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          variant: {
            include: {
              product: {
                select: {
                  nameEn: true,
                  nameAr: true,
                  sku: true,
                  ...(isAdminRole(user.role) ? {} : { sellerId: true }),
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
  type: z.enum(["PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "DAMAGE", "TRANSFER"]),
  quantity: z.number().int(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!isSellerOrAdmin(user.role)) return forbidden();

    const body = await req.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const { variantId, type, quantity, note } = parsed.data;

    const inventory = await prisma.inventory.findUnique({ where: { variantId } });
    if (!inventory) return error("Inventory not found for this variant");

    const delta = ["PURCHASE", "RETURN", "ADJUSTMENT"].includes(type)
      ? Math.abs(quantity)
      : -Math.abs(quantity);

    const updated = await prisma.inventory.update({
      where: { variantId },
      data: {
        quantity: { increment: delta },
        transactions: {
          create: {
            type: type as never,
            quantity,
            note,
            createdBy: user.id,
          },
        },
      },
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
