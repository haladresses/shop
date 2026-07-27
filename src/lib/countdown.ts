export type CountdownConfig = {
  enabled: boolean;
  eyebrowEn: string;
  eyebrowAr: string;
  titleEn: string;
  titleAr: string;
  ctaEn: string;
  ctaAr: string;
  href: string;
  image: string;
  /** ISO datetime string the countdown ticks down to. */
  endsAt: string;
};

/** Fallback end date used only when no admin value is set yet: 12 days out. */
function defaultEndsAt(): string {
  return new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString();
}

export const DEFAULT_COUNTDOWN_CONFIG: CountdownConfig = {
  enabled: true,
  eyebrowEn: "Don’t Miss!!",
  eyebrowAr: "لا تفوتي",
  titleEn: "This offer ends soon.",
  titleAr: "العرض ينتهي قريباً.",
  ctaEn: "Reserve Your Look",
  ctaAr: "احجزي إطلالتك",
  href: "/shop",
  image: "/images/products/burgundy-tulle-rose-gown-1.jpg",
  endsAt: "",
};

export const COUNTDOWN_CONFIG_KEY = "countdown_config";

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

/** Coerce an unknown value (from the settings store) into a typed countdown config. */
export function normalizeCountdown(raw: unknown): CountdownConfig {
  const d = DEFAULT_COUNTDOWN_CONFIG;
  if (!raw || typeof raw !== "object") return { ...d, endsAt: defaultEndsAt() };
  const o = raw as Record<string, unknown>;
  const endsAt = str(o.endsAt);
  const validEndsAt = endsAt && !Number.isNaN(new Date(endsAt).getTime()) ? endsAt : defaultEndsAt();
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    eyebrowEn: str(o.eyebrowEn, d.eyebrowEn),
    eyebrowAr: str(o.eyebrowAr, d.eyebrowAr),
    titleEn: str(o.titleEn, d.titleEn),
    titleAr: str(o.titleAr, d.titleAr),
    ctaEn: str(o.ctaEn, d.ctaEn),
    ctaAr: str(o.ctaAr, d.ctaAr),
    href: str(o.href, d.href) || "/shop",
    image: str(o.image, d.image),
    endsAt: validEndsAt,
  };
}

/** Fetch the countdown configuration from the public API (client-side). */
export async function fetchCountdown(signal?: AbortSignal): Promise<CountdownConfig> {
  try {
    const res = await fetch("/api/countdown", { signal });
    const json = await res.json();
    if (!json.success) return normalizeCountdown(null);
    return normalizeCountdown(json.data);
  } catch {
    return normalizeCountdown(null);
  }
}
