// Shared content model for the storefront's legal/policy pages (Privacy
// Policy, Refund Policy, Terms of Use) plus the FAQ page. All four follow
// the same Setting-JSON pattern as Hero/Footer/Testimonials: defaults live
// here, are served publicly via a dedicated /api route, and are edited from
// the admin "Legal Pages" screen.

export type LegalSection = {
  headingEn: string;
  headingAr: string;
  /** Plain text; lines starting with "- " render as bullet points. */
  bodyEn: string;
  bodyAr: string;
};

export type LegalPageConfig = {
  titleEn: string;
  titleAr: string;
  introEn: string;
  introAr: string;
  sections: LegalSection[];
};

export type FaqItem = {
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
};

export type FaqConfig = {
  titleEn: string;
  titleAr: string;
  introEn: string;
  introAr: string;
  items: FaqItem[];
};

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

function normalizeSection(raw: unknown): LegalSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    headingEn: str(o.headingEn),
    headingAr: str(o.headingAr),
    bodyEn: str(o.bodyEn),
    bodyAr: str(o.bodyAr),
  };
}

export function normalizeLegalPage(raw: unknown, fallback: LegalPageConfig): LegalPageConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const sections = Array.isArray(o.sections)
    ? o.sections.map(normalizeSection).filter((s) => s.headingEn || s.headingAr || s.bodyEn || s.bodyAr)
    : fallback.sections;
  return {
    titleEn: str(o.titleEn, fallback.titleEn),
    titleAr: str(o.titleAr, fallback.titleAr),
    introEn: str(o.introEn, fallback.introEn),
    introAr: str(o.introAr, fallback.introAr),
    sections: sections.length ? sections : fallback.sections,
  };
}

function normalizeFaqItem(raw: unknown): FaqItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    questionEn: str(o.questionEn),
    questionAr: str(o.questionAr),
    answerEn: str(o.answerEn),
    answerAr: str(o.answerAr),
  };
}

export function normalizeFaq(raw: unknown): FaqConfig {
  const fallback = DEFAULT_FAQ_CONFIG;
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const items = Array.isArray(o.items)
    ? o.items.map(normalizeFaqItem).filter((i) => i.questionEn || i.questionAr)
    : fallback.items;
  return {
    titleEn: str(o.titleEn, fallback.titleEn),
    titleAr: str(o.titleAr, fallback.titleAr),
    introEn: str(o.introEn, fallback.introEn),
    introAr: str(o.introAr, fallback.introAr),
    items: items.length ? items : fallback.items,
  };
}

// ─────────────────────────────────────────────
// PRIVACY POLICY
// ─────────────────────────────────────────────

export const PRIVACY_POLICY_KEY = "privacy_policy_config";

