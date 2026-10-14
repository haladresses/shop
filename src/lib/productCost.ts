import type { NextRequest } from "next/server";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";

// A product's purchase price (costPrice) is internal business data — it must
// never reach shoppers through the public catalogue endpoints.

/** Whether the caller is staff allowed to see purchase prices and margins. */
export async function canViewCost(req: NextRequest): Promise<boolean> {
  const user = await getAuthFromRequest(req);
  if (!user) return false;
  return userHasAnyPermission(user, ["admin.products.view", "admin.finance.view", "admin.inventory.view"]);
}

export function withoutCost<T extends { costPrice?: unknown }>(product: T): Omit<T, "costPrice"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { costPrice, ...rest } = product;
  return rest;
}
