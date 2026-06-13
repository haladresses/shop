export type FooterLink = {
  labelEn: string;
  labelAr: string;
  href: string;
};

export type FooterColumn = {
  titleEn: string;
  titleAr: string;
  links: FooterLink[];
};

export type FooterConfig = {
  brandEn: string;
  brandAr: string;
  addressEn: string;
  addressAr: string;
  phone: string;
  instagramHandle: string;
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  columns: FooterColumn[];
  storeHoursTitleEn: string;
  storeHoursTitleAr: string;
  storeHoursTextEn: string;
  storeHoursTextAr: string;
  whatsappNumber: string;
  whatsappLeadEn: string;
  whatsappLeadAr: string;
  instagramLeadEn: string;
  instagramLeadAr: string;
  copyrightEn: string;
  copyrightAr: string;
};

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  brandEn: "Hala Dresses",
  brandAr: "هلا دريسز",
  addressEn: "Bousher, Muscat, Oman.",
  addressAr: "بوشر، مسقط، عمان.",
  phone: "+968 9944 0312",
  instagramHandle: "instagram.com/7ala_dresses",
  facebookUrl: "#",
  twitterUrl: "#",
  instagramUrl: "https://www.instagram.com/7ala_dresses",
  linkedinUrl: "#",
  columns: [
    {
      titleEn: "Account",
      titleAr: "الحساب",
      links: [
        { labelEn: "My Account", labelAr: "حسابي", href: "#" },
        { labelEn: "Client Login", labelAr: "تسجيل الدخول", href: "#" },
        { labelEn: "Shopping Bag", labelAr: "سلة التسوق", href: "#" },
        { labelEn: "Wishlist", labelAr: "المفضلة", href: "#" },
        { labelEn: "Collections", labelAr: "التشكيلات", href: "#" },
      ],
    },
    {
      titleEn: "Client Care",
      titleAr: "دعم العملاء",
      links: [
        { labelEn: "Privacy Policy", labelAr: "الخصوصية", href: "#" },
        { labelEn: "Refund Policy", labelAr: "الاسترجاع", href: "#" },
        { labelEn: "Terms of Use", labelAr: "شروط الاستخدام", href: "#" },
        { labelEn: "FAQ\u2019s", labelAr: "الأسئلة الشائعة", href: "#" },
        { labelEn: "Contact", labelAr: "اتصل بنا", href: "#" },
      ],
    },
  ],
  storeHoursTitleEn: "Store Hours",
  storeHoursTitleAr: "ساعات العمل",
  storeHoursTextEn: "Saturday to Thursday, 11AM-1PM and 6PM-8PM.",
  storeHoursTextAr: "من السبت إلى الخميس، 11 صباحاً - 1 ظهراً و6 مساءً - 8 مساءً.",
  whatsappNumber: "96899440312",
  whatsappLeadEn: "Chat with us on",
  whatsappLeadAr: "تواصلي معنا عبر",
  instagramLeadEn: "Get in on",
  instagramLeadAr: "تابعينا على",
  copyrightEn: "\u00A9 {year}. Hala Dresses. All rights reserved.",
  copyrightAr: "\u00A9 {year}. هلا دريسز. جميع الحقوق محفوظة.",
};

export const FOOTER_CONFIG_KEY = "footer_config";

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

function normalizeLink(raw: unknown): FooterLink {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    labelEn: str(o.labelEn),
    labelAr: str(o.labelAr),
    href: str(o.href, "#") || "#",
  };
}

function normalizeColumn(raw: unknown): FooterColumn {
  const o = (raw ?? {}) as Record<string, unknown>;
  const links = Array.isArray(o.links)
    ? o.links.map(normalizeLink).filter((l) => l.labelEn || l.labelAr)
    : [];
  return {
    titleEn: str(o.titleEn),
    titleAr: str(o.titleAr),
    links,
  };
}

/** Coerce an unknown value (from the settings store) into a typed footer config. */
export function normalizeFooter(raw: unknown): FooterConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_FOOTER_CONFIG;
  const o = raw as Record<string, unknown>;
  const d = DEFAULT_FOOTER_CONFIG;
  const columns = Array.isArray(o.columns)
    ? o.columns.map(normalizeColumn).filter((c) => c.titleEn || c.titleAr || c.links.length)
    : d.columns;
  return {
    brandEn: str(o.brandEn, d.brandEn),
    brandAr: str(o.brandAr, d.brandAr),
    addressEn: str(o.addressEn, d.addressEn),
    addressAr: str(o.addressAr, d.addressAr),
    phone: str(o.phone, d.phone),
    instagramHandle: str(o.instagramHandle, d.instagramHandle),
    facebookUrl: str(o.facebookUrl, d.facebookUrl) || "#",
    twitterUrl: str(o.twitterUrl, d.twitterUrl) || "#",
    instagramUrl: str(o.instagramUrl, d.instagramUrl) || "#",
    linkedinUrl: str(o.linkedinUrl, d.linkedinUrl) || "#",
    columns: columns.length ? columns : d.columns,
    storeHoursTitleEn: str(o.storeHoursTitleEn, d.storeHoursTitleEn),
    storeHoursTitleAr: str(o.storeHoursTitleAr, d.storeHoursTitleAr),
    storeHoursTextEn: str(o.storeHoursTextEn, d.storeHoursTextEn),
    storeHoursTextAr: str(o.storeHoursTextAr, d.storeHoursTextAr),
    whatsappNumber: str(o.whatsappNumber, d.whatsappNumber),
    whatsappLeadEn: str(o.whatsappLeadEn, d.whatsappLeadEn),
    whatsappLeadAr: str(o.whatsappLeadAr, d.whatsappLeadAr),
    instagramLeadEn: str(o.instagramLeadEn, d.instagramLeadEn),
    instagramLeadAr: str(o.instagramLeadAr, d.instagramLeadAr),
    copyrightEn: str(o.copyrightEn, d.copyrightEn),
    copyrightAr: str(o.copyrightAr, d.copyrightAr),
  };
}

/** Fetch the footer configuration from the public API (client-side). */
export async function fetchFooter(signal?: AbortSignal): Promise<FooterConfig> {
  try {
    const res = await fetch("/api/footer", { signal });
    const json = await res.json();
    if (!json.success) return DEFAULT_FOOTER_CONFIG;
    return normalizeFooter(json.data);
  } catch {
    return DEFAULT_FOOTER_CONFIG;
  }
}
