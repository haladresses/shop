import prisma from "@/lib/db";
import { Prisma, type CategoryAttribute as CategoryAttributeRow } from "@prisma/client";

/**
 * Server-side helpers for category specification fields: inheritance from
 * parent categories, usage counts, and moving product values when a field's
 * key is renamed. Product values live in `products.attributes` as
 * `{ [key]: value }`, so the key is the link between a field and its data.
 */

export type CategoryRef = { id: string; nameEn: string; nameAr: string; parentId: string | null };
export type EffectiveAttributeRow = CategoryAttributeRow & {
  inheritedFrom: { id: string; nameEn: string; nameAr: string } | null;
};

// Guards against a corrupted parent chain looping forever.
const MAX_DEPTH = 10;

/** The category followed by its ancestors, nearest first. */
export async function getCategoryChain(categoryId: string): Promise<CategoryRef[]> {
  const chain: CategoryRef[] = [];
  const seen = new Set<string>();
  let id: string | null = categoryId;
  while (id && !seen.has(id) && chain.length < MAX_DEPTH) {
    seen.add(id);
    const c: CategoryRef | null = await prisma.category.findUnique({
      where: { id },
      select: { id: true, nameEn: true, nameAr: true, parentId: true },
    });
    if (!c) break;
    chain.push(c);
    id = c.parentId;
  }
  return chain;
}

/**
 * The fields a product in this category fills in: the root ancestor's fields
 * first, down to the category's own. When two levels define the same key the
 * one closest to the category wins.
 */
export async function getEffectiveAttributes(categoryId: string): Promise<EffectiveAttributeRow[]> {
  const chain = await getCategoryChain(categoryId);
  if (!chain.length) return [];

  const rows = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: chain.map((c) => c.id) } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const byCategory = new Map<string, CategoryAttributeRow[]>();
  for (const r of rows) {
    const list = byCategory.get(r.categoryId) ?? [];
    list.push(r);
    byCategory.set(r.categoryId, list);
  }

  const claimed = new Set<string>();
  const levels: EffectiveAttributeRow[][] = [];
  for (const cat of chain) {
    const level = (byCategory.get(cat.id) ?? [])
      .filter((r) => !claimed.has(r.key))
      .map((r) => ({
        ...r,
        inheritedFrom: cat.id === categoryId ? null : { id: cat.id, nameEn: cat.nameEn, nameAr: cat.nameAr },
      }));
    level.forEach((r) => claimed.add(r.key));
    levels.push(level);
  }
  return levels.reverse().flat();
}

/** The category and every category below it. */
export async function getSubtreeIds(categoryId: string): Promise<string[]> {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const children = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = children.get(c.parentId) ?? [];
    list.push(c.id);
    children.set(c.parentId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [categoryId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return out;
}

/**
 * How many products (in the given categories) have a value for each key.
 * A JSON null / "" / [] counts as no value; `false` is a real answer ("No").
 */
export async function getAttributeUsage(categoryIds: string[]): Promise<Record<string, number>> {
  if (!categoryIds.length) return {};
  const rows = await prisma.$queryRaw<{ key: string; count: number }[]>`
    SELECT e.key AS key, COUNT(*)::int AS count
    FROM products p
    CROSS JOIN LATERAL jsonb_each(
      CASE WHEN jsonb_typeof(p.attributes) = 'object' THEN p.attributes ELSE '{}'::jsonb END
    ) AS e(key, value)
    WHERE p."categoryId" = ANY(${categoryIds}::text[])
      AND e.value NOT IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb)
    GROUP BY e.key`;
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.count)]));
}

/**
 * Move stored product values from old keys to new keys. Runs in two passes
 * through temporary keys so swaps (a→b, b→a) don't overwrite each other.
 */
export async function renameAttributeKeys(
  tx: Prisma.TransactionClient,
  categoryIds: string[],
  renames: { from: string; to: string }[],
) {
  if (!categoryIds.length || !renames.length) return;
  const stamp = Date.now().toString(36);
  const steps = renames.map((r, i) => ({ ...r, tmp: `__rename_${stamp}_${i}` }));

  const move = (from: string, to: string) => tx.$executeRaw`
    UPDATE products
    SET attributes = (attributes - ${from}::text) || jsonb_build_object(${to}::text, attributes -> ${from}::text)
    WHERE "categoryId" = ANY(${categoryIds}::text[])
      AND jsonb_typeof(attributes) = 'object'
      AND (attributes -> ${from}::text) IS NOT NULL`;

  for (const s of steps) await move(s.from, s.tmp);
  for (const s of steps) await move(s.tmp, s.to);
}

/**
 * Replace a product's `category.attributes` with the effective (inherited +
 * own) list so the storefront and admin see parent-category fields too.
 */
export async function withEffectiveCategoryAttributes<
  T extends { categoryId: string; category: object | null },
>(product: T) {
  const attributes = await getEffectiveAttributes(product.categoryId);
  return { ...product, category: product.category ? { ...product.category, attributes } : null };
}