export const DEFAULT_PRIVACY_POLICY: LegalPageConfig = {
  titleEn: "Privacy Policy",
  titleAr: "سياسة الخصوصية",
  introEn:
    "Hala Dresses (“we”, “us”) respects your privacy. This policy explains what information we collect when you shop with us in Oman, how we use it, and the choices you have.",
  introAr:
    "تحترم هلا دريسز (“نحن”) خصوصيتك. توضح هذه السياسة المعلومات التي نجمعها عند تسوقك معنا في عُمان، وكيفية استخدامها، والخيارات المتاحة لكِ.",
  sections: [
    {
      headingEn: "Information We Collect",
      headingAr: "المعلومات التي نجمعها",
      bodyEn:
        "When you create an account, place an order, or contact us, we may collect:\n- Your name, phone number, and email address\n- Delivery address and city\n- Order history and items you have purchased or saved to your wishlist\n- Messages you send us via WhatsApp, phone, or the contact form",
      bodyAr:
        "عند إنشاء حساب أو تقديم طلب أو التواصل معنا، قد نجمع:\n- اسمكِ ورقم هاتفكِ وبريدكِ الإلكتروني\n- عنوان التوصيل والمدينة\n- سجل الطلبات والمنتجات التي اشتريتِها أو أضفتِها للمفضلة\n- الرسائل التي ترسلينها لنا عبر واتساب أو الهاتف أو نموذج التواصل",
    },
    {
      headingEn: "How We Use Your Information",
      headingAr: "كيفية استخدام معلوماتك",
      bodyEn:
        "We use your information to:\n- Process and deliver your orders through our shipping partner, Wasellee\n- Send order confirmations and delivery updates by WhatsApp or phone\n- Respond to your questions and provide customer support\n- Send you newsletter updates about new arrivals and offers, only if you subscribed\n- Improve our products, website, and shopping experience",
      bodyAr:
        "نستخدم معلوماتك من أجل:\n- معالجة طلباتك وتوصيلها عبر شريك الشحن وصلي\n- إرسال تأكيدات الطلب وتحديثات التوصيل عبر واتساب أو الهاتف\n- الرد على استفساراتك وتقديم الدعم\n- إرسال تحديثات النشرة البريدية عن الوصولات والعروض، فقط إذا اشتركتِ فيها\n- تحسين منتجاتنا وموقعنا وتجربة التسوق لديكِ",
    },
    {
      headingEn: "Payments",
      headingAr: "المدفوعات",
      bodyEn:
        "Card payments are processed securely by Thawani, a licensed payment gateway in Oman. We do not store your full card details on our servers. Cash on delivery orders are settled directly with our delivery partner.",
      bodyAr:
        "تتم معالجة المدفوعات بالبطاقة بشكل آمن عبر بوابة الدفع المرخصة “ثواني”. نحن لا نحتفظ ببيانات بطاقتكِ الكاملة على خوادمنا. طلبات الدفع عند الاستلام تُسوّى مباشرة مع شريك التوصيل.",
    },
    {
      headingEn: "Sharing Your Information",
      headingAr: "مشاركة معلوماتك",
      bodyEn:
        "We only share your information with trusted partners needed to fulfill your order — our delivery partner (Wasellee) and our payment gateway (Thawani). We never sell your personal information to third parties.",
      bodyAr:
        "نشارك معلوماتك فقط مع الشركاء الموثوقين اللازمين لإتمام طلبك — شريك التوصيل (وصلي) وبوابة الدفع (ثواني). نحن لا نبيع بياناتك الشخصية لأي طرف ثالث أبداً.",
    },
    {
      headingEn: "Cookies",
      headingAr: "ملفات تعريف الارتباط",
      bodyEn:
        "Our website uses essential cookies to keep your cart and session working correctly, and to remember your language preference. These do not track you across other websites.",
      bodyAr:
        "يستخدم موقعنا ملفات تعريف ارتباط أساسية للحفاظ على عمل سلة التسوق والجلسة بشكل صحيح، ولتذكّر لغتكِ المفضلة. هذه الملفات لا تتعقبكِ عبر مواقع أخرى.",
    },
    {
      headingEn: "Data Security",
      headingAr: "أمان البيانات",
      bodyEn:
        "We take reasonable technical and organizational measures to protect your information from unauthorized access, loss, or misuse.",
      bodyAr:
        "نتخذ إجراءات تقنية وتنظيمية معقولة لحماية معلوماتك من الوصول غير المصرح به أو الفقدان أو سوء الاستخدام.",
    },
    {
      headingEn: "Your Rights",
      headingAr: "حقوقك",
      bodyEn:
        "You may ask us to access, correct, or delete your personal information at any time, and you can unsubscribe from marketing emails whenever you like. Contact us using the details below.",
      bodyAr:
        "يمكنكِ في أي وقت طلب الاطلاع على معلوماتك الشخصية أو تصحيحها أو حذفها، كما يمكنكِ إلغاء الاشتراك في الرسائل التسويقية متى شئتِ. تواصلي معنا عبر التفاصيل أدناه.",
    },
    {
      headingEn: "Contact Us",
      headingAr: "تواصلي معنا",
      bodyEn:
        "If you have any questions about this Privacy Policy, please reach out through our Contact page or WhatsApp — we're happy to help.",
      bodyAr:
        "إذا كان لديكِ أي استفسار حول سياسة الخصوصية هذه، تواصلي معنا عبر صفحة الاتصال أو واتساب — يسعدنا مساعدتك.",
    },
  ],
};

// ─────────────────────────────────────────────
// TERMS OF USE
// ─────────────────────────────────────────────

export const TERMS_OF_USE_KEY = "terms_of_use_config";

