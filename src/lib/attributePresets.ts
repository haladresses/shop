import type { AttributeOption, AttributeType } from "@/lib/attributes";

/**
 * Ready-made, bilingual specification fields for a fashion store. The admin
 * adds one with a single click instead of typing labels, translations and
 * option lists by hand; everything stays editable afterwards.
 */
export type AttributePreset = {
  key: string;
  labelEn: string;
  labelAr: string;
  type: AttributeType;
  group: PresetGroup;
  options?: AttributeOption[];
  unit?: string;
  placeholder?: string;
  isFilterable?: boolean;
};

export type PresetGroup = "fabric" | "fit" | "style" | "details";

export const PRESET_GROUPS: { id: PresetGroup; labelEn: string; labelAr: string }[] = [
  { id: "fabric", labelEn: "Fabric & feel", labelAr: "الخامة والملمس" },
  { id: "fit", labelEn: "Fit & cut", labelAr: "القصة والمقاس" },
  { id: "style", labelEn: "Style & occasion", labelAr: "الستايل والمناسبة" },
  { id: "details", labelEn: "Care & details", labelAr: "العناية والتفاصيل" },
];

const opt = (value: string, labelEn: string, labelAr: string, hex?: string): AttributeOption =>
  hex ? { value, labelEn, labelAr, hex } : { value, labelEn, labelAr };

