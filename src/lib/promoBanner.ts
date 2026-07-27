export type PromoTile = {
  image: string;
  eyebrowEn: string;
  eyebrowAr: string;
  titleEn: string;
  titleAr: string;
  ctaEn: string;
  ctaAr: string;
  href: string;
};

export type PromoBannerConfig = {
  tiles: PromoTile[];
};

export const DEFAULT_PROMO_TILES: PromoTile[] = [
  {
    image: "/images/hero/seed-promo-women.jpg",
    href: "/shop?category=womens-dresses",
    eyebrowEn: "Women's Edit",
    eyebrowAr: "تشكيلة النساء",
    titleEn: "Everyday elegance",
    titleAr: "أناقة يومية",
    ctaEn: "Shop Women",
    ctaAr: "تسوقي تشكيلة النساء",
  },
  {
    image: "/images/hero/seed-promo-girls.jpg",
    href: "/shop?category=girls-dresses",
    eyebrowEn: "Girls' Edit",
    eyebrowAr: "تشكيلة البنات",
    titleEn: "Party-ready & playful",
    titleAr: "إطلالات مرحة للمناسبات",
    ctaEn: "Shop Girls",
    ctaAr: "تسوقي تشكيلة البنات",
  },
];

export const DEFAULT_PROMO_BANNER_CONFIG: PromoBannerConfig = {
  tiles: DEFAULT_PROMO_TILES,
};

export const PROMO_BANNER_KEY = "promo_banner_tiles";

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

function normalizeTile(raw: unknown): PromoTile {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    image: str(o.image),
    eyebrowEn: str(o.eyebrowEn),
    eyebrowAr: str(o.eyebrowAr),
    titleEn: str(o.titleEn),
    titleAr: str(o.titleAr),
    ctaEn: str(o.ctaEn),
    ctaAr: str(o.ctaAr),
    href: str(o.href, "/shop") || "/shop",
  };
}

/** Coerce an unknown value (from the settings store) into a typed promo tile array. */
export function normalizePromoTiles(raw: unknown): PromoTile[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_PROMO_TILES;
  return raw
    .map(normalizeTile)
    .filter((t) => t.titleEn || t.titleAr || t.image);
}

/** Fetch the promo banner configuration from the public API (client-side). */
export async function fetchPromoBanner(signal?: AbortSignal): Promise<PromoTile[]> {
  try {
    const res = await fetch("/api/promo-banner", { signal });
    const json = await res.json();
    if (!json.success) return DEFAULT_PROMO_TILES;
    return normalizePromoTiles(json.data?.tiles);
  } catch {
    return DEFAULT_PROMO_TILES;
  }
}
