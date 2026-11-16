import { NextRequest } from "next/server";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { loadCategories, parseFilters, withDescendants } from "../shared";
import { productStats, statTotals } from "../productStats";

/**
 * Sales per product — or per colour/size option with ?variants=1.
 *   ?categoryId=  only that category (incl. sub-categories)
 *   ?search=      name / SKU
 * Every product sold or returned in the period, best sellers (net excl. VAT) first.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req, { maxDays: 400 });
    if ("error" in f) return error(f.error);
    const sp = req.nextUrl.searchParams;
    const perVariant = sp.get("variants") === "1";
    const categoryId = sp.get("categoryId") || "";
    const search = (sp.get("search") || "").trim().slice(0, 100);

    let categoryIds: string[] | null = null;
    let categoryName: string | null = null;
    if (categoryId) {
      const cats = await loadCategories();
      const cat = cats.find((c) => c.id === categoryId);
      if (!cat) return error("Category not found", 404);
      categoryIds = withDescendants(categoryId, cats);
      categoryName = cat.nameEn;
    }

    const rows = await productStats(f, { perVariant, categoryIds, search });
    return ok({
      range: { from: f.fromKey, to: f.toKey },
      perVariant,
      category: categoryId ? { id: categoryId, name: categoryName } : null,
      rows,
      totals: { ...statTotals(rows), products: new Set(rows.map((r) => r.productId)).size },
    });
  } catch (e) {
    return serverError(e);
  }
}