export const DEFAULT_TERMS_OF_USE: LegalPageConfig = {
  titleEn: "Terms of Use",
  titleAr: "شروط الاستخدام",
  introEn:
    "Welcome to Hala Dresses. By browsing our website or placing an order, you agree to the following terms. Please read them carefully.",
  introAr:
    "مرحباً بكِ في هلا دريسز. باستخدام موقعنا أو تقديم طلب، فإنكِ توافقين على الشروط التالية. يرجى قراءتها بعناية.",
  sections: [
    {
      headingEn: "Acceptance of Terms",
      headingAr: "قبول الشروط",
      bodyEn:
        "By accessing or using this website you agree to be bound by these Terms of Use and our Privacy Policy. If you do not agree, please do not use our website.",
      bodyAr:
        "باستخدامكِ لهذا الموقع فإنكِ توافقين على الالتزام بشروط الاستخدام هذه وبسياسة الخصوصية الخاصة بنا. إذا كنتِ لا توافقين، يرجى عدم استخدام الموقع.",
    },
    {
      headingEn: "Orders & Payment",
      headingAr: "الطلبات والدفع",
      bodyEn:
        "All prices are listed in Omani Rials (OMR). We accept Cash on Delivery and secure card payments via Thawani. An order is confirmed once payment is completed or, for cash on delivery, once we confirm the order by WhatsApp or phone.",
      bodyAr:
        "جميع الأسعار معروضة بالريال العماني (ر.ع.). نقبل الدفع عند الاستلام والدفع الآمن بالبطاقة عبر ثواني. يُعتبر الطلب مؤكداً بعد إتمام الدفع، أو بالنسبة للدفع عند الاستلام، بعد تأكيد الطلب عبر واتساب أو الهاتف.",
    },
    {
      headingEn: "Shipping & Delivery",
      headingAr: "الشحن والتوصيل",
      bodyEn:
        "Orders within Oman are delivered through our partner Wasellee to all governorates. Delivery times and costs vary by region and are shown at checkout. Selected international destinations are also available.",
      bodyAr:
        "يتم توصيل الطلبات داخل عُمان عبر شريكنا وصلي إلى جميع المحافظات. تختلف مدة وتكلفة التوصيل حسب المنطقة وتظهر عند إتمام الطلب. كما نوفر التوصيل لبعض الوجهات الدولية المختارة.",
    },
    {
      headingEn: "Returns & Exchanges",
      headingAr: "الإرجاع والاستبدال",
      bodyEn:
        "Returns and exchanges are handled according to our Refund Policy, in line with Oman's Consumer Protection Law.",
      bodyAr:
        "يتم التعامل مع الإرجاع والاستبدال وفق سياسة الاسترجاع الخاصة بنا، بما يتوافق مع قانون حماية المستهلك العُماني.",
    },
    {
      headingEn: "Intellectual Property",
      headingAr: "الملكية الفكرية",
      bodyEn:
        "All content on this website — including photos, logos, and text — is the property of Hala Dresses and may not be copied or reused without our written permission.",
      bodyAr:
        "جميع محتويات هذا الموقع — بما في ذلك الصور والشعارات والنصوص — هي ملك لهلا دريسز ولا يجوز نسخها أو إعادة استخدامها دون إذن كتابي منا.",
    },
    {
      headingEn: "Limitation of Liability",
      headingAr: "حدود المسؤولية",
      bodyEn:
        "We work hard to ensure product descriptions, images, and prices are accurate, but we do not guarantee the website will always be error-free or uninterrupted. We are not liable for indirect or incidental damages arising from the use of our website.",
      bodyAr:
        "نبذل جهدنا لضمان دقة أوصاف المنتجات والصور والأسعار، لكننا لا نضمن خلو الموقع من الأخطاء أو انقطاعه من وقت لآخر. لسنا مسؤولين عن أي أضرار غير مباشرة أو عرضية ناتجة عن استخدام الموقع.",
    },
    {
      headingEn: "Governing Law",
      headingAr: "القانون الحاكم",
      bodyEn:
        "These terms are governed by the laws of the Sultanate of Oman, including applicable Consumer Protection regulations.",
      bodyAr:
        "تخضع هذه الشروط لقوانين سلطنة عُمان، بما في ذلك أنظمة حماية المستهلك المعمول بها.",
    },
    {
      headingEn: "Changes to These Terms",
      headingAr: "التغييرات على هذه الشروط",
      bodyEn:
        "We may update these Terms of Use from time to time. Continued use of our website after changes means you accept the updated terms.",
      bodyAr:
        "قد نقوم بتحديث شروط الاستخدام هذه من وقت لآخر. استمراركِ في استخدام الموقع بعد أي تعديل يعني موافقتكِ على الشروط المحدثة.",
    },
    {
      headingEn: "Contact Us",
      headingAr: "تواصلي معنا",
      bodyEn: "Questions about these terms? Reach us through our Contact page or WhatsApp.",
      bodyAr: "لديكِ استفسار حول هذه الشروط؟ تواصلي معنا عبر صفحة الاتصال أو واتساب.",
    },
  ],
};

