import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Super Admin ──────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin@12345", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@haladresses.com" },
    update: {},
    create: {
      email: "admin@haladresses.com",
      passwordHash: adminHash,
      nameEn: "Super Admin",
      nameAr: "المدير العام",
      role: Role.SUPER_ADMIN,
    },
  });

  // ── Seller ───────────────────────────────────────────────
  const sellerHash = await bcrypt.hash("Seller@12345", 12);
  const seller = await prisma.user.upsert({
    where: { email: "seller@haladresses.com" },
    update: {},
    create: {
      email: "seller@haladresses.com",
      passwordHash: sellerHash,
      nameEn: "Hala Store",
      nameAr: "متجر هلا",
      role: Role.SELLER,
      phone: "+96891000001",
    },
  });

  // ── Demo Customer ────────────────────────────────────────
  const customerHash = await bcrypt.hash("Customer@12345", 12);
  await prisma.user.upsert({
    where: { email: "customer@haladresses.com" },
    update: {},
    create: {
      email: "customer@haladresses.com",
      passwordHash: customerHash,
      nameEn: "Demo Customer",
      nameAr: "عميل تجريبي",
      role: Role.CUSTOMER,
      phone: "+96891000002",
    },
  });

  console.log("✅ Users created");

  // ── Categories ────────────────────────────────────────────
  const categoryData = [
    { nameEn: "Women's Dresses", nameAr: "فساتين نسائية", slug: "womens-dresses", sortOrder: 1, image: "/images/categories/womens-dresses.jpg" },
    { nameEn: "Girls' Dresses", nameAr: "فساتين بنات", slug: "girls-dresses", sortOrder: 2, image: "/images/categories/girls-dresses.jpg" },
    { nameEn: "Evening Wear", nameAr: "فساتين السهرة", slug: "evening-wear", sortOrder: 3, image: "/images/categories/evening-wear.jpg" },
    { nameEn: "Baby Collection", nameAr: "ملابس المواليد", slug: "baby-collection", sortOrder: 4, image: "/images/categories/baby-collection.jpg" },
    { nameEn: "Mom & Mini Sets", nameAr: "أطقم الأم والطفلة", slug: "mom-mini-sets", sortOrder: 5, image: "/images/categories/mom-mini-sets.jpg" },
    { nameEn: "Accessories", nameAr: "إكسسوارات", slug: "accessories", sortOrder: 6, image: "/images/categories/accessories.jpg" },
    { nameEn: "Sale Picks", nameAr: "مختارات التخفيضات", slug: "sale-picks", sortOrder: 7, image: "/images/categories/sale-picks.jpg" },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { image: cat.image },
      create: { ...cat, isActive: true },
    });
    categories[cat.slug] = created.id;
  }

  console.log("✅ Categories created");

  // ── Products ──────────────────────────────────────────────
  // Image files were downloaded from Unsplash and are stored locally under
  // public/images/products/ (see scratchpad/download-images.sh for sourcing).
  const products = [
    // ── Women's Dresses ──────────────────────────────────────
    {
      nameEn: "Floral Summer Dress",
      nameAr: "فستان زهري صيفي",
      slug: "floral-summer-dress",
      descriptionEn: "A beautiful floral summer dress perfect for casual outings.",
      descriptionAr: "فستان صيفي جميل مزهر مثالي للنزهات غير الرسمية.",
      categoryId: categories["womens-dresses"],
      basePrice: 12.500,
      isFeatured: true,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/floral-summer-dress-1.jpg", "/images/products/floral-summer-dress-2.jpg"],
      variants: [
        { color: "Rose Pink", colorHex: "#FFB6C1", size: "S", stock: 10 },
        { color: "Rose Pink", colorHex: "#FFB6C1", size: "M", stock: 15 },
        { color: "Rose Pink", colorHex: "#FFB6C1", size: "L", stock: 8 },
        { color: "Sky Blue", colorHex: "#87CEEB", size: "S", stock: 5 },
        { color: "Sky Blue", colorHex: "#87CEEB", size: "M", stock: 12 },
      ],
    },
    {
      nameEn: "Coastal Breeze Maxi Dress",
      nameAr: "فستان طويل نسيم الساحل",
      slug: "coastal-breeze-maxi-dress",
      descriptionEn: "A flowing maxi dress in soft dusty blue, cut for effortless movement.",
      descriptionAr: "فستان طويل انسيابي بلون أزرق ترابي ناعم، مصمم لحركة سلسة.",
      categoryId: categories["womens-dresses"],
      basePrice: 15.900,
      isFeatured: true,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/coastal-breeze-maxi-dress-1.jpg", "/images/products/coastal-breeze-maxi-dress-2.jpg"],
      variants: [
        { color: "Dusty Blue", colorHex: "#A9C4D6", size: "S", stock: 6 },
        { color: "Dusty Blue", colorHex: "#A9C4D6", size: "M", stock: 9 },
        { color: "Dusty Blue", colorHex: "#A9C4D6", size: "L", stock: 5 },
      ],
    },
    {
      nameEn: "Floral Wrap Sundress",
      nameAr: "فستان ملفوف مزهر",
      slug: "floral-wrap-sundress",
      descriptionEn: "A wrap-style sundress in a delicate floral print, finished with a tie waist.",
      descriptionAr: "فستان صيفي ملفوف بطبعة زهرية رقيقة، برباط عند الخصر.",
      categoryId: categories["womens-dresses"],
      basePrice: 13.500,
      isFeatured: false,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/floral-wrap-sundress-1.jpg", "/images/products/floral-wrap-sundress-2.jpg"],
      variants: [
        { color: "Ivory Floral", colorHex: "#F3E9DD", size: "S", stock: 7 },
        { color: "Ivory Floral", colorHex: "#F3E9DD", size: "M", stock: 10 },
        { color: "Ivory Floral", colorHex: "#F3E9DD", size: "L", stock: 4 },
      ],
    },
    {
      nameEn: "Chic Off-Shoulder Mini Dress",
      nameAr: "فستان قصير بكتف مكشوف أنيق",
      slug: "off-shoulder-mini-dress",
      descriptionEn: "A playful off-shoulder mini dress with a ruffled hem, perfect for warm evenings.",
      descriptionAr: "فستان قصير بكتف مكشوف بحاشية مكشكشة، مثالي للأمسيات الدافئة.",
      categoryId: categories["womens-dresses"],
      basePrice: 11.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: true,
      images: ["/images/products/off-shoulder-mini-dress-1.jpg", "/images/products/off-shoulder-mini-dress-2.jpg"],
      variants: [
        { color: "White", colorHex: "#FFFFFF", size: "XS", stock: 5 },
        { color: "White", colorHex: "#FFFFFF", size: "S", stock: 8 },
        { color: "White", colorHex: "#FFFFFF", size: "M", stock: 6 },
      ],
    },
    {
      nameEn: "Indigo Denim Shirt Dress",
      nameAr: "فستان قميص جينز نيلي",
      slug: "indigo-denim-shirt-dress",
      descriptionEn: "A relaxed denim shirt dress with button-through front and gathered skirt.",
      descriptionAr: "فستان قميص جينز مريح بأزرار أمامية وتنورة مجمعة.",
      categoryId: categories["womens-dresses"],
      basePrice: 14.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: false,
      images: ["/images/products/indigo-denim-shirt-dress-1.jpg", "/images/products/indigo-denim-shirt-dress-2.jpg"],
      variants: [
        { color: "Indigo", colorHex: "#4A5D7E", size: "S", stock: 8 },
        { color: "Indigo", colorHex: "#4A5D7E", size: "M", stock: 11 },
        { color: "Indigo", colorHex: "#4A5D7E", size: "L", stock: 6 },
      ],
    },
    {
      nameEn: "Camel Coat & Knit Dress Set",
      nameAr: "طقم فستان محبوك ومعطف كاميل",
      slug: "camel-coat-knit-set",
      descriptionEn: "A sophisticated knit midi dress paired with a tailored camel coat.",
      descriptionAr: "فستان محبوك متوسط الطول أنيق مع معطف كاميل مفصل.",
      categoryId: categories["womens-dresses"],
      basePrice: 24.900,
      salePrice: 19.900,
      isFeatured: true,
      isNew: false,
      isBestSeller: true,
      images: ["/images/products/camel-coat-knit-set-1.jpg", "/images/products/camel-coat-knit-set-2.jpg"],
      variants: [
        { color: "Olive Knit", colorHex: "#8A8B5C", size: "S", stock: 4 },
        { color: "Olive Knit", colorHex: "#8A8B5C", size: "M", stock: 6 },
      ],
    },
    {
      nameEn: "Noir Turtleneck & Skirt Set",
      nameAr: "طقم بلوزة رقبة عالية وتنورة أسود",
      slug: "noir-turtleneck-skirt-set",
      descriptionEn: "A polished turtleneck and midi skirt set in classic black, styled with a tie belt.",
      descriptionAr: "طقم بلوزة رقبة عالية وتنورة متوسطة باللون الأسود الكلاسيكي مع حزام.",
      categoryId: categories["womens-dresses"],
      basePrice: 17.500,
      isFeatured: false,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/noir-turtleneck-skirt-set-1.jpg", "/images/products/noir-turtleneck-skirt-set-2.jpg"],
      variants: [
        { color: "Black", colorHex: "#22201F", size: "S", stock: 5 },
        { color: "Black", colorHex: "#22201F", size: "M", stock: 7 },
        { color: "Black", colorHex: "#22201F", size: "L", stock: 3 },
      ],
    },

    // ── Evening Wear ─────────────────────────────────────────
    {
      nameEn: "Princess Evening Gown",
      nameAr: "فستان سهرة أميرة",
      slug: "princess-evening-gown",
      descriptionEn: "An elegant princess-style evening gown for special occasions.",
      descriptionAr: "فستان سهرة أنيق بأسلوب الأميرة للمناسبات الخاصة.",
      categoryId: categories["evening-wear"],
      basePrice: 28.900,
      salePrice: 22.500,
      isFeatured: true,
      isNew: false,
      isBestSeller: true,
      images: ["/images/products/princess-evening-gown-1.jpg", "/images/products/princess-evening-gown-2.jpg"],
      variants: [
        { color: "Gold", colorHex: "#FFD700", size: "S", stock: 3 },
        { color: "Gold", colorHex: "#FFD700", size: "M", stock: 5 },
        { color: "Burgundy", colorHex: "#800020", size: "S", stock: 4 },
        { color: "Burgundy", colorHex: "#800020", size: "M", stock: 6 },
      ],
    },
    {
      nameEn: "Amethyst Off-Shoulder Evening Gown",
      nameAr: "فستان سهرة جمشتي بكتف مكشوف",
      slug: "amethyst-offshoulder-gown",
      descriptionEn: "A figure-flattering off-shoulder gown in a rich amethyst hue for red-carpet moments.",
      descriptionAr: "فستان سهرة بكتف مكشوف بلون جمشتي غني يبرز القوام لمناسبات السجادة الحمراء.",
      categoryId: categories["evening-wear"],
      basePrice: 32.900,
      isFeatured: true,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/amethyst-offshoulder-gown-1.jpg", "/images/products/amethyst-offshoulder-gown-2.jpg"],
      variants: [
        { color: "Amethyst", colorHex: "#6E2C6E", size: "S", stock: 3 },
        { color: "Amethyst", colorHex: "#6E2C6E", size: "M", stock: 4 },
      ],
    },
    {
      nameEn: "Burgundy Tulle Rose Gown",
      nameAr: "فستان تول عنابي بالورود",
      slug: "burgundy-tulle-rose-gown",
      descriptionEn: "A dreamy tulle gown adorned with hand-placed floral appliqué in deep burgundy.",
      descriptionAr: "فستان تول ساحر مزين بزهور مطرزة يدوياً بلون عنابي غامق.",
      categoryId: categories["evening-wear"],
      basePrice: 36.500,
      salePrice: 29.900,
      isFeatured: true,
      isNew: false,
      isBestSeller: true,
      images: ["/images/products/burgundy-tulle-rose-gown-1.jpg", "/images/products/burgundy-tulle-rose-gown-2.jpg"],
      variants: [
        { color: "Burgundy", colorHex: "#6F2B37", size: "S", stock: 2 },
        { color: "Burgundy", colorHex: "#6F2B37", size: "M", stock: 3 },
        { color: "Burgundy", colorHex: "#6F2B37", size: "L", stock: 2 },
      ],
    },
    {
      nameEn: "Royal Embroidered Kaftan Gown",
      nameAr: "فستان قفطان مطرز ملكي",
      slug: "royal-embroidered-kaftan-gown",
      descriptionEn: "A regal, fully embroidered kaftan gown with a flowing overlay — a showstopper for Eid and weddings.",
      descriptionAr: "قفطان ملكي مطرز بالكامل بطبقة خارجية انسيابية — إطلالة مبهرة للعيد والأعراس.",
      categoryId: categories["evening-wear"],
      basePrice: 45.000,
      isFeatured: true,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/princess-evening-gown-1.jpg", "/images/products/burgundy-tulle-rose-gown-1.jpg"],
      variants: [
        { color: "Champagne Gold", colorHex: "#D9C7A3", size: "S", stock: 2 },
        { color: "Champagne Gold", colorHex: "#D9C7A3", size: "M", stock: 3 },
        { color: "Champagne Gold", colorHex: "#D9C7A3", size: "L", stock: 2 },
      ],
    },
    {
      nameEn: "Scarlet Lace Evening Dress",
      nameAr: "فستان سهرة دانتيل أحمر",
      slug: "scarlet-lace-evening-dress",
      descriptionEn: "A dramatic lace evening dress in scarlet red with delicate off-shoulder sleeves.",
      descriptionAr: "فستان سهرة دانتيل درامي بلون أحمر قرمزي بأكمام كتف مكشوفة رقيقة.",
      categoryId: categories["evening-wear"],
      basePrice: 27.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: true,
      images: ["/images/products/scarlet-lace-evening-dress-1.jpg", "/images/products/scarlet-lace-evening-dress-2.jpg"],
      variants: [
        { color: "Scarlet", colorHex: "#8C2F3B", size: "S", stock: 3 },
        { color: "Scarlet", colorHex: "#8C2F3B", size: "M", stock: 4 },
      ],
    },

    // ── Girls' Dresses ───────────────────────────────────────
    {
      nameEn: "Little Girls Birthday Dress",
      nameAr: "فستان عيد ميلاد للبنات",
      slug: "girls-birthday-dress",
      descriptionEn: "Adorable birthday dress for little girls aged 3-8 years.",
      descriptionAr: "فستان عيد ميلاد جميل للبنات الصغيرات من 3-8 سنوات.",
      categoryId: categories["girls-dresses"],
      basePrice: 8.500,
      isFeatured: false,
      isNew: true,
      isBestSeller: true,
      images: ["/images/products/girls-birthday-dress-1.jpg", "/images/products/girls-birthday-dress-2.jpg"],
      variants: [
        { size: "3Y", color: "Pink", colorHex: "#FF69B4", stock: 8 },
        { size: "5Y", color: "Pink", colorHex: "#FF69B4", stock: 10 },
        { size: "7Y", color: "Pink", colorHex: "#FF69B4", stock: 6 },
        { size: "3Y", color: "Lavender", colorHex: "#E6E6FA", stock: 5 },
        { size: "5Y", color: "Lavender", colorHex: "#E6E6FA", stock: 8 },
      ],
    },
    {
      nameEn: "Blossom Garden Dress",
      nameAr: "فستان حديقة الأزهار",
      slug: "blossom-garden-dress",
      descriptionEn: "A polka-dot cotton dress with a ruffled collar, perfect for garden parties.",
      descriptionAr: "فستان قطني منقط بياقة مكشكشة، مثالي لحفلات الحديقة.",
      categoryId: categories["girls-dresses"],
      basePrice: 7.900,
      isFeatured: true,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/blossom-garden-dress-1.jpg"],
      variants: [
        { size: "2Y", color: "White Dot", colorHex: "#F5F0E8", stock: 6 },
        { size: "4Y", color: "White Dot", colorHex: "#F5F0E8", stock: 9 },
        { size: "6Y", color: "White Dot", colorHex: "#F5F0E8", stock: 5 },
      ],
    },
    {
      nameEn: "Sunday Best Pinafore Dress",
      nameAr: "فستان بينافور الأحد الأنيق",
      slug: "sunday-best-pinafore",
      descriptionEn: "A sweet pinafore-style dress, easy to layer and perfect for family outings.",
      descriptionAr: "فستان بينافور لطيف سهل الطبقات ومثالي لنزهات العائلة.",
      categoryId: categories["girls-dresses"],
      basePrice: 6.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: false,
      images: ["/images/products/sunday-best-pinafore-1.jpg"],
      variants: [
        { size: "3Y", color: "Blush", colorHex: "#F1C6C1", stock: 7 },
        { size: "5Y", color: "Blush", colorHex: "#F1C6C1", stock: 8 },
      ],
    },

    // ── Baby Collection ──────────────────────────────────────
    {
      nameEn: "Cozy Bear Hooded Romper",
      nameAr: "بدلة نوم بقلنسوة على شكل دبدوب",
      slug: "cozy-bear-hooded-romper",
      descriptionEn: "An ultra-soft fleece romper with bear ears hood, keeps little ones warm and cute.",
      descriptionAr: "بدلة من الفليس فائقة النعومة بقلنسوة بأذني دبدوب، تحافظ على دفء الصغار بأناقة.",
      categoryId: categories["baby-collection"],
      basePrice: 6.500,
      isFeatured: true,
      isNew: true,
      isBestSeller: true,
      images: ["/images/products/cozy-bear-hooded-romper-1.jpg", "/images/products/cozy-bear-hooded-romper-2.jpg"],
      variants: [
        { size: "0-3M", color: "Taupe", colorHex: "#9C8577", stock: 10 },
        { size: "3-6M", color: "Taupe", colorHex: "#9C8577", stock: 12 },
        { size: "6-9M", color: "Taupe", colorHex: "#9C8577", stock: 6 },
      ],
    },
    {
      nameEn: "Soft Cloud Sleep Set",
      nameAr: "طقم نوم غيمة ناعمة",
      slug: "soft-cloud-sleep-set",
      descriptionEn: "A breathable cotton sleep set designed for newborn comfort, wrap-friendly.",
      descriptionAr: "طقم نوم قطني قابل للتنفس مصمم لراحة المولود، سهل اللف.",
      categoryId: categories["baby-collection"],
      basePrice: 5.900,
      isFeatured: false,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/soft-cloud-sleep-set-1.jpg", "/images/products/soft-cloud-sleep-set-2.jpg"],
      variants: [
        { size: "Newborn", color: "Ivory", colorHex: "#F7F3EC", stock: 14 },
        { size: "0-3M", color: "Ivory", colorHex: "#F7F3EC", stock: 10 },
      ],
    },
    {
      nameEn: "Sunny Days Swim Romper",
      nameAr: "بدلة سباحة أيام مشمسة",
      slug: "sunny-days-swim-romper",
      descriptionEn: "A UV-protective swim romper for pool days, quick-dry and comfortable.",
      descriptionAr: "بدلة سباحة واقية من الأشعة فوق البنفسجية لأيام المسبح، سريعة الجفاف ومريحة.",
      categoryId: categories["baby-collection"],
      basePrice: 5.500,
      isFeatured: false,
      isNew: false,
      isBestSeller: false,
      images: ["/images/products/sunny-days-swim-romper-1.jpg"],
      variants: [
        { size: "6-12M", color: "Aqua", colorHex: "#8FD0D8", stock: 8 },
        { size: "12-18M", color: "Aqua", colorHex: "#8FD0D8", stock: 6 },
      ],
    },

    // ── Mom & Mini Sets ──────────────────────────────────────
    {
      nameEn: "Matching Floral Mom & Me Set",
      nameAr: "طقم مطابق للأم والابنة مزهر",
      slug: "matching-floral-mom-me-set",
      descriptionEn: "Coordinated floral dresses for mother and daughter — perfect for family photos.",
      descriptionAr: "فستانان مزهران متناسقان للأم والابنة — مثاليان لصور العائلة.",
      categoryId: categories["mom-mini-sets"],
      basePrice: 21.900,
      isFeatured: true,
      isNew: true,
      isBestSeller: true,
      images: ["/images/products/matching-floral-mom-me-set-1.jpg", "/images/products/matching-floral-mom-me-set-2.jpg"],
      variants: [
        { color: "Ivory Floral", colorHex: "#F3E9DD", size: "Mom-M", stock: 4 },
        { color: "Ivory Floral", colorHex: "#F3E9DD", size: "Mini-5Y", stock: 4 },
      ],
    },
    {
      nameEn: "Coordinated Burgundy Duo Set",
      nameAr: "طقم عنابي متناسق للثنائي",
      slug: "coordinated-burgundy-duo-set",
      descriptionEn: "Elegant burgundy midi dresses for mother and daughter, perfect for Eid gatherings.",
      descriptionAr: "فستانان متوسطا الطول بلون عنابي أنيق للأم والابنة، مثاليان للقاءات العيد.",
      categoryId: categories["mom-mini-sets"],
      basePrice: 24.900,
      salePrice: 19.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: true,
      images: ["/images/products/coordinated-burgundy-duo-set-1.jpg", "/images/products/coordinated-burgundy-duo-set-2.jpg"],
      variants: [
        { color: "Burgundy", colorHex: "#6F2B37", size: "Mom-S", stock: 3 },
        { color: "Burgundy", colorHex: "#6F2B37", size: "Mini-4Y", stock: 3 },
      ],
    },

    // ── Accessories ──────────────────────────────────────────
    {
      nameEn: "Sunset Leather Handbag",
      nameAr: "حقيبة يد جلدية بلون الغروب",
      slug: "sunset-leather-handbag",
      descriptionEn: "A structured leather handbag in a warm terracotta tone with gold-tone hardware.",
      descriptionAr: "حقيبة يد جلدية بتصميم مهيكل بلون طوبي دافئ مع تفاصيل معدنية ذهبية.",
      categoryId: categories["accessories"],
      basePrice: 18.900,
      isFeatured: true,
      isNew: true,
      isBestSeller: false,
      images: ["/images/products/sunset-leather-handbag-1.jpg"],
      variants: [{ color: "Terracotta", colorHex: "#C1502E", stock: 6 }],
    },
    {
      nameEn: "Golden Chain Bracelet Set",
      nameAr: "طقم أساور سلسلة ذهبية",
      slug: "golden-chain-bracelet-set",
      descriptionEn: "A layered set of gold-tone chain bracelets and rings for everyday elegance.",
      descriptionAr: "طقم متعدد الطبقات من الأساور والخواتم بلون ذهبي لإطلالة يومية أنيقة.",
      categoryId: categories["accessories"],
      basePrice: 7.500,
      isFeatured: false,
      isNew: true,
      isBestSeller: true,
      images: ["/images/products/golden-chain-bracelet-set-1.jpg"],
      variants: [{ color: "Gold", colorHex: "#D4AF37", stock: 15 }],
    },
    {
      nameEn: "Pearl Drop Necklace",
      nameAr: "قلادة بحبة لؤلؤ متدلية",
      slug: "pearl-drop-necklace",
      descriptionEn: "A dainty gold-plated necklace with a single freshwater pearl drop.",
      descriptionAr: "قلادة رقيقة مطلية بالذهب مع حبة لؤلؤ طبيعي متدلية.",
      categoryId: categories["accessories"],
      basePrice: 9.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: false,
      images: ["/images/products/pearl-drop-necklace-1.jpg"],
      variants: [{ color: "Gold/Pearl", colorHex: "#E8DCC8", stock: 10 }],
    },
    {
      nameEn: "Everyday Essentials Clutch Set",
      nameAr: "طقم حقيبة يد وإكسسوارات أساسية",
      slug: "everyday-essentials-clutch-set",
      descriptionEn: "A curated set: quilted clutch, sunglasses and a watch, styled for everyday luxury.",
      descriptionAr: "طقم منسق: حقيبة مبطنة ونظارة شمسية وساعة، لإطلالة يومية فاخرة.",
      categoryId: categories["accessories"],
      basePrice: 22.500,
      isFeatured: true,
      isNew: false,
      isBestSeller: false,
      images: ["/images/products/everyday-essentials-clutch-1.jpg"],
      variants: [{ color: "Black", colorHex: "#1E1E1E", stock: 5 }],
    },

    // ── Sale Picks ───────────────────────────────────────────
    {
      nameEn: "Clearance Rack Favorite Dress",
      nameAr: "فستان مفضل من ركن التخفيضات",
      slug: "clearance-rack-favorite-dress",
      descriptionEn: "A limited-stock boutique favorite, now marked down for a limited time.",
      descriptionAr: "قطعة مفضلة بكمية محدودة من المتجر، بسعر مخفض لفترة محدودة.",
      categoryId: categories["sale-picks"],
      basePrice: 16.900,
      salePrice: 9.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: true,
      images: ["/images/products/clearance-rack-favorite-1.jpg"],
      variants: [
        { color: "Assorted", colorHex: "#C9A9A6", size: "S", stock: 4 },
        { color: "Assorted", colorHex: "#C9A9A6", size: "M", stock: 3 },
      ],
    },
    {
      nameEn: "End of Season Wrap Dress",
      nameAr: "فستان ملفوف نهاية الموسم",
      slug: "end-of-season-wrap-dress",
      descriptionEn: "A versatile wrap dress from last season's collection, priced to move.",
      descriptionAr: "فستان ملفوف متعدد الاستخدامات من تشكيلة الموسم الماضي، بسعر مغرٍ.",
      categoryId: categories["sale-picks"],
      basePrice: 13.900,
      salePrice: 7.900,
      isFeatured: false,
      isNew: false,
      isBestSeller: false,
      images: ["/images/products/end-of-season-wrap-dress-1.jpg"],
      variants: [
        { color: "Multi", colorHex: "#B79A75", size: "S", stock: 3 },
        { color: "Multi", colorHex: "#B79A75", size: "M", stock: 5 },
      ],
    },
    {
      nameEn: "Last Chance Evening Dress",
      nameAr: "فستان سهرة الفرصة الأخيرة",
      slug: "last-chance-evening-dress",
      descriptionEn: "A statement evening dress from a previous collection, deeply discounted.",
      descriptionAr: "فستان سهرة مميز من تشكيلة سابقة، بخصم كبير.",
      categoryId: categories["sale-picks"],
      basePrice: 32.900,
      salePrice: 18.500,
      isFeatured: false,
      isNew: false,
      isBestSeller: false,
      images: ["/images/products/last-chance-evening-dress-1.jpg"],
      variants: [{ color: "Merlot", colorHex: "#5C2A3A", size: "M", stock: 2 }],
    },
  ];

  for (const p of products) {
    const { variants, images, ...productData } = p;
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (!existing) {
      await prisma.product.create({
        data: {
          ...productData,
          isActive: true,
          sellerId: seller.id,
          images: {
            create: images.map((url, i) => ({ url, isPrimary: i === 0, sortOrder: i })),
          },
          variants: {
            create: variants.map((v) => ({
              color: v.color,
              colorHex: v.colorHex,
              size: v.size,
              isActive: true,
              inventory: {
                create: { quantity: v.stock, lowStockAlert: 3 },
              },
            })),
          },
        },
      });
    } else {
      const imageCount = await prisma.productImage.count({ where: { productId: existing.id } });
      if (imageCount === 0 && images.length > 0) {
        await prisma.productImage.createMany({
          data: images.map((url, i) => ({ productId: existing.id, url, isPrimary: i === 0, sortOrder: i })),
        });
      }
    }
  }

  console.log("✅ Products created");

  // ── Coupons ───────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      type: "PERCENTAGE",
      value: 10,
      minOrder: 5,
      maxUses: 100,
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: "SAVE2" },
    update: {},
    create: {
      code: "SAVE2",
      type: "FIXED",
      value: 2.0,
      minOrder: 10,
      isActive: true,
    },
  });

  console.log("✅ Coupons created");

  // ── Default Settings ──────────────────────────────────────
  const settings = [
    { key: "store_name_en", value: "Hala Dresses", group: "general", labelEn: "Store Name (EN)" },
    { key: "store_name_ar", value: "هلا دريسز", group: "general", labelEn: "Store Name (AR)" },
    { key: "store_email", value: "info@haladresses.com", group: "general", labelEn: "Store Email" },
    { key: "store_phone", value: "+968 9000 0000", group: "general", labelEn: "Store Phone" },
    { key: "store_address", value: "Muscat, Sultanate of Oman", group: "general", labelEn: "Address" },
    { key: "currency", value: "OMR", group: "general", labelEn: "Currency" },
    { key: "free_shipping_min", value: "10", group: "shipping", labelEn: "Free Shipping Minimum (OMR)" },
    { key: "default_shipping_cost", value: "1.500", group: "shipping", labelEn: "Default Shipping Cost (OMR)" },
    { key: "allow_guest_checkout", value: "true", group: "checkout", labelEn: "Allow Guest Checkout" },
    { key: "tax_rate", value: "5", group: "general", labelEn: "Tax Rate (%)" },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { ...s, type: "string" },
    });
  }

  console.log("✅ Settings created");

  // ── Wasellee Branches ───────────────────────────────────────
  // Domestic prices are placeholders (Wasellee hasn't published a
  // per-city rate card yet) — adjust per branch in /admin/shipping.
  const PLACEHOLDER_HOME_COST = 1.5;
  const PLACEHOLDER_OFFICE_COST = 1.0;

  const MUSCAT = { regionEn: "Muscat", regionAr: "مسقط" };
  const BATINAH = { regionEn: "Al Batinah (North & South)", regionAr: "الباطنة (شمال وجنوب)" };
  const SHARQIYAH = { regionEn: "Ash Sharqiyah (North & South)", regionAr: "الشرقية (شمال وجنوب)" };
  const DAKHILIYAH = { regionEn: "Ad Dakhiliyah", regionAr: "الداخلية" };
  const OTHER = { regionEn: "Other Governorates", regionAr: "محافظات أخرى" };

  const waselleeBranches: {
    cityEn: string;
    cityAr: string;
    phone: string;
    region: { regionEn: string; regionAr: string };
  }[] = [
    // Muscat
    { cityEn: "Bousher", cityAr: "بوشر", phone: "74186126", region: MUSCAT },
    { cityEn: "Quriyat", cityAr: "قريات", phone: "72424835", region: MUSCAT },
    { cityEn: "Al Ma'abilah", cityAr: "المعبيلة", phone: "94659939", region: MUSCAT },
    { cityEn: "Al Amerat", cityAr: "العامرات", phone: "98228572", region: MUSCAT },
    { cityEn: "Al Khoudh", cityAr: "الخوض", phone: "93331927", region: MUSCAT },
    { cityEn: "Muttrah", cityAr: "مطرح", phone: "90404433", region: MUSCAT },
    { cityEn: "Seeb", cityAr: "السيب", phone: "77583399", region: MUSCAT },
    // Al Batinah
    { cityEn: "Suwaiq", cityAr: "السويق", phone: "94477843", region: BATINAH },
    { cityEn: "Saham", cityAr: "صحم", phone: "77852028", region: BATINAH },
    { cityEn: "Sohar", cityAr: "صحار", phone: "95468558", region: BATINAH },
    { cityEn: "Rustaq", cityAr: "الرستاق", phone: "78643653", region: BATINAH },
    { cityEn: "Khabourah", cityAr: "الخابورة", phone: "76730188", region: BATINAH },
    { cityEn: "Barka", cityAr: "بركاء", phone: "79002525", region: BATINAH },
    { cityEn: "Nakhal", cityAr: "نخل", phone: "97807544", region: BATINAH },
    { cityEn: "Musanaah", cityAr: "المصنعة", phone: "96544099", region: BATINAH },
    { cityEn: "Shinas", cityAr: "شناص", phone: "95431899", region: BATINAH },
    { cityEn: "Liwa", cityAr: "لوى", phone: "77274403", region: BATINAH },
    // Ash Sharqiyah
    { cityEn: "Sur", cityAr: "صور", phone: "79281891", region: SHARQIYAH },
    { cityEn: "Ja'alan", cityAr: "جعلان", phone: "79229101", region: SHARQIYAH },
    { cityEn: "Sinaw", cityAr: "سناو", phone: "77585229", region: SHARQIYAH },
    { cityEn: "Ibra", cityAr: "إبراء", phone: "94887296", region: SHARQIYAH },
    { cityEn: "Bidiyah", cityAr: "بدية", phone: "98032383", region: SHARQIYAH },
    { cityEn: "Samad Al Shan", cityAr: "سمد الشأن", phone: "79048666", region: SHARQIYAH },
    // Ad Dakhiliyah
    { cityEn: "Nizwa 1", cityAr: "نزوى 1", phone: "79053354", region: DAKHILIYAH },
    { cityEn: "Nizwa 2", cityAr: "نزوى 2", phone: "92200503", region: DAKHILIYAH },
    { cityEn: "Bahla", cityAr: "بهلاء", phone: "98030789", region: DAKHILIYAH },
    { cityEn: "Izki", cityAr: "إزكي", phone: "92640891", region: DAKHILIYAH },
    { cityEn: "Samail", cityAr: "سمائل", phone: "93264694", region: DAKHILIYAH },
    { cityEn: "Adam", cityAr: "آدم", phone: "72424833", region: DAKHILIYAH },
    { cityEn: "Fanja", cityAr: "فنجاء", phone: "92640851", region: DAKHILIYAH },
    { cityEn: "Manah", cityAr: "منح", phone: "77313218", region: DAKHILIYAH },
    { cityEn: "Al Hamra", cityAr: "الحمراء", phone: "77417415", region: DAKHILIYAH },
    // Other governorates
    { cityEn: "Al Buraimi", cityAr: "البريمي", phone: "99224159", region: OTHER },
    { cityEn: "Salalah (Dhofar)", cityAr: "صلالة (ظفار)", phone: "92000746", region: OTHER },
    { cityEn: "Khasab (Musandam)", cityAr: "خصب (مسندم)", phone: "91211378", region: OTHER },
    { cityEn: "Ibri (Al Dhahirah)", cityAr: "عبري (الظاهرة)", phone: "78475114", region: OTHER },
    { cityEn: "Yanqul (Al Dhahirah)", cityAr: "ينقل (الظاهرة)", phone: "91275987", region: OTHER },
  ];

  for (let i = 0; i < waselleeBranches.length; i++) {
    const b = waselleeBranches[i];
    const existing = await prisma.waselleeBranch.findFirst({ where: { cityEn: b.cityEn } });
    if (!existing) {
      await prisma.waselleeBranch.create({
        data: {
          cityEn: b.cityEn,
          cityAr: b.cityAr,
          phone: b.phone,
          regionEn: b.region.regionEn,
          regionAr: b.region.regionAr,
          homeDeliveryCost: PLACEHOLDER_HOME_COST,
          officePickupCost: PLACEHOLDER_OFFICE_COST,
          isActive: true,
          sortOrder: i,
        },
      });
    }
  }

  console.log(`✅ Wasellee branches created (${waselleeBranches.length})`);

  // ── Wasellee International Rates ───────────────────────────
  // Currency wasn't confirmed by Wasellee (OMR assumed) — verify in admin.
  const waselleeRates = [
    { countryEn: "Saudi Arabia", countryAr: "المملكة العربية السعودية", countryCode: "SA", baseWeightKg: 1, baseCost: 4.5, additionalKgCost: 2.5 },
    { countryEn: "Bahrain", countryAr: "البحرين", countryCode: "BH", baseWeightKg: 1, baseCost: 5.0, additionalKgCost: 3.0 },
    { countryEn: "Kuwait", countryAr: "الكويت", countryCode: "KW", baseWeightKg: 1, baseCost: 5.0, additionalKgCost: 3.0 },
    { countryEn: "Qatar", countryAr: "قطر", countryCode: "QA", baseWeightKg: 1, baseCost: 5.0, additionalKgCost: 3.0 },
    { countryEn: "United Arab Emirates", countryAr: "الإمارات العربية المتحدة", countryCode: "AE", baseWeightKg: 4, baseCost: 5.0, additionalKgCost: 0.5 },
  ];

  for (let i = 0; i < waselleeRates.length; i++) {
    const r = waselleeRates[i];
    await prisma.waselleeInternationalRate.upsert({
      where: { countryCode: r.countryCode },
      update: {},
      create: { ...r, isActive: true, sortOrder: i },
    });
  }

  console.log("✅ Wasellee international rates created");

  // ── Wasellee Settings (WhatsApp/WAHA + contact info) ────────
  const existingWaselleeSettings = await prisma.waselleeSettings.findFirst();
  if (!existingWaselleeSettings) {
    await prisma.waselleeSettings.create({
      data: {
        companyNameEn: "Wasellee",
        companyNameAr: "وصلي",
        brandNameEn: "LO Express",
        website: "www.wasellee.om",
        instagram: "@wlo.express",
        bousherOfficePhone: "74186126",
        bousherContactPhone: "76977795",
        bousherDriverPhone: "94700211",
        isNotifyEnabled: false, // enable once WAHA base URL/API key are set in /admin/shipping
      },
    });
  }

  console.log("✅ Wasellee settings created");
  console.log("\n✨ Database seeded successfully!");
  console.log("\n📋 Accounts:");
  console.log("   Admin:    admin@haladresses.com    / Admin@12345");
  console.log("   Seller:   seller@haladresses.com   / Seller@12345");
  console.log("   Customer: customer@haladresses.com / Customer@12345");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
