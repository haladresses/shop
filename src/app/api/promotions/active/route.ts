import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api/response";
import { categoryAncestry, loadPromotionRules } from "@/lib/promotions";

/**
 * Public: the promotions that can apply right now on a channel, plus the
 * category tree ancestry the engine needs to match "category" deals. Used by
 * the POS cart, the checkout summary and product-page badges to preview the
 * exact discounts the server will apply.
 *
 *   GET /api/promotions/active?channel=ONLINE|POS
 *   → { rules: PromotionRule[], categoryAncestry: Record<categoryId, string[]> }
 */
export async function GET(req: NextRequest) {
  try {
    const channel = req.nextUrl.searchParams.get("channel") === "POS" ? "POS" : "ONLINE";
    const [rules, ancestry] = await Promise.all([loadPromotionRules(channel), categoryAncestry()]);
    return ok({ rules, categoryAncestry: Object.fromEntries(ancestry) });
  } catch (e) {
    return serverError(e);
  }
}
