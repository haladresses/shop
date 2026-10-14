/** Which side of the slide the photo sits on. Logical, so it mirrors in RTL. */
export type HeroImageSide = "end" | "start";

export type HeroSlide = {
  image: string;
  /** Optional portrait crop used on phones (falls back to `image`). */
  mobileImage: string;
  badgeEn: string;
  badgeAr: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  ctaEn: string;
  ctaAr: string;
  href: string;
  cta2En: string;
  cta2Ar: string;
  href2: string;
  imageSide: HeroImageSide;
  /** Per-slide accent (buttons, badge, 3D tint). Empty = global accent. */
  accent: string;
};

export type HeroFeatureItem = {
  image: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
};

export type HeroLayout = "split" | "fullbleed" | "centered";
export type HeroEffect = "silk" | "particles" | "aurora" | "none";
export type HeroHeight = "md" | "lg" | "screen";

/** Global hero options, edited from the admin "Design" tab. */
export type HeroSettings = {
  layout: HeroLayout;
  effect: HeroEffect;
  height: HeroHeight;
  autoplay: boolean;
  intervalMs: number;
  accent: string;
  /** Solid background colour of the hero (no gradients). */
  background: string;
  /** 0–80: darkening over the photo in the full-bleed layout. */
  overlay: number;
  showFeatures: boolean;
  showSocialProof: boolean;
  socialProofEn: string;
  socialProofAr: string;
  showArrows: boolean;
};

export type HeroConfig = {
  slides: HeroSlide[];
  features: HeroFeatureItem[];
  settings: HeroSettings;
};

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  layout: "split",
  effect: "particles",
  height: "lg",
  autoplay: true,
  intervalMs: 6000,
  accent: "#8C3B49",
  background: "#F7F2EE",
  overlay: 35,
  showFeatures: false,
  showSocialProof: false,
  socialProofEn: "5,000+ happy customers",
  socialProofAr: "أكثر من 5,000 عميلة سعيدة",
  showArrows: true,
};

const DEFAULT_SUBTITLE_EN = "Fast delivery across Oman, sizes for every fit, and fresh pieces curated weekly just for you.";
const DEFAULT_SUBTITLE_AR = "توصيل سريع داخل عُمان، مقاسات متعددة، وقطع مختارة أسبوعياً بأناقة تليق بكِ.";

export const EMPTY_HERO_SLIDE: HeroSlide = {
  image: "",
  mobileImage: "",
  badgeEn: "",
  badgeAr: "",
  titleEn: "",
  titleAr: "",
  subtitleEn: "",
  subtitleAr: "",
  ctaEn: "",
  ctaAr: "",
  href: "/shop",
  cta2En: "",
  cta2Ar: "",
  href2: "",
  imageSide: "end",
  accent: "",
};

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    ...EMPTY_HERO_SLIDE,
    image: "/images/hero/seed-hero-1.jpg",
    badgeEn: "New Season · Muscat, Oman",
    badgeAr: "تشكيلة جديدة · مسقط، عُمان",
    titleEn: "Women & kids fashion, beautifully curated.",
    titleAr: "أزياء نسائية وأطفال، مختارة بعناية وأناقة.",
    subtitleEn: DEFAULT_SUBTITLE_EN,
    subtitleAr: DEFAULT_SUBTITLE_AR,
    ctaEn: "Shop the Collection",
    ctaAr: "تسوقي التشكيلة",
    href: "/shop",
  },
  {
    ...EMPTY_HERO_SLIDE,
    image: "/images/hero/seed-hero-2.jpg",
    badgeEn: "Evening Wear Edit",
    badgeAr: "تشكيلة فساتين السهرة",
    titleEn: "Gowns and kaftans for every celebration.",
    titleAr: "فساتين سهرة وقفاطين لكل احتفال.",
    subtitleEn: DEFAULT_SUBTITLE_EN,
    subtitleAr: DEFAULT_SUBTITLE_AR,
    ctaEn: "Explore Evening Wear",
    ctaAr: "اكتشفي فساتين السهرة",
    href: "/shop?category=evening-wear",
  },
  {
    ...EMPTY_HERO_SLIDE,
    image: "/images/hero/seed-hero-3.jpg",
    badgeEn: "Mom & Mini Sets",
    badgeAr: "أطقم الأم والطفلة",
    titleEn: "Matching moments, made for family photos.",
    titleAr: "إطلالات متناسقة تليق بصور العائلة.",
    subtitleEn: DEFAULT_SUBTITLE_EN,
    subtitleAr: DEFAULT_SUBTITLE_AR,
    ctaEn: "Shop Matching Sets",
    ctaAr: "تسوقي الأطقم المتناسقة",
    href: "/shop?category=mom-mini-sets",
  },
];

