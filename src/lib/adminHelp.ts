export type AdminHelpLevel = "Core" | "Advanced" | "Sensitive";

export type AdminHelpTopic = {
  title: string;
  href: string;
  permission: string;
  category: "Operations" | "Catalog" | "Content" | "Platform";
  level: AdminHelpLevel;
  summary: string;
  /** Short keyword chips used for search and quick scanning. */
  tags: string[];
  outcomes: string[];
  guidance: string[];
  /** Ordered, do-this-then-that workflow for the most common task. */
  steps: string[];
  /** Common mistakes and risky actions to avoid. */
  cautions: string[];
  /** Hrefs of related admin sections that pair well with this one. */
  related: string[];
};

export type AdminHelpQuickStart = {
  title: string;
  description: string;
  href: string;
  steps: string[];
};

export type AdminHelpFaq = {
  question: string;
  answer: string;
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
    level: "Core",
    tags: ["KPIs", "triage", "trends", "alerts"],
    steps: [
      "Open the dashboard at the start of each shift.",
      "Scan the sales, orders, and customer trend tiles for anomalies.",
      "Check pending orders and low-stock alerts.",
      "Click into the affected order or product to take action.",
    ],
    cautions: [
      "Numbers here are a summary — never edit catalog data straight from a trend spike.",
      "A metric that looks off is usually a payment or stock sync delay, not bad data.",
    ],
    related: ["/admin/orders", "/admin/inventory"],
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
    level: "Core",
    tags: ["lifecycle", "fulfillment", "refunds", "shipping"],
    steps: [
      "Search the order by number, customer name, or phone.",
      "Verify payment status and review the line items.",
      "Confirm the shipping address and selected method.",
      "Advance the status only when payment and shipment are both confirmed.",
    ],
    cautions: [
      "Never mark an order delivered before payment has cleared.",
      "Double-check guest order contact details before any dispatch action.",
    ],
    related: ["/admin/payments", "/admin/shipping", "/admin/users"],
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
    level: "Sensitive",
    tags: ["Thawani", "refunds", "gateway", "API keys"],
    steps: [
      "Locate the payment record from the related order.",
      "Confirm the state: paid, unpaid, failed, or refunded.",
      "Trigger a supported refund only after operational approval.",
      "For gateway config, set the mode first, then paste matching keys.",
    ],
    cautions: [
      "Gateway keys are secrets — restrict changes to payment managers.",
      "Never mix UAT and production credentials in the same configuration.",
    ],
    related: ["/admin/orders", "/admin/settings"],
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
    level: "Sensitive",
    tags: ["Wasellee", "branches", "rates", "checkout"],
    steps: [
      "Open the shipping configuration screen.",
      "Edit branch availability and delivery costs.",
      "Update international rate cards where required.",
      "Save, then re-run a test checkout to confirm the calculations.",
    ],
    cautions: [
      "Rate and branch edits change live checkout totals — verify before saving.",
      "Treat Wasellee credentials as secrets, not ordinary settings.",
    ],
    related: ["/admin/orders", "/admin/settings"],
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
    level: "Core",
    tags: ["discounts", "campaigns", "limits", "expiry"],
    steps: [
      "Create a coupon with a clear, memorable code.",
      "Choose a fixed or percentage discount.",
      "Set the order threshold, expiry date, and usage cap.",
      "Review the active list before the campaign goes live.",
    ],
    cautions: [
      "Model the financial impact of large discounts before activating.",
      "Avoid overlapping codes that can stack in unexpected ways.",
    ],
    related: ["/admin/orders", "/admin/promo-banner"],
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
    level: "Sensitive",
    tags: ["accounts", "roles", "RBAC", "access"],
    steps: [
      "Search for the existing account or create a new one.",
      "Set the profile and contact details.",
      "Assign the role that matches their responsibilities.",
      "Deactivate rather than delete when in doubt.",
    ],
    cautions: [
      "Role changes take effect immediately across menus and protected APIs.",
      "Prefer deactivation over deletion for accounts still referenced by orders.",
    ],
    related: ["/admin/roles"],
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
    level: "Core",
    tags: ["catalog", "media", "variants", "attributes"],
    steps: [
      "Create a new product or open an existing one.",
      "Fill in the title, pricing, SKU, and images.",
      "Configure variants and the category-specific attributes.",
      "Publish only after every field has been verified.",
    ],
    cautions: [
      "Changing the category can shift required attributes — re-check them.",
      "Do not publish a product with missing images or inventory.",
    ],
    related: ["/admin/categories", "/admin/inventory", "/admin/reviews"],
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
    level: "Core",
    tags: ["taxonomy", "attributes", "navigation", "filters"],
    steps: [
      "Build the parent and child category trees.",
      "Define attributes such as material, color, or size.",
      "Set the sort order and visibility for each node.",
      "Confirm products map to the correct categories.",
    ],
    cautions: [
      "Do not delete categories with products or children without a migration plan.",
      "Keep attribute keys stable once products depend on them.",
    ],
    related: ["/admin/products", "/admin/navigation"],
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
    level: "Core",
    tags: ["stock", "variants", "low-stock", "adjustments"],
    steps: [
      "Find the product and open its variant list.",
      "Confirm you are editing the correct size and color.",
      "Record the adjustment with a clear business reason.",
      "Cross-check the resulting availability on the product page.",
    ],
    cautions: [
      "Most stock errors come from editing the wrong variant.",
      "Every correction should carry an auditable reason.",
    ],
    related: ["/admin/products"],
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
    level: "Core",
    tags: ["moderation", "trust", "spam", "quality"],
    steps: [
      "Open the pending review queue.",
      "Read each review against the moderation policy.",
      "Approve or reject it consistently.",
      "Route genuine product issues to catalog or operations.",
    ],
    cautions: [
      "Inconsistent moderation erodes trust in the review system.",
      "Hiding a review does not fix the underlying product problem.",
    ],
    related: ["/admin/products"],
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
    level: "Core",
    tags: ["homepage", "campaign", "imagery", "CTA"],
    steps: [
      "Open the homepage hero editor.",
      "Update the headline, call to action, and imagery.",
      "Preview the result on both mobile and desktop.",
      "Coordinate timing with the promo and countdown modules.",
    ],
    cautions: [
      "Keep copy short so the hero stays readable on mobile.",
      "Re-check image cropping after any major design change.",
    ],
    related: ["/admin/promo-banner", "/admin/countdown"],
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
    level: "Core",
    tags: ["banner", "offers", "announcements", "campaign"],
    steps: [
      "Open the promo banner editor.",
      "Write concise, single-focus offer messaging.",
      "Publish and confirm the placement on the storefront.",
      "Schedule its replacement or removal.",
    ],
    cautions: [
      "Long copy competes with the rest of the page for attention.",
      "Confirm expiry timing with the campaign owner.",
    ],
    related: ["/admin/hero", "/admin/coupons"],
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
    level: "Core",
    tags: ["urgency", "timer", "seasonal", "conversion"],
    steps: [
      "Open the countdown deal configuration.",
      "Set the offer details and the target end time.",
      "Verify the timezone before saving.",
      "Pair it with matching product emphasis on the homepage.",
    ],
    cautions: [
      "Always confirm the end time in the intended timezone.",
      "Remove expired countdowns promptly to protect trust.",
    ],
    related: ["/admin/hero", "/admin/promo-banner"],
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
    level: "Core",
    tags: ["social-proof", "trust", "content", "ordering"],
    steps: [
      "Open testimonials management.",
      "Add or edit the quote, attribution, and display order.",
      "Check localization if both language fields are used.",
      "Save and preview the result on the storefront.",
    ],
    cautions: [
      "Keep testimonials believable and clearly attributable.",
      "Review translation quality before publishing.",
    ],
    related: ["/admin/hero"],
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
    level: "Core",
    tags: ["subscribers", "capture", "audience", "export"],
    steps: [
      "Open the newsletter dashboard.",
      "Review subscriber lists and acquisition activity.",
      "Export audiences carefully when required.",
      "Confirm capture is working on the storefront.",
    ],
    cautions: [
      "Subscriber data is customer data — handle exports carefully.",
      "Keep cleanup deliberate so reporting stays meaningful.",
    ],
    related: ["/admin/settings"],
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
    level: "Sensitive",
    tags: ["policies", "terms", "compliance", "refunds"],
    steps: [
      "Open the legal page you need to change.",
      "Edit the policy, terms, or disclosure text.",
      "Align the wording with real payment, shipping, and return behavior.",
      "Publish after a business-owner review.",
    ],
    cautions: [
      "Coordinate legal wording with decision-makers before publishing.",
      "Revisit refund and privacy policies whenever operations change.",
    ],
    related: ["/admin/settings", "/admin/payments"],
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
    level: "Core",
    tags: ["header", "footer", "links", "merchandising"],
    steps: [
      "Open the navigation menu editor.",
      "Add, reorder, or remove links.",
      "Verify each destination exists and is visible.",
      "Keep the top level focused on priorities.",
    ],
    cautions: [
      "Broken links damage navigation trust — test every destination.",
      "Avoid overloading the top level with competing options.",
    ],
    related: ["/admin/categories"],
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
    level: "Sensitive",
    tags: ["store-wide", "contact", "footer", "backup"],
    steps: [
      "Open store settings.",
      "Update contact, checkout, or footer values.",
      "Review the broad impact of the change.",
      "Save, then spot-check the affected pages.",
    ],
    cautions: [
      "Store-wide settings can change many pages at once.",
      "Use Payments and Shipping for secret integration configuration.",
    ],
    related: ["/admin/payments", "/admin/shipping"],
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
    level: "Sensitive",
    tags: ["RBAC", "access", "delegation", "audit"],
    steps: [
      "Open Roles & Permissions.",
      "Select the role you want to adjust.",
      "Open or restrict specific sections and actions.",
      "Audit the effective access before finishing.",
    ],
    cautions: [
      "Permission changes apply immediately to protected areas.",
      "Design access against real workflows, not assumptions.",
    ],
    related: ["/admin/users", "/admin/help"],
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
    level: "Core",
    tags: ["onboarding", "guidance", "permissions", "reference"],
    steps: [
      "Open the Help Center.",
      "Search or filter to the section you need.",
      "Follow its steps, guidance, and cautions.",
      "Pair it with Roles & Permissions when designing roles.",
    ],
    cautions: [
      "A missing section usually means the role lacks permission.",
      "Use alongside Roles & Permissions to shape each role's experience.",
    ],
    related: ["/admin/roles"],
  },
];

