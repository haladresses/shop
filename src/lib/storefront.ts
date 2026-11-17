import { Product } from "@/types/product";
import { PRODUCT_PLACEHOLDER } from "@/lib/productImage";

const PLACEHOLDER = PRODUCT_PLACEHOLDER;

export type ApiProductImage = {
  url: string;
  isPrimary?: boolean;
  altEn?: string | null;
  altAr?: string | null;
  sortOrder?: number;
  color?: string | null;
};

export type ApiProductColorPart = {
  part: string;
  color: string;
  colorHex?: string | null;
};

export type ApiProductVariant = {
  id: string;
  color?: string | null;
  colorHex?: string | null;
  colorParts?: ApiProductColorPart[] | null;
  size?: string | null;
  priceAdjustment?: number | string;
  isActive?: boolean;
  inventory?: { quantity: number } | null;
};

export type ApiProduct = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  basePrice: number | string;
  salePrice?: number | string | null;
  sku?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  attributes?: Record<string, unknown> | null;
  // Product-only specifications: [{ labelEn, labelAr, valueEn, valueAr }].
  customSpecs?: unknown;
  images?: ApiProductImage[];
  variants?: ApiProductVariant[];
  category?: {
    nameEn: string;
    nameAr?: string;
    slug?: string;
    attributes?: unknown[];
  } | null;
  _count?: { reviews?: number; variants?: number };
};

/**
 * Map a Prisma-backed API product into the storefront Product shape used by the
 * presentational components (ProductItem, QuickView, cart, etc.).
 */
export function mapApiProduct(
  p: ApiProduct,
  language: "en" | "ar" = "en"
): Product {
  const isArabic = language === "ar";
  const base = Number(p.basePrice) || 0;
  const sale = p.salePrice != null ? Number(p.salePrice) : base;
  const sortedImages = (p.images && p.images.length > 0 ? [...p.images] : []).sort(
    (a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }
  );
  const urls = (
    sortedImages.length > 0 ? sortedImages.map((img) => img.url) : [PLACEHOLDER]
  ).filter(Boolean);

  const options = (p.variants ?? [])
    .filter((v) => v.isActive !== false)
    .map((v) => ({
      variantId: v.id,
      color: v.color ?? null,
      colorHex: v.colorHex ?? null,
      size: v.size ?? null,
      priceAdjustment: Number(v.priceAdjustment ?? 0) || 0,
      stock: v.inventory?.quantity ?? 0,
    }));
  const colorMap = new Map<string, string | null>();
  for (const o of options) if (o.color && !colorMap.has(o.color)) colorMap.set(o.color, o.colorHex);

  return {
    id: p.id,
    slug: p.slug,
    title: (isArabic ? p.nameAr : p.nameEn) || p.nameEn || p.nameAr || "",
    reviews: p._count?.reviews ?? 0,
    price: base,
    discountedPrice: sale,
    imgs: {
      thumbnails: urls,
      previews: urls,
    },
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    categoryName: p.category ? (isArabic ? p.category.nameAr || p.category.nameEn : p.category.nameEn) : undefined,
    options,
    colors: Array.from(colorMap, ([name, hex]) => ({ name, hex })),
    // Products without variants aren't stock-tracked, so they stay sellable.
    inStock: options.length === 0 || options.some((o) => o.stock > 0),
  };
}

type FetchProductsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  category?: string;
  language?: "en" | "ar";
  isFeatured?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  /** latest | oldest | price-asc | price-desc | bestseller | name */
  sort?: string;
  signal?: AbortSignal;
};

export type ProductsResult = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  priceMin: number | null;
  priceMax: number | null;
  sizes: string[];
  colors: { value: string; hex: string | null }[];
};

