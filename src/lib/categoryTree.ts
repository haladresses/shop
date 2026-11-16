/** Client-safe helpers to turn the flat category list into a parent → child tree. */

export type FlatCategory = {
  id: string;
  nameEn: string;
  nameAr: string;
  parentId?: string | null;
  isActive?: boolean;
};

export type CategoryNode<T extends FlatCategory> = T & { depth: number; children: CategoryNode<T>[] };

/**
 * Nest categories under their parents, keeping the incoming order (the API
 * sorts by sortOrder, then name). Categories whose parent is missing become
 * top-level; a corrupted parent loop can't recurse forever.
 */
export function buildCategoryTree<T extends FlatCategory>(cats: T[]): CategoryNode<T>[] {
  const ids = new Set(cats.map((c) => c.id));
  const byParent = new Map<string | null, T[]>();
  for (const c of cats) {
    const parent = c.parentId && ids.has(c.parentId) && c.parentId !== c.id ? c.parentId : null;
    const list = byParent.get(parent) ?? [];
    list.push(c);
    byParent.set(parent, list);
  }
  const seen = new Set<string>();
  const build = (parent: string | null, depth: number): CategoryNode<T>[] =>
    (byParent.get(parent) ?? [])
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .map((c) => ({ ...c, depth, children: build(c.id, depth + 1) }));
  return build(null, 0);
}

/** Depth-first list of a tree (parents directly followed by their children). */
export function flattenCategoryTree<T extends FlatCategory>(nodes: CategoryNode<T>[]): CategoryNode<T>[] {
  return nodes.flatMap((n) => [n, ...flattenCategoryTree(n.children)]);
}

/** Options for a <select>: "Dresses", "Dresses › Evening", … in tree order. */
export function categorySelectOptions<T extends FlatCategory>(cats: T[]) {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const pathOf = (c: T) => {
    const names: string[] = [];
    let cur: T | undefined = c;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      names.unshift(cur.nameEn);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.join(" › ");
  };
  return flattenCategoryTree(buildCategoryTree(cats)).map((c) => ({
    id: c.id,
    label: pathOf(c),
    depth: c.depth,
    isActive: c.isActive !== false,
  }));
}