export const DEFAULT_HERO_FEATURES: HeroFeatureItem[] = [
  { image: "/images/icons/icon-01.svg", titleEn: "Free Shipping", titleAr: "شحن مجاني", descEn: "On all orders over 20 OMR", descAr: "لجميع الطلبات فوق 20 ر.ع." },
  { image: "/images/icons/icon-02.svg", titleEn: "Easy Returns", titleAr: "إرجاع سهل", descEn: "Return within 1 day", descAr: "استرداد خلال يوم واحد" },
  { image: "/images/icons/icon-03.svg", titleEn: "100% Secure Payments", titleAr: "دفع آمن 100%", descEn: "Your data is protected", descAr: "حماية كاملة لبياناتك" },
  { image: "/images/icons/icon-04.svg", titleEn: "24/7 Support", titleAr: "دعم على مدار الساعة", descEn: "Anywhere & anytime", descAr: "في أي وقت وأي مكان" },
];

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  slides: DEFAULT_HERO_SLIDES,
  features: DEFAULT_HERO_FEATURES,
  settings: DEFAULT_HERO_SETTINGS,
};

export const HERO_SLIDES_KEY = "hero_slides";
export const HERO_FEATURES_KEY = "hero_features";
export const HERO_SETTINGS_KEY = "hero_settings";

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/** Coerce an unknown value (from the settings store) into a typed slide array. */
export function normalizeSlides(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_HERO_SLIDES;
  return raw
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const str = (k: string, fb = "") => (o[k] == null ? fb : String(o[k]));
      return {
        image: str("image"),
        mobileImage: str("mobileImage"),
        badgeEn: str("badgeEn"),
        badgeAr: str("badgeAr"),
        titleEn: str("titleEn"),
        titleAr: str("titleAr"),
        // Slides saved before subtitles existed keep the line that used to be hard-coded.
        subtitleEn: str("subtitleEn", DEFAULT_SUBTITLE_EN),
        subtitleAr: str("subtitleAr", DEFAULT_SUBTITLE_AR),
        ctaEn: str("ctaEn"),
        ctaAr: str("ctaAr"),
        href: str("href", "/shop"),
        cta2En: str("cta2En"),
        cta2Ar: str("cta2Ar"),
        href2: str("href2"),
        imageSide: pick(o.imageSide, ["end", "start"] as const, "end"),
        accent: typeof o.accent === "string" && HEX.test(o.accent) ? o.accent : "",
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

/** Coerce an unknown value (from the settings store) into hero settings. */
export function normalizeSettings(raw: unknown): HeroSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_HERO_SETTINGS;
  const color = (v: unknown, fb: string) => (typeof v === "string" && HEX.test(v) ? v : fb);
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  const n = Number(o.intervalMs);
  const ov = Number(o.overlay);
  return {
    layout: pick(o.layout, ["split", "fullbleed", "centered"] as const, d.layout),
    effect: pick(o.effect, ["silk", "particles", "aurora", "none"] as const, d.effect),
    height: pick(o.height, ["md", "lg", "screen"] as const, d.height),
    autoplay: bool(o.autoplay, d.autoplay),
    intervalMs: o.intervalMs != null && Number.isFinite(n) ? Math.min(20000, Math.max(2500, n)) : d.intervalMs,
    accent: color(o.accent, d.accent),
    // `bgFrom` is the pre-solid-background field name.
    background: color(o.background, color(o.bgFrom, d.background)),
    overlay: o.overlay != null && Number.isFinite(ov) ? Math.min(80, Math.max(0, ov)) : d.overlay,
    showFeatures: bool(o.showFeatures, d.showFeatures),
    showSocialProof: bool(o.showSocialProof, d.showSocialProof),
    socialProofEn: typeof o.socialProofEn === "string" ? o.socialProofEn : d.socialProofEn,
    socialProofAr: typeof o.socialProofAr === "string" ? o.socialProofAr : d.socialProofAr,
    showArrows: bool(o.showArrows, d.showArrows),
  };
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
      settings: normalizeSettings(json.data?.settings),
    };
  } catch {
    return DEFAULT_HERO_CONFIG;
  }
}