/** Fetch the active product catalogue from the public products API. */
export async function fetchProducts(
  params: FetchProductsParams = {}
): Promise<ProductsResult> {
  const {
    page = 1,
    pageSize = 12,
    search = "",
    categoryId = "",
    category = "",
    language = "en",
    isFeatured,
    isNew,
    isBestSeller,
    minPrice,
    maxPrice,
    sizes,
    colors,
    sort,
    signal,
  } = params;

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    isActive: "true",
    // Items with real photos are listed before ones showing the default picture.
    photosFirst: "true",
  });
  if (search) query.set("search", search);
  if (categoryId) query.set("categoryId", categoryId);
  if (category) query.set("category", category);
  if (isFeatured !== undefined) query.set("isFeatured", String(isFeatured));
  if (isNew !== undefined) query.set("isNew", String(isNew));
  if (isBestSeller !== undefined) query.set("isBestSeller", String(isBestSeller));
  if (minPrice !== undefined) query.set("minPrice", String(minPrice));
  if (maxPrice !== undefined) query.set("maxPrice", String(maxPrice));
  if (sizes && sizes.length) query.set("sizes", sizes.join(","));
  if (colors && colors.length) query.set("colors", colors.join(","));
  if (sort) query.set("sort", sort);

  const res = await fetch(`/api/products?${query.toString()}`, { signal });
  const json = await res.json();

  if (!json.success) {
    return { products: [], total: 0, page, pageSize, totalPages: 0, priceMin: null, priceMax: null, sizes: [], colors: [] };
  }

  return {
    products: (json.data as ApiProduct[]).map((p) => mapApiProduct(p, language)),
    total: json.meta?.total ?? 0,
    page: json.meta?.page ?? page,
    pageSize: json.meta?.pageSize ?? pageSize,
    totalPages: json.meta?.totalPages ?? 0,
    priceMin: json.meta?.priceMin ?? null,
    priceMax: json.meta?.priceMax ?? null,
    sizes: [...((json.meta?.sizes as string[] | undefined) ?? [])].sort(compareSizes),
    colors: json.meta?.colors ?? [],
  };
}

/** Fetch a single product (with variants/images) by its slug. */
export async function fetchProductBySlug(
  slug: string,
  signal?: AbortSignal
): Promise<ApiProduct | null> {
  const res = await fetch(`/api/products/slug/${encodeURIComponent(slug)}`, {
    signal,
  });
  const json = await res.json();
  return json.success ? (json.data as ApiProduct) : null;
}

const CATEGORY_PLACEHOLDER = PRODUCT_PLACEHOLDER;

export type ApiCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  image?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  children?: ApiCategory[];
  _count?: { products?: number };
};

export type StoreCategory = {
  id: string;
  slug: string;
  title: string;
  img: string;
  products: number;
};

/** Map an API category into the storefront category shape (localized title). */
export function mapApiCategory(
  c: ApiCategory,
  language: "en" | "ar" = "en"
): StoreCategory {
  const isArabic = language === "ar";
  return {
    id: c.id,
    slug: c.slug,
    title: (isArabic ? c.nameAr : c.nameEn) || c.nameEn || c.nameAr || "",
    img: c.image || CATEGORY_PLACEHOLDER,
    products: c._count?.products ?? 0,
  };
}

/** Fetch the active category list (top-level by default) from the public API. */
export async function fetchCategories(
  params: { language?: "en" | "ar"; parentOnly?: boolean; signal?: AbortSignal } = {}
): Promise<StoreCategory[]> {
  const { language = "en", parentOnly = false, signal } = params;
  const query = new URLSearchParams({ all: "true" });
  if (parentOnly) query.set("parentOnly", "true");

  const res = await fetch(`/api/categories?${query.toString()}`, { signal });
  const json = await res.json();

  if (!json.success) return [];
  return (json.data as ApiCategory[]).map((c) => mapApiCategory(c, language));
}

const ADULT_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

/**
 * Sort key for a size label: newborn, months, years, adult letters, plain
 * numbers, then Mom-* and Mini-* sets (each ordered by the size after the
 * dash). Unknown labels go last.
 */
function sizeKey(raw: string): number[] {
  const s = raw.trim().toUpperCase();
  if (s === "NEWBORN" || s === "NB") return [0];
  const set = s.match(/^(MOM|MINI)\s*[-\s]\s*(.+)$/);
  if (set) return [set[1] === "MOM" ? 5 : 6, ...sizeKey(set[2])];
  const age = s.match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(M|MO|MONTHS?|Y|YRS?|YEARS?)$/);
  if (age) {
    const from = parseFloat(age[1]);
    const to = age[2] ? parseFloat(age[2]) : from;
    return [age[3].startsWith("M") ? 1 : 2, from, to];
  }
  const adult = ADULT_SIZES.indexOf(s === "XXXL" ? "3XL" : s === "2XL" ? "XXL" : s);
  if (adult >= 0) return [3, adult];
  if (/^\d+(\.\d+)?$/.test(s)) return [4, parseFloat(s)];
  return [9];
}

/** Compare two size labels in a natural shopping order (see sizeKey). */
export function compareSizes(a: string, b: string): number {
  const ka = sizeKey(a);
  const kb = sizeKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const diff = (ka[i] ?? -1) - (kb[i] ?? -1);
    if (diff) return diff;
  }
  return a.localeCompare(b);
}

/** Trim a product list to whole rows of `perRow` so grids never end on a half row. */
export function fullRows<T>(list: T[], perRow = 4): T[] {
  return list.length > perRow ? list.slice(0, list.length - (list.length % perRow)) : list;
}