export const ATTRIBUTE_PRESETS: AttributePreset[] = [
  // ── Fabric & feel ──────────────────────────────
  {
    key: "fabric", labelEn: "Fabric", labelAr: "الخامة", type: "MULTISELECT", group: "fabric", isFilterable: true,
    options: [
      opt("cotton", "Cotton", "قطن"), opt("linen", "Linen", "كتان"), opt("silk", "Silk", "حرير"),
      opt("satin", "Satin", "ساتان"), opt("chiffon", "Chiffon", "شيفون"), opt("crepe", "Crepe", "كريب"),
      opt("velvet", "Velvet", "مخمل"), opt("lace", "Lace", "دانتيل"), opt("tulle", "Tulle", "تول"),
      opt("organza", "Organza", "أورجانزا"), opt("jersey", "Jersey", "جيرسيه"), opt("viscose", "Viscose", "فيسكوز"),
      opt("polyester", "Polyester", "بوليستر"),
    ],
  },
  {
    key: "lining", labelEn: "Lining", labelAr: "البطانة", type: "SELECT", group: "fabric",
    options: [
      opt("fully_lined", "Fully lined", "مبطّن بالكامل"),
      opt("partially_lined", "Partially lined", "مبطّن جزئياً"),
      opt("unlined", "Unlined", "بدون بطانة"),
    ],
  },
  {
    key: "sheerness", labelEn: "Sheerness", labelAr: "الشفافية", type: "SELECT", group: "fabric",
    options: [
      opt("opaque", "Not sheer", "غير شفاف"),
      opt("slightly_sheer", "Slightly sheer", "شفاف قليلاً"),
      opt("sheer", "Sheer", "شفاف"),
    ],
  },
  {
    key: "stretch", labelEn: "Stretch", labelAr: "المرونة", type: "SELECT", group: "fabric",
    options: [
      opt("no_stretch", "No stretch", "بدون مرونة"),
      opt("slight_stretch", "Slight stretch", "مرونة خفيفة"),
      opt("stretchy", "Stretchy", "مرن"),
    ],
  },

  // ── Fit & cut ──────────────────────────────────
  {
    key: "fit", labelEn: "Fit", labelAr: "القصة", type: "SELECT", group: "fit", isFilterable: true,
    options: [
      opt("regular", "Regular", "عادية"), opt("slim", "Slim", "ضيقة"), opt("loose", "Loose", "واسعة"),
      opt("a_line", "A-line", "قصة A"), opt("bodycon", "Bodycon", "ملتصقة بالجسم"), opt("flowy", "Flowy", "منسدلة"),
    ],
  },
  {
    key: "length", labelEn: "Length", labelAr: "الطول", type: "SELECT", group: "fit", isFilterable: true,
    options: [
      opt("mini", "Mini", "قصير"), opt("knee", "Knee length", "حتى الركبة"), opt("midi", "Midi", "ميدي"),
      opt("maxi", "Maxi", "ماكسي"), opt("floor", "Floor length", "يلامس الأرض"),
    ],
  },
  {
    key: "neckline", labelEn: "Neckline", labelAr: "فتحة الرقبة", type: "SELECT", group: "fit",
    options: [
      opt("round", "Round", "دائرية"), opt("v_neck", "V-neck", "على شكل V"), opt("square", "Square", "مربعة"),
      opt("high_neck", "High neck", "رقبة عالية"), opt("off_shoulder", "Off-shoulder", "مكشوفة الكتفين"),
      opt("sweetheart", "Sweetheart", "على شكل قلب"), opt("halter", "Halter", "هالتر"), opt("boat", "Boat neck", "رقبة قارب"),
    ],
  },
  {
    key: "sleeve", labelEn: "Sleeves", labelAr: "الأكمام", type: "SELECT", group: "fit", isFilterable: true,
    options: [
      opt("sleeveless", "Sleeveless", "بدون أكمام"), opt("short", "Short sleeves", "أكمام قصيرة"),
      opt("three_quarter", "3/4 sleeves", "أكمام ثلاثة أرباع"), opt("long", "Long sleeves", "أكمام طويلة"),
      opt("puff", "Puff sleeves", "أكمام منفوخة"),
    ],
  },
  {
    key: "closure", labelEn: "Closure", labelAr: "طريقة الإغلاق", type: "SELECT", group: "fit",
    options: [
      opt("zipper", "Zipper", "سحّاب"), opt("buttons", "Buttons", "أزرار"),
      opt("tie", "Tie / wrap", "ربطة"), opt("pull_on", "Pull-on", "بدون إغلاق"),
    ],
  },
  { key: "garment_length", labelEn: "Garment length", labelAr: "طول القطعة", type: "NUMBER", group: "fit", unit: "cm", placeholder: "140" },

  // ── Style & occasion ───────────────────────────
  {
    key: "occasion", labelEn: "Occasion", labelAr: "المناسبة", type: "MULTISELECT", group: "style", isFilterable: true,
    options: [
      opt("casual", "Casual", "يومي"), opt("evening", "Evening", "سهرة"), opt("wedding", "Wedding", "زفاف"),
      opt("party", "Party", "حفلة"), opt("work", "Work", "عمل"), opt("eid", "Eid", "عيد"),
      opt("ramadan", "Ramadan", "رمضان"), opt("beach", "Beach", "شاطئ"),
    ],
  },
  {
    key: "pattern", labelEn: "Pattern", labelAr: "النقشة", type: "SELECT", group: "style", isFilterable: true,
    options: [
      opt("solid", "Solid", "سادة"), opt("floral", "Floral", "ورود"), opt("striped", "Striped", "مقلّم"),
      opt("polka_dot", "Polka dot", "منقّط"), opt("printed", "Printed", "مطبوع"), opt("checked", "Checked", "كاروهات"),
    ],
  },
  {
    key: "embellishment", labelEn: "Embellishment", labelAr: "الزينة", type: "MULTISELECT", group: "style",
    options: [
      opt("beads", "Beads", "خرز"), opt("sequins", "Sequins", "ترتر"), opt("embroidery", "Embroidery", "تطريز"),
      opt("pearls", "Pearls", "لؤلؤ"), opt("crystals", "Crystals", "كريستال"), opt("none", "None", "بدون"),
    ],
  },
  {
    key: "color_family", labelEn: "Colour family", labelAr: "عائلة اللون", type: "COLOR", group: "style", isFilterable: true,
    options: [
      opt("black", "Black", "أسود", "#111111"), opt("white", "White", "أبيض", "#ffffff"),
      opt("beige", "Beige", "بيج", "#d9c3a5"), opt("red", "Red", "أحمر", "#c62828"),
      opt("pink", "Pink", "وردي", "#ec8fb3"), opt("blue", "Blue", "أزرق", "#1e5bb8"),
      opt("green", "Green", "أخضر", "#2e7d32"), opt("gold", "Gold", "ذهبي", "#c9a227"),
      opt("silver", "Silver", "فضي", "#b8bcc2"),
    ],
  },
  {
    key: "season", labelEn: "Season", labelAr: "الموسم", type: "MULTISELECT", group: "style",
    options: [
      opt("summer", "Summer", "صيف"), opt("winter", "Winter", "شتاء"), opt("spring", "Spring", "ربيع"),
      opt("autumn", "Autumn", "خريف"), opt("all_year", "All year", "طوال العام"),
    ],
  },
  { key: "modest", labelEn: "Modest design", labelAr: "تصميم محتشم", type: "BOOLEAN", group: "style", isFilterable: true },

  // ── Care & details ─────────────────────────────
  {
    key: "care", labelEn: "Care instructions", labelAr: "طريقة العناية", type: "MULTISELECT", group: "details",
    options: [
      opt("hand_wash", "Hand wash", "غسيل يدوي"), opt("machine_cold", "Machine wash cold", "غسيل بالغسالة بماء بارد"),
      opt("dry_clean", "Dry clean only", "تنظيف جاف فقط"), opt("no_bleach", "Do not bleach", "لا تستخدم المبيّض"),
      opt("iron_low", "Iron on low heat", "كيّ بحرارة منخفضة"),
    ],
  },
  { key: "pockets", labelEn: "Has pockets", labelAr: "يحتوي على جيوب", type: "BOOLEAN", group: "details" },
  { key: "model_size", labelEn: "Model wears size", labelAr: "مقاس العارضة", type: "TEXT", group: "details", placeholder: "M" },
  { key: "model_height", labelEn: "Model height", labelAr: "طول العارضة", type: "NUMBER", group: "details", unit: "cm", placeholder: "170" },
  { key: "origin", labelEn: "Made in", labelAr: "بلد الصنع", type: "TEXT", group: "details", placeholder: "Turkey" },
  { key: "brand", labelEn: "Brand", labelAr: "العلامة التجارية", type: "TEXT", group: "details" },
  { key: "dimensions", labelEn: "Dimensions", labelAr: "الأبعاد", type: "TEXT", group: "details", placeholder: "30 × 20 × 10 cm" },
];

/** One-click starter sets: a typical category's fields in a single step. */
export const PRESET_KITS: { id: string; labelEn: string; labelAr: string; keys: string[] }[] = [
  {
    id: "dresses", labelEn: "Dresses", labelAr: "الفساتين",
    keys: ["fabric", "fit", "length", "neckline", "sleeve", "occasion", "lining", "care"],
  },
  {
    id: "abayas", labelEn: "Abayas & modest wear", labelAr: "العبايات والملابس المحتشمة",
    keys: ["fabric", "length", "sleeve", "closure", "embellishment", "occasion", "modest", "care"],
  },
  {
    id: "accessories", labelEn: "Bags & accessories", labelAr: "الحقائب والإكسسوارات",
    keys: ["color_family", "dimensions", "closure", "brand", "origin"],
  },
];

export const presetByKey = (key: string) => ATTRIBUTE_PRESETS.find((p) => p.key === key);
