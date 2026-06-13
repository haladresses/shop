import { Product } from "@/types/product";

const PLACEHOLDER = "/images/products/p1.png";

export type ApiProductImage = {
  url: string;
  isPrimary?: boolean;
  altEn?: string | null;
  altAr?: string | null;
  sortOrder?: number;
};

export type ApiProductVariant = {
  id: string;
  color?: string | null;
  colorHex?: string | null;
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
  };
}

type FetchProductsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  category?: string;
  language?: "en" | "ar";
  signal?: AbortSignal;
};

export type ProductsResult = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
    signal,
  } = params;

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    isActive: "true",
  });
  if (search) query.set("search", search);
  if (categoryId) query.set("categoryId", categoryId);
  if (category) query.set("category", category);

  const res = await fetch(`/api/products?${query.toString()}`, { signal });
  const json = await res.json();

  if (!json.success) {
    return { products: [], total: 0, page, pageSize, totalPages: 0 };
  }

  return {
    products: (json.data as ApiProduct[]).map((p) => mapApiProduct(p, language)),
    total: json.meta?.total ?? 0,
    page: json.meta?.page ?? page,
    pageSize: json.meta?.pageSize ?? pageSize,
    totalPages: json.meta?.totalPages ?? 0,
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

const CATEGORY_PLACEHOLDER = "/images/products/p1.png";

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