// ─────────────────────────────────────────────
// REFUND POLICY
// (Transcribed from Oman's Consumer Protection Authority – PACP –
// official Return & Exchange Policy notice, plus store-specific guidance.)
// ─────────────────────────────────────────────

export const REFUND_POLICY_KEY = "refund_policy_config";

export const DEFAULT_REFUND_POLICY: LegalPageConfig = {
  titleEn: "Return & Exchange Policy",
  titleAr: "سياسة الاستبدال والإسترجاع",
  introEn:
    "Dear Consumer, the Consumer Protection Law grants you the right to exchange or return an item and redeem its price if it is defective, according to the following, as set out by Oman's Consumer Protection Authority (PACP):",
  introAr:
    "عزيزي المستهلك، كفل قانون حماية المستهلك حق الاستبدال أو إعادة واسترداد قيمة السلعة المعيبة وفق الضوابط التالية، الصادرة عن هيئة حماية المستهلك:",
  sections: [
    {
      headingEn: "Your Rights",
      headingAr: "حقوقك",
      bodyEn:
        "- You may exchange, return, or redeem the price of an item within fifteen (15) days of receiving it.\n- This policy does not apply to rapidly perishable goods.\n- An item may be exchanged, returned, or refunded if it bears any defect, or does not meet the standard specifications or the purpose it was purchased for.\n- A valid receipt or proof of purchase from the same provider must be provided.",
      bodyAr:
        "- يمكن استبدال أو استرداد قيمة السلعة خلال فترة خمسة عشر (15) يوماً من تاريخ تسلم أي سلعة.\n- تُستثنى السلع الاستهلاكية القابلة للتلف السريع من الاستبدال والاسترجاع.\n- يتم استبدال أو إعادة واسترداد قيمة السلعة إذا شاب السلعة عيب، أو كانت غير مطابقة للمواصفات القياسية أو الغرض الذي تم الشراء من أجله.\n- يجب إبراز فاتورة الشراء أو ما يثبت شراء السلعة من نفس المزود.",
    },
    {
      headingEn: "How to Request a Return or Exchange",
      headingAr: "كيفية طلب الإرجاع أو الاستبدال",
      bodyEn:
        "- Contact us via WhatsApp or phone with your order number and photos of the item.\n- Our team will confirm eligibility and arrange pickup or drop-off through our delivery partner.\n- Once the item is inspected and confirmed eligible, we will process your exchange or refund.",
      bodyAr:
        "- تواصلي معنا عبر واتساب أو الهاتف مع ذكر رقم الطلب وإرفاق صور للمنتج.\n- سيقوم فريقنا بتأكيد الأهلية وترتيب استلام المنتج عبر شريك التوصيل.\n- بعد فحص المنتج والتأكد من استيفاء الشروط، سنقوم بمعالجة الاستبدال أو الاسترداد.",
    },
    {
      headingEn: "Refund Method & Timing",
      headingAr: "طريقة ووقت الاسترداد",
      bodyEn:
        "- Card payments made via Thawani are refunded to the original card, typically within 5–10 business days depending on your bank.\n- Cash on Delivery orders are refunded by bank transfer or store credit, as agreed with our team.\n- Shipping fees are non-refundable unless the return is due to our error (wrong or defective item).",
      bodyAr:
        "- المدفوعات بالبطاقة عبر ثواني تُسترد إلى نفس البطاقة، وعادة خلال 5 إلى 10 أيام عمل حسب البنك.\n- طلبات الدفع عند الاستلام تُسترد عبر تحويل بنكي أو رصيد في المتجر، حسب الاتفاق مع فريقنا.\n- رسوم الشحن غير قابلة للاسترداد إلا إذا كان سبب الإرجاع خطأً من جانبنا (منتج خاطئ أو معيب).",
    },
    {
      headingEn: "Consumer Protection Authority",
      headingAr: "هيئة حماية المستهلك",
      bodyEn:
        "This policy is issued in accordance with the regulations of Oman's Public Authority for Consumer Protection (PACP). If you feel your rights under this policy have not been honored, you may contact the Consumers' Line on 80079009 / 80077997, or visit www.pacp.gov.om.",
      bodyAr:
        "صدرت هذه السياسة وفق أنظمة الهيئة العامة لحماية المستهلك. إذا شعرتِ أن حقوقكِ بموجب هذه السياسة لم تُحترم، يمكنكِ التواصل مع خط المستهلك على 80079009 / 80077997، أو زيارة www.pacp.gov.om.",
    },
  ],
};

// ─────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────

export const FAQ_KEY = "faq_config";

