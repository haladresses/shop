import { NextRequest } from "next/server";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { round3 } from "@/lib/finance";
import { loadCategories, parseFilters } from "../shared";
import { productStats, statTotals } from "../productStats";

type Figures = ReturnType<typeof statTotals> & { products: number };

const ZERO: Figures = {
  products: 0,
  qty: 0,
  returnedQty: 0,
  netQty: 0,
  gross: 0,
  offers: 0,
  discounts: 0,
  vat: 0,
  netSales: 0,
  refunds: 0,
  refundVat: 0,
  netExVat: 0,
  cost: 0,
  profit: 0,
  margin: 0,
};

function add(a: Figures, b: Figures): Figures {
  const out = { ...a };
  for (const k of Object.keys(ZERO) as (keyof Figures)[]) if (k !== "margin") out[k] = round3(a[k] + b[k]);
  out.margin = out.netExVat > 0 ? round3((out.profit / out.netExVat) * 100) : 0;
  return out;
}

/**
 * Sales per category as a tree: each category's own figures (products filed
 * directly under it) and the rolled-up total including all sub-categories.
 * Share % is of the period's total net sales excl. VAT.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.reports.view");
    if ("res" in g) return g.res;
    const f = parseFilters(req, { maxDays: 400 });
    if ("error" in f) return error(f.error);

    const [rows, cats] = await Promise.all([productStats(f), loadCategories()]);

    const own = new Map<string, Figures>();
    for (const r of rows) {
      const k = r.categoryId ?? "__none";
      const t = statTotals([r]);
      own.set(k, add(own.get(k) ?? ZERO, { ...t, products: 1 }));
    }

    const byId = new Map(cats.map((c) => [c.id, c]));
    const children = new Map<string, string[]>();
    for (const c of cats) {
      const parent = c.parentId && byId.has(c.parentId) ? c.parentId : "__root";
      children.set(parent, [...(children.get(parent) ?? []), c.id]);
    }

    const rolled = new Map<string, Figures>();
    const roll = (id: string, guardDepth = 0): Figures => {
      if (rolled.has(id)) return rolled.get(id)!;
      let t = own.get(id) ?? ZERO;
      if (guardDepth < 50) for (const ch of children.get(id) ?? []) t = add(t, roll(ch, guardDepth + 1));
      rolled.set(id, t);
      return t;
    };
    for (const c of cats) roll(c.id);

    const grand: Figures = { ...statTotals(rows), products: rows.length };
    const totalNet = rows.reduce((t, r) => t + r.netExVat, 0);
    const share = (v: number) => (totalNet > 0 ? round3((v / totalNet) * 100) : 0);

    // Depth-first order so the client can render an indented tree directly.
    type Node = { id: string; nameEn: string; nameAr: string; parentId: string | null; depth: number; hasChildren: boolean; own: Figures; total: Figures; share: number };
    const out: Node[] = [];
    const walk = (parent: string, depth: number) => {
      const ids = (children.get(parent) ?? []).slice().sort((a, b) => (rolled.get(b)?.netExVat ?? 0) - (rolled.get(a)?.netExVat ?? 0));
      for (const id of ids) {
        const c = byId.get(id)!;
        const total = rolled.get(id) ?? ZERO;
        out.push({
          id,
          nameEn: c.nameEn,
          nameAr: c.nameAr,
          parentId: c.parentId,
          depth,
          hasChildren: (children.get(id) ?? []).length > 0,
          own: own.get(id) ?? ZERO,
          total,
          share: share(total.netExVat),
        });
        if (depth < 50) walk(id, depth + 1);
      }
    };
    walk("__root", 0);
    // Products whose category no longer exists.
    const orphan = own.get("__none");
    if (orphan) out.push({ id: "__none", nameEn: "No category", nameAr: "بدون فئة", parentId: null, depth: 0, hasChildren: false, own: orphan, total: orphan, share: share(orphan.netExVat) });

    return ok({
      range: { from: f.fromKey, to: f.toKey },
      rows: out,
      totals: grand,
    });
  } catch (e) {
    return serverError(e);
  }
}
