export type NewsletterConfig = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  placeholderEn: string;
  placeholderAr: string;
  ctaEn: string;
  ctaAr: string;
  successEn: string;
  successAr: string;
  alreadySubscribedEn: string;
  alreadySubscribedAr: string;
  invalidEmailEn: string;
  invalidEmailAr: string;
  errorEn: string;
  errorAr: string;
};

export const DEFAULT_NEWSLETTER_CONFIG: NewsletterConfig = {
  titleEn: "Join the Hala Circle",
  titleAr: "انضمي إلى دائرة هلا",
  descriptionEn: "Get updates on women's and kids' new arrivals, sale announcements, and store news from Muscat.",
  descriptionAr: "احصلي على تحديثات أحدث وصولات النساء والأطفال، والتنزيلات، وأخبار المتجر من مسقط.",
  placeholderEn: "Enter your email for new arrivals",
  placeholderAr: "أدخلي بريدك الإلكتروني لأحدث الوصولات",
  ctaEn: "Stay Updated",
  ctaAr: "اشتركي الآن",
  successEn: "Thanks for subscribing! Watch your inbox for new arrivals.",
  successAr: "شكراً لاشتراكك! ترقبي أحدث العروض قريباً.",
  alreadySubscribedEn: "You're already subscribed — we've got you covered!",
  alreadySubscribedAr: "أنتِ مشتركة بالفعل في نشرتنا البريدية!",
  invalidEmailEn: "Please enter a valid email address.",
  invalidEmailAr: "يرجى إدخال بريد إلكتروني صحيح.",
  errorEn: "Something went wrong, please try again.",
  errorAr: "حدث خطأ ما، حاولي مرة أخرى.",
};

export const NEWSLETTER_CONFIG_KEY = "newsletter_config";

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

/** Coerce an unknown value (from the settings store) into a typed newsletter config. */
export function normalizeNewsletter(raw: unknown): NewsletterConfig {
  const d = DEFAULT_NEWSLETTER_CONFIG;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    titleEn: str(o.titleEn, d.titleEn),
    titleAr: str(o.titleAr, d.titleAr),
    descriptionEn: str(o.descriptionEn, d.descriptionEn),
    descriptionAr: str(o.descriptionAr, d.descriptionAr),
    placeholderEn: str(o.placeholderEn, d.placeholderEn),
    placeholderAr: str(o.placeholderAr, d.placeholderAr),
    ctaEn: str(o.ctaEn, d.ctaEn),
    ctaAr: str(o.ctaAr, d.ctaAr),
    successEn: str(o.successEn, d.successEn),
    successAr: str(o.successAr, d.successAr),
    alreadySubscribedEn: str(o.alreadySubscribedEn, d.alreadySubscribedEn),
    alreadySubscribedAr: str(o.alreadySubscribedAr, d.alreadySubscribedAr),
    invalidEmailEn: str(o.invalidEmailEn, d.invalidEmailEn),
    invalidEmailAr: str(o.invalidEmailAr, d.invalidEmailAr),
    errorEn: str(o.errorEn, d.errorEn),
    errorAr: str(o.errorAr, d.errorAr),
  };
}

/** Fetch the newsletter configuration from the public API (client-side). */
export async function fetchNewsletter(signal?: AbortSignal): Promise<NewsletterConfig> {
  try {
    const res = await fetch("/api/newsletter-config", { signal });
    const json = await res.json();
    if (!json.success) return DEFAULT_NEWSLETTER_CONFIG;
    return normalizeNewsletter(json.data);
  } catch {
    return DEFAULT_NEWSLETTER_CONFIG;
  }
}
