import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { round3 } from "@/lib/finance";

/** Warehouse KPIs: SKU/unit counts, stock value at cost and at retail, alerts. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.inventory.view"))) return forbidden();

    const [row] = await prisma.$queryRaw<
      {
        skus: number;
        units: number;
        reserved: number;
        cost_value: unknown;
        retail_value: unknown;
        low: number;
        out: number;
        no_cost: number;
      }[]
    >`
      SELECT COUNT(*)::int AS skus,
             COALESCE(SUM(GREATEST(i.quantity, 0)), 0)::int AS units,
             COALESCE(SUM(i."reservedQuantity"), 0)::int AS reserved,
             COALESCE(SUM(GREATEST(i.quantity, 0) * COALESCE(p."costPrice", 0)), 0) AS cost_value,
             COALESCE(SUM(GREATEST(i.quantity, 0) * (COALESCE(p."salePrice", p."basePrice") + v."priceAdjustment")), 0) AS retail_value,
             COUNT(*) FILTER (WHERE i.quantity > 0 AND i.quantity <= i."lowStockAlert")::int AS low,
             COUNT(*) FILTER (WHERE i.quantity <= 0)::int AS out,
             COUNT(*) FILTER (WHERE p."costPrice" IS NULL AND i.quantity > 0)::int AS no_cost
      FROM inventory i
      JOIN product_variants v ON v.id = i."variantId"
      JOIN products p ON p.id = v."productId"`;

    const since = new Date(Date.now() - 30 * 86400000);
    const moves = await prisma.inventoryTransaction.groupBy({
      by: ["type"],
      where: { createdAt: { gte: since } },
      _sum: { quantity: true },
      _count: true,
    });

    const costValue = Number(row.cost_value);
    const retailValue = Number(row.retail_value);
    return ok({
      skus: row.skus,
      units: row.units,
      reserved: row.reserved,
      costValue: round3(costValue),
      retailValue: round3(retailValue),
      potentialProfit: round3(retailValue - costValue),
      lowStock: row.low,
      outOfStock: row.out,
      missingCost: row.no_cost,
      last30Days: Object.fromEntries(moves.map((m) => [m.type, { units: m._sum.quantity ?? 0, count: m._count }])),
    });
  } catch (e) {
    return serverError(e);
  }
}
