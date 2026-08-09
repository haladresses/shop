export type AdminHelpTopic = {
  title: string;
  href: string;
  permission: string;
  category: "Operations" | "Catalog" | "Content" | "Platform";
  summary: string;
  outcomes: string[];
  guidance: string[];
};

export type AdminHelpTopicArabic = {
  title: string;
  summary: string;
  outcomes: string[];
  guidance: string[];
};

export const ADMIN_HELP_TOPICS: AdminHelpTopic[] = [
  {
    title: "Dashboard",
    href: "/admin",
    permission: "admin.dashboard.view",
    category: "Operations",
    summary: "Monitor core KPIs, order movement, low stock alerts, and top-selling products from one operational overview.",
    outcomes: [
      "Review sales, customer, and order trends at the start of the day.",
      "Spot pending orders and inventory pressure before they become support issues.",
      "Use recent orders and top products to decide what needs follow-up.",
    ],
    guidance: [
      "Treat the dashboard as a triage surface, not the place to do the actual edits.",
      "If numbers look wrong, verify order payment status and stock movements before changing catalog data.",
    ],
  },
  {
    title: "Orders",
    href: "/admin/orders",
    permission: "admin.orders.view",
    category: "Operations",
    summary: "Track the full order lifecycle, customer details, payment state, and shipping follow-up actions.",
    outcomes: [
      "Search and inspect order details, line items, payments, and shipping method.",
      "Coordinate operational actions such as confirmations, delivery updates, and payment review.",
      "Use order-level tools for Thawani refund and Wasellee notification flows where allowed.",
    ],
    guidance: [
      "Only move orders to delivered after payment and shipment state are both confirmed.",
      "For guest orders, verify the shipping address and contact number before dispatch actions.",
    ],
  },
  {
    title: "Payments",
    href: "/admin/payments",
    permission: "admin.payments.view",
    category: "Operations",
    summary: "Review payment activity, refund Thawani transactions, and manage the stored payment gateway configuration.",
    outcomes: [
      "Inspect payment records tied to orders and identify unpaid, paid, failed, and refunded states.",
      "Trigger supported refund flows for Thawani payments where operationally required.",
      "Configure Thawani mode and API keys directly from admin instead of relying on `.env`.",
    ],
    guidance: [
      "Gateway settings are sensitive; only users with payment management permission should change them.",
      "When switching between UAT and production, confirm the publishable and secret keys belong to the same environment.",
    ],
  },
  {
    title: "Shipping",
    href: "/admin/shipping",
    permission: "admin.shipping.view",
    category: "Operations",
    summary: "Maintain delivery rules, Wasellee configuration, domestic branches, and international shipping rates.",
    outcomes: [
      "Edit shipping costs and branch availability used during checkout.",
      "Configure Wasellee operational settings without touching environment files.",
      "Maintain international rate cards for non-standard shipping flows.",
    ],
    guidance: [
      "Branch and rate changes directly affect checkout calculations, so verify before saving.",
      "Operational messaging credentials should be treated as secrets and changed only by trusted admins.",
    ],
  },
  {
    title: "Coupons",
    href: "/admin/coupons",
    permission: "admin.coupons.view",
    category: "Operations",
    summary: "Create and supervise discount campaigns with rules around amount, validity, and usage limits.",
    outcomes: [
      "Set fixed or percentage discounts.",
      "Control order thresholds, expiry rules, and maximum redemptions.",
      "Review active coupon inventory before campaigns go live.",
    ],
    guidance: [
      "Validate the economic impact of large discounts before activation.",
      "Use clear naming conventions for coupon codes so support staff can identify campaigns quickly.",
    ],
  },
  {
    title: "Users",
    href: "/admin/users",
    permission: "admin.users.view",
    category: "Operations",
    summary: "Manage customer, staff, seller, and admin accounts including access role assignment where permitted.",
    outcomes: [
      "Create internal accounts for operations teams and sellers.",
      "Activate, deactivate, or update user profile data.",
      "Assign roles so the RBAC matrix controls what each person can see and do.",
    ],
    guidance: [
      "Changing a role has immediate impact across menus, pages, and protected APIs.",
      "Use deactivation instead of deletion when the account may still be referenced operationally.",
    ],
  },
  {
    title: "Products",
    href: "/admin/products",
    permission: "admin.products.view",
    category: "Catalog",
    summary: "Create, update, and organize products, their media, seller ownership, and structured attributes.",
    outcomes: [
      "Maintain titles, pricing, images, variants, and status flags such as featured or bestseller.",
      "Assign sellers where the business model requires seller-owned catalog management.",
      "Keep attributes aligned with the selected category so filters and product detail blocks stay correct.",
    ],
    guidance: [
      "Publish only after images, pricing, SKU structure, and inventory have all been checked.",
      "When changing category, review attributes immediately because category-specific fields can shift.",
    ],
  },
  {
    title: "Categories",
    href: "/admin/categories",
    permission: "admin.categories.view",
    category: "Catalog",
    summary: "Manage category structure and define the dynamic product specifications required for each category.",
    outcomes: [
      "Build parent and child category trees for storefront navigation and filtering.",
      "Define category attributes such as material, color, fit, or dimensions for structured product data.",
      "Control sort order and active visibility for merchandising.",
    ],
    guidance: [
      "Do not delete categories that still contain products or child categories without a migration plan.",
      "Keep attribute keys stable once products depend on them.",
    ],
  },
  {
    title: "Inventory",
    href: "/admin/inventory",
    permission: "admin.inventory.view",
    category: "Catalog",
    summary: "Inspect stock levels, variant quantities, low-stock pressure, and inventory movements.",
    outcomes: [
      "Track sellable quantity by variant instead of relying on product-level assumptions.",
      "Record operational stock changes when items are received, damaged, or manually adjusted.",
      "Use this area together with products to keep catalog availability accurate.",
    ],
    guidance: [
      "Inventory corrections should follow a business reason so future audits stay understandable.",
      "Always verify the variant you are editing; many product issues come from adjusting the wrong size or color.",
    ],
  },
  {
    title: "Reviews",
    href: "/admin/reviews",
    permission: "admin.reviews.view",
    category: "Catalog",
    summary: "Moderate customer reviews to keep storefront trust signals accurate and appropriate.",
    outcomes: [
      "Approve or reject submitted reviews.",
      "Keep product pages free of spam, abuse, or irrelevant content.",
      "Monitor review volume for products that need support or quality follow-up.",
    ],
    guidance: [
      "Moderation should follow a consistent policy so review trust is not undermined.",
      "If a review indicates a product issue, route it to catalog or operations instead of only hiding it.",
    ],
  },
  {
    title: "Homepage Hero",
    href: "/admin/hero",
    permission: "admin.hero.manage",
    category: "Content",
    summary: "Control the lead visual and messaging block on the storefront homepage.",
    outcomes: [
      "Update messaging, calls to action, and supporting imagery for campaigns.",
      "Refresh seasonal storefront presentation without code deployment.",
      "Coordinate hero content with promo and countdown modules for consistent merchandising.",
    ],
    guidance: [
      "Keep copy concise and outcome-driven so the hero remains readable on mobile.",
      "Check image crop behavior after major design changes.",
    ],
  },
  {
    title: "Promo Banner",
    href: "/admin/promo-banner",
    permission: "admin.promo.manage",
    category: "Content",
    summary: "Manage short promotional messaging that supports campaigns across the storefront.",
    outcomes: [
      "Publish limited-time offer banners without editing code.",
      "Coordinate support messages like free shipping or event promos.",
      "Quickly rotate merchandising focus during campaigns.",
    ],
    guidance: [
      "Use concise copy because this area competes with the rest of the page for attention.",
      "Confirm expiry or replacement timing with the campaign owner.",
    ],
  },
  {
    title: "Countdown Deal",
    href: "/admin/countdown",
    permission: "admin.countdown.manage",
    category: "Content",
    summary: "Schedule urgency-based merchandising with a configurable countdown offer block.",
    outcomes: [
      "Launch time-bound campaigns without redeploying the site.",
      "Pair offer details with matching product emphasis.",
      "Create seasonal urgency for homepage conversion lifts.",
    ],
    guidance: [
      "Always verify the target end time in the intended timezone.",
      "Remove expired messaging promptly to avoid trust issues.",
    ],
  },
  {
    title: "Testimonials",
    href: "/admin/testimonials",
    permission: "admin.testimonials.manage",
    category: "Content",
    summary: "Curate trust-building testimonial content shown on the storefront.",
    outcomes: [
      "Maintain social proof content and its ordering.",
      "Update copy and attribution to reflect current branding or campaigns.",
      "Support conversion-focused landing experiences with controlled testimonials.",
    ],
    guidance: [
      "Keep testimonials believable and attributable.",
      "Review localization quality if both language fields are used.",
    ],
  },
  {
    title: "Newsletter",
    href: "/admin/newsletter",
    permission: "admin.newsletter.view",
    category: "Content",
    summary: "Review newsletter capture activity and maintain related configuration.",
    outcomes: [
      "Inspect subscriber lists and acquisition activity.",
      "Coordinate audience export or messaging operations where applicable.",
      "Monitor whether newsletter capture is functioning as expected.",
    ],
    guidance: [
      "Treat subscriber data as customer data and handle exports carefully.",
      "Operational cleanup should be deliberate so reporting remains meaningful.",
    ],
  },
  {
    title: "Legal Pages",
    href: "/admin/legal-pages",
    permission: "admin.legal.manage",
    category: "Platform",
    summary: "Maintain policy, terms, refund, and legal disclosure content used by customers and compliance workflows.",
    outcomes: [
      "Update policy text without requiring a code release.",
      "Keep storefront legal content aligned with payment, shipping, and return behavior.",
      "Support market or partner requirements with editable legal copy.",
    ],
    guidance: [
      "Coordinate legal wording changes with business owners before publishing.",
      "When store operations change, revisit refund and privacy policies immediately.",
    ],
  },
  {
    title: "Navigation Menu",
    href: "/admin/navigation",
    permission: "admin.navigation.manage",
    category: "Platform",
    summary: "Control header and footer navigation structure exposed to storefront visitors.",
    outcomes: [
      "Promote seasonal destinations or category clusters.",
      "Clean up broken or outdated navigation targets.",
      "Align navigation structure with merchandising priorities.",
    ],
    guidance: [
      "After changing links, verify the destination pages exist and are visible.",
      "Avoid overloading top-level navigation with too many competing options.",
    ],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    permission: "admin.settings.manage",
    category: "Platform",
    summary: "Manage store-wide operational settings such as contact, shipping, checkout, footer, and backup preferences.",
    outcomes: [
      "Update contact and commercial settings used across the site.",
      "Maintain footer and backup behavior from one controlled area.",
      "Keep operational defaults aligned with current business rules.",
    ],
    guidance: [
      "Store-wide settings can affect multiple pages at once, so verify broad impact before saving.",
      "Use the dedicated Payments and Shipping sections for secret or integration-specific configuration.",
    ],
  },
  {
    title: "Roles & Permissions",
    href: "/admin/roles",
    permission: "admin.roles.view",
    category: "Platform",
    summary: "Control which roles can access each admin or seller section, including operational actions and configuration screens.",
    outcomes: [
      "Open or restrict menus, pages, and APIs by business role.",
      "Delegate daily operations without handing out full platform control.",
      "Audit what each built-in role can really do across the application.",
    ],
    guidance: [
      "Permission changes take effect immediately for protected areas.",
      "Review Help topics and real workflows together when designing new access patterns.",
    ],
  },
  {
    title: "Help Center",
    href: "/admin/help",
    permission: "admin.help.view",
    category: "Platform",
    summary: "See a permission-filtered explanation of the admin system so each operator only sees guidance for what they can access.",
    outcomes: [
      "Onboard new staff without exposing irrelevant or unauthorized features.",
      "Give each role a focused explanation of the screens visible to them.",
      "Reduce operator errors by documenting intent and safe operating patterns.",
    ],
    guidance: [
      "If a section is missing here, the role likely does not have permission to open it.",
      "Use this page together with Roles & Permissions to design role-specific admin experiences.",
    ],
  },
];

