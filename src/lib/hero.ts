export type HeroSlide = {
  image: string;
  badgeEn: string;
  badgeAr: string;
  titleEn: string;
  titleAr: string;
  ctaEn: string;
  ctaAr: string;
  href: string;
};

export type HeroFeatureItem = {
  image: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
};

export type HeroConfig = {
  slides: HeroSlide[];
  features: HeroFeatureItem[];
};

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    image: "/images/hero/seed-hero-1.jpg",
    badgeEn: "New Season · Muscat, Oman",
    badgeAr: "تشكيلة جديدة · مسقط، عُمان",
    titleEn: "Women & kids fashion, beautifully curated.",
    titleAr: "أزياء نسائية وأطفال، مختارة بعناية وأناقة.",
    ctaEn: "Shop the Collection",
    ctaAr: "تسوقي التشكيلة",
    href: "/shop",
  },
  {
    image: "/images/hero/seed-hero-2.jpg",
    badgeEn: "Evening Wear Edit",
    badgeAr: "تشكيلة فساتين السهرة",
    titleEn: "Gowns and kaftans for every celebration.",
    titleAr: "فساتين سهرة وقفاطين لكل احتفال.",
    ctaEn: "Explore Evening Wear",
    ctaAr: "اكتشفي فساتين السهرة",
    href: "/shop?category=evening-wear",
  },
  {
    image: "/images/hero/seed-hero-3.jpg",
    badgeEn: "Mom & Mini Sets",
    badgeAr: "أطقم الأم والطفلة",
    titleEn: "Matching moments, made for family photos.",
    titleAr: "إطلالات متناسقة تليق بصور العائلة.",
    ctaEn: "Shop Matching Sets",
    ctaAr: "تسوقي الأطقم المتناسقة",
    href: "/shop?category=mom-mini-sets",
  },
];

export const DEFAULT_HERO_FEATURES: HeroFeatureItem[] = [
  {
    image: "/images/icons/icon-01.svg",
    titleEn: "Free Shipping",
    titleAr: "شحن مجاني",
    descEn: "On all orders over 20 OMR",
    descAr: "لجميع الطلبات فوق 20 ر.ع.",
  },
  {
    image: "/images/icons/icon-02.svg",
    titleEn: "Easy Returns",
    titleAr: "إرجاع سهل",
    descEn: "Return within 1 day",
    descAr: "استرداد خلال يوم واحد",
  },
  {
    image: "/images/icons/icon-03.svg",
    titleEn: "100% Secure Payments",
    titleAr: "دفع آمن 100%",
    descEn: "Your data is protected",
    descAr: "حماية كاملة لبياناتك",
  },
  {
    image: "/images/icons/icon-04.svg",
    titleEn: "24/7 Support",
    titleAr: "دعم على مدار الساعة",
    descEn: "Anywhere & anytime",
    descAr: "في أي وقت وأي مكان",
  },
];

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  slides: DEFAULT_HERO_SLIDES,
  features: DEFAULT_HERO_FEATURES,
};

export const HERO_SLIDES_KEY = "hero_slides";
export const HERO_FEATURES_KEY = "hero_features";

/** Coerce an unknown value (from the settings store) into a typed slide array. */
export function normalizeSlides(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_HERO_SLIDES;
  return raw
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        image: String(o.image ?? ""),
        badgeEn: String(o.badgeEn ?? ""),
        badgeAr: String(o.badgeAr ?? ""),
        titleEn: String(o.titleEn ?? ""),
        titleAr: String(o.titleAr ?? ""),
        ctaEn: String(o.ctaEn ?? ""),
        ctaAr: String(o.ctaAr ?? ""),
        href: String(o.href ?? "/shop"),
      };
    })
    .filter((s) => s.titleEn || s.titleAr || s.image);
}

/** Coerce an unknown value (from the settings store) into a typed feature array. */
export function normalizeFeatures(raw: unknown): HeroFeatureItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_HERO_FEATURES;
  return raw
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      return {
        image: String(o.image ?? ""),
        titleEn: String(o.titleEn ?? ""),
        titleAr: String(o.titleAr ?? ""),
        descEn: String(o.descEn ?? ""),
        descAr: String(o.descAr ?? ""),
      };
    })
    .filter((f) => f.titleEn || f.titleAr);
}

/** Fetch the hero configuration from the public API (client-side). */
export async function fetchHero(signal?: AbortSignal): Promise<HeroConfig> {
  try {
    const res = await fetch("/api/hero", { signal });
    const json = await res.json();
    if (!json.success) return DEFAULT_HERO_CONFIG;
    return {
      slides: normalizeSlides(json.data?.slides),
      features: normalizeFeatures(json.data?.features),
    };
  } catch {
    return DEFAULT_HERO_CONFIG;
  }
}