export const ADMIN_HELP_QUICK_START: AdminHelpQuickStart[] = [
  {
    title: "Onboard a new operator",
    description: "Give a new team member a safe, focused start on their first day.",
    href: "/admin",
    steps: [
      "Create their account under Users and assign the right role.",
      "Confirm they only see the sections their role allows.",
      "Point them to the Dashboard for daily triage.",
      "Ask them to read the guides for each section they own.",
    ],
  },
  {
    title: "Process an order end to end",
    description: "Take an order from placement to delivery without slips.",
    href: "/admin/orders",
    steps: [
      "Verify the payment has cleared under Payments.",
      "Confirm the shipping address and method.",
      "Dispatch and update the shipping status.",
      "Mark delivered only once payment and shipment are confirmed.",
    ],
  },
  {
    title: "Launch a homepage campaign",
    description: "Coordinate the storefront surfaces for a promotion.",
    href: "/admin/hero",
    steps: [
      "Update the Homepage Hero with the campaign message.",
      "Add a Promo Banner for the supporting offer.",
      "Schedule a Countdown Deal for urgency.",
      "Create matching Coupons and verify the discount math.",
    ],
  },
  {
    title: "Publish a new product",
    description: "Add a product that is complete and correctly categorized.",
    href: "/admin/products",
    steps: [
      "Confirm the category and its attributes exist.",
      "Create the product with images, pricing, and SKU.",
      "Set variant inventory under Inventory.",
      "Publish only after every field is verified.",
    ],
  },
];