export const ADMIN_HELP_ARABIC: Record<string, AdminHelpTopicArabic> = {
  "/admin": {
    title: "لوحة التحكم",
    summary: "راقب مؤشرات الأداء الأساسية وحركة الطلبات وتنبيهات المخزون والمنتجات الأكثر مبيعاً من نظرة تشغيلية واحدة.",
    outcomes: [
      "مراجعة اتجاهات المبيعات والعملاء والطلبات في بداية اليوم.",
      "اكتشاف الطلبات المعلقة وضغط المخزون قبل أن تتحول إلى مشاكل دعم.",
      "استخدام أحدث الطلبات وأفضل المنتجات لتحديد أولويات المتابعة.",
    ],
    guidance: [
      "اعتبر لوحة التحكم مساحة متابعة سريعة وليست مكان تنفيذ التعديلات نفسها.",
      "إذا بدت الأرقام غير منطقية، راجع حالة الدفع وحركة المخزون قبل تعديل بيانات الكتالوج.",
    ],
  },
  "/admin/orders": {
    title: "الطلبات",
    summary: "تابع دورة الطلب كاملة بما فيها بيانات العميل وحالة الدفع وإجراءات الشحن والمتابعة التشغيلية.",
    outcomes: [
      "البحث في الطلبات وفحص التفاصيل والعناصر ووسيلة الدفع وطريقة الشحن.",
      "تنسيق الإجراءات التشغيلية مثل التأكيد والتحديثات اللوجستية ومراجعة الدفع.",
      "استخدام أدوات الاسترداد وإشعارات Wasellee على مستوى الطلب عند توفر الصلاحية.",
    ],
    guidance: [
      "لا تنقل الطلب إلى حالة التسليم إلا بعد تأكيد الدفع وحالة الشحن معاً.",
      "في طلبات الضيوف، تحقق من العنوان ورقم الهاتف قبل أي إجراء إرسال.",
    ],
  },
  "/admin/products": {
    title: "المنتجات",
    summary: "أنشئ المنتجات وعدلها ونظم الصور والمتغيرات وملكية البائع والخصائص المنظمة لكل منتج.",
    outcomes: [
      "إدارة العناوين والأسعار والصور والمتغيرات وحالات الظهور مثل المميز والأكثر مبيعاً.",
      "ربط المنتجات بالبائعين عند الحاجة إلى إدارة كتالوج خاصة بالبائع.",
      "الحفاظ على توافق الخصائص مع الفئة المختارة حتى تبقى الفلاتر وصفحات المنتج صحيحة.",
    ],
    guidance: [
      "لا تنشر المنتج قبل مراجعة الصور والسعر والرمز والمخزون.",
      "عند تغيير الفئة، راجع الخصائص مباشرة لأن متطلبات الفئة قد تختلف.",
    ],
  },
  "/admin/categories": {
    title: "الفئات",
    summary: "أدر هيكل الفئات وحدد المواصفات الديناميكية المطلوبة لكل فئة من فئات المنتجات.",
    outcomes: [
      "بناء شجرة فئات رئيسية وفرعية للتنقل والتصفية في المتجر.",
      "تعريف خصائص الفئات مثل الخامة واللون والمقاس والأبعاد كبيانات منظمة.",
      "التحكم في الترتيب وحالة التفعيل لأغراض العرض التجاري.",
    ],
    guidance: [
      "لا تحذف فئة تحتوي على منتجات أو فئات فرعية بدون خطة نقل واضحة.",
      "حافظ على ثبات مفاتيح الخصائص بمجرد اعتماد المنتجات عليها.",
    ],
  },
  "/admin/inventory": {
    title: "المخزون",
    summary: "افحص مستويات المخزون وكميات المتغيرات وتنبيهات النقص وحركات المخزون التشغيلية.",
    outcomes: [
      "تتبع الكمية القابلة للبيع على مستوى المتغير بدلاً من الاعتماد على تقديرات عامة.",
      "تسجيل التعديلات التشغيلية عند الاستلام أو التلف أو التسوية اليدوية.",
      "استخدام هذا القسم مع المنتجات للحفاظ على دقة التوفر في المتجر.",
    ],
    guidance: [
      "يجب أن يكون لكل تعديل مخزني سبب واضح حتى تبقى المراجعة المستقبلية مفهومة.",
      "تأكد دائماً من أنك تعدل المتغير الصحيح من حيث اللون أو المقاس.",
    ],
  },
  "/admin/users": {
    title: "المستخدمون",
    summary: "أدر حسابات العملاء والموظفين والبائعين والإداريين بما في ذلك تعيين الأدوار عند توفر الصلاحية.",
    outcomes: [
      "إنشاء حسابات داخلية للعمليات والبائعين.",
      "تفعيل الحسابات أو تعطيلها أو تحديث بيانات الملف الشخصي.",
      "تعيين الأدوار بحيث تتحكم مصفوفة الصلاحيات في ما يمكن لكل شخص رؤيته وتنفيذه.",
    ],
    guidance: [
      "تغيير الدور يؤثر فوراً على القوائم والصفحات وواجهات API المحمية.",
      "استخدم التعطيل بدلاً من الحذف عندما يكون للحساب ارتباطات تشغيلية قائمة.",
    ],
  },
  "/admin/payments": {
    title: "المدفوعات",
    summary: "راجع نشاط المدفوعات واسترداد عمليات Thawani وأدر إعدادات بوابة الدفع المخزنة داخل النظام.",
    outcomes: [
      "فحص سجلات المدفوعات المرتبطة بالطلبات وحالاتها المختلفة.",
      "تنفيذ عمليات الاسترداد المدعومة لمدفوعات Thawani عند الحاجة التشغيلية.",
      "ضبط وضع Thawani ومفاتيح API من داخل لوحة الإدارة بدلاً من `.env`.",
    ],
    guidance: [
      "إعدادات البوابة حساسة ولا يجب تعديلها إلا من أصحاب صلاحية إدارة المدفوعات.",
      "عند التبديل بين UAT والإنتاج، تأكد من أن المفتاحين يخصان البيئة نفسها.",
    ],
  },
  "/admin/coupons": {
    title: "الكوبونات",
    summary: "أنشئ حملات الخصم وتابع قواعدها المتعلقة بالقيمة والصلاحية وحدود الاستخدام.",
    outcomes: [
      "ضبط خصومات ثابتة أو نسبية.",
      "التحكم في الحد الأدنى للطلب وتواريخ الانتهاء وعدد مرات الاستخدام.",
      "مراجعة حالة القسائم النشطة قبل إطلاق الحملات.",
    ],
    guidance: [
      "راجع الأثر المالي للخصومات الكبيرة قبل التفعيل.",
      "استخدم تسمية واضحة للكوبونات حتى يتمكن فريق الدعم من تمييز الحملات بسرعة.",
    ],
  },
  "/admin/shipping": {
    title: "الشحن",
    summary: "أدر قواعد التوصيل وإعدادات Wasellee والفروع المحلية وأسعار الشحن الدولي.",
    outcomes: [
      "تعديل تكاليف الشحن وتوفر الفروع المستخدمة أثناء الدفع.",
      "إدارة إعدادات Wasellee التشغيلية بدون تعديل ملفات البيئة.",
      "الحفاظ على بطاقات الأسعار الدولية للحالات غير القياسية.",
    ],
    guidance: [
      "تغييرات الفروع والأسعار تؤثر مباشرة على حسابات الدفع، لذلك تحقق منها قبل الحفظ.",
      "يجب التعامل مع بيانات الرسائل التشغيلية والمفاتيح باعتبارها أسراراً.",
    ],
  },
  "/admin/reviews": {
    title: "التقييمات",
    summary: "راجع تقييمات العملاء وأدر الإشراف عليها للحفاظ على مصداقية المحتوى في المتجر.",
    outcomes: [
      "قبول أو رفض التقييمات المرسلة.",
      "منع الرسائل المزعجة أو المحتوى غير المناسب من الظهور على صفحات المنتجات.",
      "مراقبة التقييمات التي تشير إلى مشاكل جودة أو دعم.",
    ],
    guidance: [
      "يجب أن تكون سياسات الإشراف ثابتة حتى لا تتضرر الثقة في التقييمات.",
      "إذا كشف التقييم مشكلة حقيقية في المنتج، وجّهها للعمليات أو الكتالوج بدلاً من إخفائها فقط.",
    ],
  },
  "/admin/hero": {
    title: "الواجهة الرئيسية",
    summary: "تحكم في البلوك البصري والرسالة الرئيسية أعلى الصفحة الأولى للمتجر.",
    outcomes: [
      "تحديث الرسائل والعروض والصور الداعمة للحملات.",
      "تجديد مظهر المتجر موسميًا بدون نشر كود جديد.",
      "تنسيق محتوى الواجهة مع البانر والعروض المؤقتة.",
    ],
    guidance: [
      "حافظ على النص قصيراً وواضحاً خاصة على الجوال.",
      "راجع قص الصور بعد أي تعديل بصري كبير.",
    ],
  },
  "/admin/promo-banner": {
    title: "بانر العروض",
    summary: "أدر رسائل العروض القصيرة التي تدعم الحملات التسويقية عبر المتجر.",
    outcomes: [
      "نشر بانرات العروض محدودة الوقت بدون تعديل الكود.",
      "إبراز رسائل مثل الشحن المجاني أو الحملات الموسمية.",
      "تغيير تركيز العرض التجاري بسرعة خلال المواسم.",
    ],
    guidance: [
      "استخدم نصاً مختصراً لأن هذا الجزء ينافس عناصر الصفحة الأخرى على الانتباه.",
      "راجع توقيت انتهاء الحملة أو استبدالها مع مسؤولها.",
    ],
  },
  "/admin/countdown": {
    title: "عرض العد التنازلي",
    summary: "شغل حملات العروض المؤقتة باستخدام قسم عد تنازلي قابل للإدارة.",
    outcomes: [
      "إطلاق عروض مرتبطة بوقت بدون إعادة نشر التطبيق.",
      "ربط تفاصيل العرض بمنتجات مستهدفة بشكل متناسق.",
      "خلق إحساس بالإلحاح لرفع التحويلات في الصفحة الرئيسية.",
    ],
    guidance: [
      "تحقق دائماً من وقت الانتهاء في المنطقة الزمنية الصحيحة.",
      "أزل الرسائل المنتهية بسرعة حتى لا تتأثر الثقة.",
    ],
  },
  "/admin/testimonials": {
    title: "الشهادات",
    summary: "نسّق محتوى الشهادات الاجتماعية التي تُعرض في المتجر لدعم الثقة والتحويل.",
    outcomes: [
      "الحفاظ على ترتيب ومحتوى الشهادات الاجتماعية.",
      "تحديث النصوص ونِسبتها لتتوافق مع الحملات أو الهوية الحالية.",
      "دعم صفحات البيع بمحتوى موثوق ومتحكم به.",
    ],
    guidance: [
      "حافظ على واقعية الشهادات ووضوح نسبتها.",
      "راجع جودة الترجمة إذا تم استخدام اللغتين.",
    ],
  },
  "/admin/newsletter": {
    title: "النشرة البريدية",
    summary: "راجع نشاط الاشتراك في النشرة البريدية وأدر الإعدادات المرتبطة بها.",
    outcomes: [
      "فحص قوائم المشتركين ونشاط الاكتساب.",
      "تنسيق عمليات التصدير أو الرسائل عند الحاجة.",
      "متابعة ما إذا كان التقاط الاشتراكات يعمل كما هو متوقع.",
    ],
    guidance: [
      "تعامل مع بيانات المشتركين كبيانات عملاء واحرص عند التصدير.",
      "يجب أن تكون عمليات التنظيف أو الحذف مدروسة حتى تبقى التقارير مفيدة.",
    ],
  },
  "/admin/legal-pages": {
    title: "الصفحات القانونية",
    summary: "أدر السياسات والشروط وصفحات الإفصاح القانونية المستخدمة مع العملاء والامتثال.",
    outcomes: [
      "تحديث النصوص القانونية بدون إطلاق نسخة برمجية جديدة.",
      "مواءمة المحتوى القانوني مع أسلوب الدفع والشحن والإرجاع الفعلي.",
      "دعم متطلبات السوق أو الشركاء بنصوص قابلة للتعديل.",
    ],
    guidance: [
      "نسّق أي تعديل قانوني مع أصحاب القرار قبل النشر.",
      "عند تغيّر السياسات التشغيلية، راجع الخصوصية والاسترجاع مباشرة.",
    ],
  },
  "/admin/navigation": {
    title: "قائمة التنقل",
    summary: "تحكم في بنية القوائم العلوية والسفلية المعروضة لزوار المتجر.",
    outcomes: [
      "إبراز وجهات موسمية أو مجموعات فئات مهمة.",
      "تنظيف الروابط القديمة أو المكسورة.",
      "مواءمة التنقل مع أولويات العرض التجاري.",
    ],
    guidance: [
      "بعد تعديل الروابط، تأكد من أن الصفحات المستهدفة موجودة ومرئية.",
      "لا تكدّس القائمة العليا بعدد كبير من الخيارات المتنافسة.",
    ],
  },
  "/admin/settings": {
    title: "الإعدادات",
    summary: "أدر إعدادات المتجر العامة مثل معلومات التواصل والشحن والدفع والتذييل والنسخ الاحتياطي.",
    outcomes: [
      "تحديث البيانات التجارية والتشغيلية المستخدمة عبر المتجر.",
      "إدارة إعدادات التذييل والنسخ الاحتياطي من مكان واحد.",
      "الحفاظ على توافق الإعدادات الافتراضية مع قواعد العمل الحالية.",
    ],
    guidance: [
      "إعدادات المتجر العامة قد تؤثر على عدة صفحات دفعة واحدة، لذا تحقق من الأثر قبل الحفظ.",
      "استخدم أقسام Payments وShipping للإعدادات الحساسة أو الخاصة بالتكاملات.",
    ],
  },
  "/admin/roles": {
    title: "الأدوار والصلاحيات",
    summary: "تحكم في ما يمكن لكل دور الوصول إليه داخل الإدارة أو بوابة البائع، بما في ذلك الصفحات والإجراءات والواجهات المحمية.",
    outcomes: [
      "فتح أو تقييد القوائم والصفحات وواجهات API حسب الدور الوظيفي.",
      "تفويض العمليات اليومية بدون منح صلاحيات كاملة للنظام.",
      "مراجعة ما يمكن لكل دور مدمج فعله فعلاً داخل التطبيق.",
    ],
    guidance: [
      "تغييرات الصلاحيات تُطبّق فوراً على المناطق المحمية.",
      "راجع Help وسير العمل الفعلي معاً عند تصميم أنماط وصول جديدة.",
    ],
  },
  "/admin/help": {
    title: "مركز المساعدة",
    summary: "اعرض شرحاً مفلترًا بالصلاحيات لنظام الإدارة حتى يرى كل مشغل فقط الإرشادات الخاصة بما يمكنه الوصول إليه.",
    outcomes: [
      "تدريب الموظفين الجدد بدون كشف مزايا غير مصرح بها.",
      "تقديم شرح مركز لكل دور عن الشاشات المتاحة له.",
      "تقليل الأخطاء التشغيلية من خلال توثيق الهدف وطريقة العمل الآمنة.",
    ],
    guidance: [
      "إذا غاب قسم من هذه الصفحة، فغالباً لا يملك الدور صلاحية الوصول إليه.",
      "استخدم هذه الصفحة مع Roles & Permissions لبناء تجربة إدارية مناسبة لكل دور.",
    ],
  },
};