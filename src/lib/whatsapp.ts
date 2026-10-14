// Floating WhatsApp chat popup — config stored as one JSON setting and edited
// under Admin → Settings → WhatsApp.

export type WhatsAppWidgetConfig = {
  enabled: boolean;
  /** International format, any spacing, e.g. "+968 9944 0312". */
  phone: string;
  nameEn: string;
  nameAr: string;
  statusEn: string;
  statusAr: string;
  greetingEn: string;
  greetingAr: string;
  /** Message pre-filled in WhatsApp. On product pages the product link is appended. */
  prefillEn: string;
  prefillAr: string;
  position: "end" | "start";
  /** Seconds before the greeting bubble pops up by itself (0 = never). */
  autoOpenSeconds: number;
  showOnMobile: boolean;
};

export const WHATSAPP_WIDGET_KEY = "whatsapp_widget";

export const DEFAULT_WHATSAPP_WIDGET: WhatsAppWidgetConfig = {
  enabled: true,
  phone: "+968 9944 0312",
  nameEn: "Hala Dresses",
  nameAr: "هلا دريسز",
  statusEn: "Typically replies within minutes",
  statusAr: "نرد عادةً خلال دقائق",
  greetingEn: "Hi there 👋\nNeed help choosing a size or a dress? Chat with us on WhatsApp.",
  greetingAr: "أهلاً بكِ 👋\nتحتاجين مساعدة في اختيار المقاس أو الفستان؟ تواصلي معنا على واتساب.",
  prefillEn: "Hello Hala Dresses, I'd like some help.",
  prefillAr: "مرحباً هلا دريسز، أحتاج مساعدة.",
  position: "end",
  autoOpenSeconds: 12,
  showOnMobile: true,
};

const str = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);

export function normalizeWhatsApp(raw: unknown): WhatsAppWidgetConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_WHATSAPP_WIDGET;
  const n = Number(o.autoOpenSeconds);
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    phone: str(o.phone, d.phone).trim() || d.phone,
    nameEn: str(o.nameEn, d.nameEn),
    nameAr: str(o.nameAr, d.nameAr),
    statusEn: str(o.statusEn, d.statusEn),
    statusAr: str(o.statusAr, d.statusAr),
    greetingEn: str(o.greetingEn, d.greetingEn),
    greetingAr: str(o.greetingAr, d.greetingAr),
    prefillEn: str(o.prefillEn, d.prefillEn),
    prefillAr: str(o.prefillAr, d.prefillAr),
    position: o.position === "start" ? "start" : "end",
    autoOpenSeconds: o.autoOpenSeconds != null && Number.isFinite(n) ? Math.min(300, Math.max(0, Math.round(n))) : d.autoOpenSeconds,
    showOnMobile: typeof o.showOnMobile === "boolean" ? o.showOnMobile : d.showOnMobile,
  };
}

/** wa.me link: digits only, no "+" or leading zeros. */
export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
