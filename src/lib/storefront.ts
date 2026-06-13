import { Product } from "@/types/product";

const PLACEHOLDER = "/images/products/p1.png";

export type ApiProductImage = {
  url: string;
  isPrimary?: boolean;
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
  isActive?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  images?: ApiProductImage[];
  category?: { nameEn: string; nameAr?: string } | null;
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
  const urls = (p.images && p.images.length > 0
    ? p.images.map((img) => img.url)
    : [PLACEHOLDER]
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