export const DEFAULT_FAQ_CONFIG: FaqConfig = {
  titleEn: "Frequently Asked Questions",
  titleAr: "الأسئلة الشائعة",
  introEn: "Answers to the questions we hear most often. Can't find what you're looking for? Contact us anytime.",
  introAr: "إجابات على الأسئلة الأكثر شيوعاً. لم تجدي ما تبحثين عنه؟ تواصلي معنا في أي وقت.",
  items: [
    {
      questionEn: "How do I place an order?",
      questionAr: "كيف يمكنني تقديم طلب؟",
      answerEn: "Browse our collections, add items to your cart, and check out with your delivery details. You can pay by card or choose Cash on Delivery.",
      answerAr: "تصفحي تشكيلاتنا، أضيفي المنتجات إلى سلة التسوق، وأكملي الطلب بإدخال بيانات التوصيل. يمكنكِ الدفع بالبطاقة أو اختيار الدفع عند الاستلام.",
    },
    {
      questionEn: "What payment methods do you accept?",
      questionAr: "ما هي وسائل الدفع المتاحة؟",
      answerEn: "We accept secure card payments through Thawani, as well as Cash on Delivery across Oman.",
      answerAr: "نقبل الدفع الآمن بالبطاقة عبر ثواني، بالإضافة إلى الدفع عند الاستلام داخل عُمان.",
    },
    {
      questionEn: "How long does delivery take?",
      questionAr: "كم تستغرق مدة التوصيل؟",
      answerEn: "Most orders within Oman arrive within 1–3 business days depending on your region. You'll receive updates by WhatsApp once your order ships.",
      answerAr: "تصل معظم الطلبات داخل عُمان خلال 1 إلى 3 أيام عمل حسب منطقتكِ. ستصلكِ تحديثات عبر واتساب فور شحن طلبكِ.",
    },
    {
      questionEn: "Do you deliver outside Oman?",
      questionAr: "هل توصلون خارج عُمان؟",
      answerEn: "Yes, we ship to select international destinations. Shipping cost and timing are calculated at checkout based on your country.",
      answerAr: "نعم، نقوم بالشحن إلى بعض الوجهات الدولية المختارة. تُحسب تكلفة ومدة الشحن عند إتمام الطلب حسب دولتكِ.",
    },
    {
      questionEn: "Can I return or exchange an item?",
      questionAr: "هل يمكنني إرجاع أو استبدال منتج؟",
      answerEn: "Yes, items can be exchanged or returned within 15 days of delivery if they are defective or not as described. See our Refund Policy for full details.",
      answerAr: "نعم، يمكن استبدال أو إرجاع المنتجات خلال 15 يوماً من الاستلام إذا كانت معيبة أو غير مطابقة للوصف. يمكنكِ مراجعة سياسة الاسترجاع لمزيد من التفاصيل.",
    },
    {
      questionEn: "How can I track my order?",
      questionAr: "كيف يمكنني تتبع طلبي؟",
      answerEn: "You can view your order status anytime from My Account, and our team will also keep you updated by WhatsApp.",
      answerAr: "يمكنكِ متابعة حالة طلبكِ في أي وقت من صفحة حسابي، كما سيقوم فريقنا بإبقائكِ على اطلاع عبر واتساب.",
    },
    {
      questionEn: "Do you have a physical store?",
      questionAr: "هل لديكم متجر فعلي؟",
      answerEn: "We're based in Bousher, Muscat. Visit our Contact page for our address, phone number, and store hours.",
      answerAr: "نحن متواجدون في بوشر، مسقط. يمكنكِ زيارة صفحة الاتصال للاطلاع على العنوان ورقم الهاتف وساعات العمل.",
    },
    {
      questionEn: "How do I know my size?",
      questionAr: "كيف أعرف مقاسي المناسب؟",
      answerEn: "Each product page lists the available sizes. If you're unsure, message us on WhatsApp with your measurements and we'll be happy to help you choose.",
      answerAr: "تحتوي كل صفحة منتج على المقاسات المتوفرة. إذا كنتِ غير متأكدة، راسلينا على واتساب بمقاساتكِ وسنساعدكِ باختيار المقاس المناسب.",
    },
  ],
};

/** Fetch helper factory shared by the four legal-content endpoints. */
async function fetchJson<T>(url: string, fallback: T, signal?: AbortSignal): Promise<T> {
  try {
    const res = await fetch(url, { signal });
    const json = await res.json();
    return json.success ? json.data : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchFaq(signal?: AbortSignal): Promise<FaqConfig> {
  const data = await fetchJson<unknown>("/api/faq", null, signal);
  return normalizeFaq(data);
}
