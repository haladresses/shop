export type TestimonialItem = {
  reviewEn: string;
  reviewAr: string;
  authorNameEn: string;
  authorNameAr: string;
  authorRoleEn: string;
  authorRoleAr: string;
  authorImg: string;
  rating: number;
};

export const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  {
    reviewEn: "My daughter's dress from Hala Dresses was the prettiest at her graduation. Soft fabric, beautiful stitching — delivered right on time.",
    reviewAr: "فستان ابنتي من هلا دريسز كان الأجمل في حفل التخرج. القماش ناعم والخياطة دقيقة، وصلت في الوقت المحدد تماماً.",
    authorNameEn: "Um Mohammed",
    authorNameAr: "أم محمد",
    authorRoleEn: "Mother from Muscat",
    authorRoleAr: "أم من مسقط",
    authorImg: "/images/users/user-01.jpg",
    rating: 5,
  },
  {
    reviewEn: "I've ordered multiple times and every time they exceed my expectations. Colors match exactly, and customer service is excellent.",
    reviewAr: "تسوقت أكثر من مرة وفي كل مرة تتجاوز توقعاتي. الألوان حقيقية تماماً كما في الصور، وخدمة العملاء ممتازة.",
    authorNameEn: "Sara Al-Harthi",
    authorNameAr: "سارة الحارثي",
    authorRoleEn: "Loyal Customer",
    authorRoleAr: "عميلة دائمة",
    authorImg: "/images/users/user-02.jpg",
    rating: 5,
  },
  {
    reviewEn: "Bought an occasion dress for my little girl and it was stunning. High quality at a fair price. I recommend it to every mother.",
    reviewAr: "اشتريت فستان مناسبة لبنتي وكان رائعاً. جودة عالية بسعر مناسب. أنصح كل أم تبحث عن أناقة حقيقية.",
    authorNameEn: "Mona Al-Zadjali",
    authorNameAr: "منى الزدجالية",
    authorRoleEn: "Fashion Blogger",
    authorRoleAr: "مدوّنة موضة",
    authorImg: "/images/users/user-03.jpg",
    rating: 5,
  },
  {
    reviewEn: "What I love most is that the collections always stay fresh and on-trend. Every visit I discover something new that catches my eye.",
    reviewAr: "أجمل ما في هلا دريسز أن التشكيلات تتغير دائماً وتواكب الموضة. كل زيارة أجد شيئاً جديداً يلفت انتباهي.",
    authorNameEn: "Noor Al-Busaidi",
    authorNameAr: "نور البوسعيدي",
    authorRoleEn: "Fashion Designer",
    authorRoleAr: "مصممة أزياء",
    authorImg: "/images/users/user-01.jpg",
    rating: 5,
  },
  {
    reviewEn: "The dress arrived carefully folded in an elegant box, like unwrapping a gift. That attention to detail sets them apart.",
    reviewAr: "الفستان وصل مطوياً بعناية في علبة أنيقة. كأنك تفتح هدية. هذا الاهتمام بالتفاصيل يجعلهم مختلفين.",
    authorNameEn: "Reem Al-Amri",
    authorNameAr: "ريم العامري",
    authorRoleEn: "Professional",
    authorRoleAr: "موظفة",
    authorImg: "/images/users/user-02.jpg",
    rating: 5,
  },
  {
    reviewEn: "Ordered via WhatsApp and the experience was so easy. They replied quickly and answered all my size and color questions.",
    reviewAr: "طلبت عبر واتساب وكانت التجربة سهلة جداً. ردوا بسرعة وأجابوا على كل أسئلتي بخصوص المقاسات والألوان.",
    authorNameEn: "Hind Al-Maammari",
    authorNameAr: "هند المعمري",
    authorRoleEn: "Homemaker",
    authorRoleAr: "ربة منزل",
    authorImg: "/images/users/user-03.jpg",
    rating: 5,
  },
];

export const TESTIMONIALS_KEY = "testimonials_list";

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

function normalizeItem(raw: unknown): TestimonialItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rating = Number(o.rating);
  return {
    reviewEn: str(o.reviewEn),
    reviewAr: str(o.reviewAr),
    authorNameEn: str(o.authorNameEn),
    authorNameAr: str(o.authorNameAr),
    authorRoleEn: str(o.authorRoleEn),
    authorRoleAr: str(o.authorRoleAr),
    authorImg: str(o.authorImg, "/images/users/user-01.jpg"),
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : 5,
  };
}

/** Coerce an unknown value (from the settings store) into a typed testimonial array. */
export function normalizeTestimonials(raw: unknown): TestimonialItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TESTIMONIALS;
  return raw
    .map(normalizeItem)
    .filter((t) => t.reviewEn || t.reviewAr);
}

/** Fetch the testimonials list from the public API (client-side). */
export async function fetchTestimonials(signal?: AbortSignal): Promise<TestimonialItem[]> {
  try {
    const res = await fetch("/api/testimonials", { signal });
    const json = await res.json();
    if (!json.success) return DEFAULT_TESTIMONIALS;
    return normalizeTestimonials(json.data?.items);
  } catch {
    return DEFAULT_TESTIMONIALS;
  }
}

import type { Testimonial } from "@/types/testimonial";

/** Resolve a bilingual testimonial item into the localized shape used by the UI. */
export function mapTestimonial(item: TestimonialItem, language: "en" | "ar"): Testimonial {
  const isArabic = language === "ar";
  return {
    review: (isArabic ? item.reviewAr : item.reviewEn) || item.reviewEn || item.reviewAr,
    authorName: (isArabic ? item.authorNameAr : item.authorNameEn) || item.authorNameEn || item.authorNameAr,
    authorRole: (isArabic ? item.authorRoleAr : item.authorRoleEn) || item.authorRoleEn || item.authorRoleAr,
    authorImg: item.authorImg,
    rating: item.rating,
  };
}
