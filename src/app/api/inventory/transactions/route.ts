import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { businessDayEnd, businessDayStart, isDateKey } from "@/lib/finance";
import { INVENTORY_TX_TYPES } from "@/lib/inventory";

/** Stock movement ledger (receipts, sales, returns, adjustments, damage…). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.inventory.view"))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "30")));
    const type = sp.get("type") || "";
    const inventoryId = sp.get("inventoryId") || "";
    const search = (sp.get("search") || "").trim();
    const from = sp.get("from");
    const to = sp.get("to");

    const where: Prisma.InventoryTransactionWhereInput = {
      ...(inventoryId && { inventoryId }),
      ...((INVENTORY_TX_TYPES as readonly string[]).includes(type) && { type: type as (typeof INVENTORY_TX_TYPES)[number] }),
      ...(isDateKey(from) || isDateKey(to)
        ? {
            createdAt: {
              ...(isDateKey(from) ? { gte: businessDayStart(from) } : {}),
              ...(isDateKey(to) ? { lte: businessDayEnd(to) } : {}),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { note: { contains: search, mode: "insensitive" } },
          { inventory: { variant: { product: { nameEn: { contains: search, mode: "insensitive" } } } } },
          { inventory: { variant: { sku: { contains: search, mode: "insensitive" } } } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          inventory: {
            select: {
              id: true,
              variant: { select: { color: true, size: true, sku: true, product: { select: { id: true, nameEn: true } } } },
            },
          },
        },
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    const userIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x)));
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nameEn: true, email: true } })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.nameEn || u.email]));

    return ok({
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        quantity: r.quantity,
        balanceAfter: r.balanceAfter,
        unitCost: r.unitCost == null ? null : Number(r.unitCost),
        reference: r.reference,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        createdBy: r.createdBy ? nameOf.get(r.createdBy) ?? "" : "",
        inventoryId: r.inventory.id,
        productId: r.inventory.variant.product.id,
        productName: r.inventory.variant.product.nameEn,
        variant: [r.inventory.variant.color, r.inventory.variant.size].filter(Boolean).join(" / "),
        sku: r.inventory.variant.sku,
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (e) {
    return serverError(e);
  }
}