export const ADMIN_HELP_FAQ: AdminHelpFaq[] = [
  {
    question: "Why can't I see a section that a colleague can?",
    answer:
      "The Help Center and the admin menu are filtered by permission. If a section is missing, your role does not currently have access to it. Ask an administrator to review your role under Roles & Permissions.",
  },
  {
    question: "Do permission changes take effect immediately?",
    answer:
      "Yes. Once a role is updated under Roles & Permissions, the change applies right away to menus, pages, and protected APIs. Refresh the page to see the updated navigation.",
  },
  {
    question: "Where do I change payment or shipping credentials?",
    answer:
      "Sensitive integration keys live in the dedicated Payments and Shipping sections, not in general Settings. Only users with the matching management permission should edit them, and UAT and production keys must never be mixed.",
  },
  {
    question: "How should I remove a user who has left?",
    answer:
      "Prefer deactivation over deletion when the account may still be referenced by past orders or operational records. Deletion is only safe when nothing depends on the account.",
  },
  {
    question: "What is the difference between the guidance and cautions on a guide?",
    answer:
      "Guidance describes the recommended way to operate a section. Cautions call out the common mistakes and risky actions that cause the most support issues, so review both before acting.",
  },
  {
    question: "Can I edit the storefront without a code deployment?",
    answer:
      "Yes. Content surfaces such as the Hero, Promo Banner, Countdown, Testimonials, Navigation, and Legal Pages are all editable from the admin without releasing new code.",
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