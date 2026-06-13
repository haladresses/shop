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
    { nameEn: "Women's Dresses", nameAr: "فساتين نسائية", slug: "womens-dresses", sortOrder: 1 },
    { nameEn: "Girls' Dresses", nameAr: "فساتين بنات", slug: "girls-dresses", sortOrder: 2 },
    { nameEn: "Evening Wear", nameAr: "فساتين السهرة", slug: "evening-wear", sortOrder: 3 },
    { nameEn: "Baby Collection", nameAr: "ملابس المواليد", slug: "baby-collection", sortOrder: 4 },
    { nameEn: "Mom & Mini Sets", nameAr: "أطقم الأم والطفلة", slug: "mom-mini-sets", sortOrder: 5 },
    { nameEn: "Accessories", nameAr: "إكسسوارات", slug: "accessories", sortOrder: 6 },
    { nameEn: "Sale Picks", nameAr: "مختارات التخفيضات", slug: "sale-picks", sortOrder: 7 },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, isActive: true },
    });
    categories[cat.slug] = created.id;
  }

  console.log("✅ Categories created");

  // ── Products ──────────────────────────────────────────────
  const products = [
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
      variants: [
        { color: "Rose Pink", colorHex: "#FFB6C1", size: "S", stock: 10 },
        { color: "Rose Pink", colorHex: "#FFB6C1", size: "M", stock: 15 },
        { color: "Rose Pink", colorHex: "#FFB6C1", size: "L", stock: 8 },
        { color: "Sky Blue", colorHex: "#87CEEB", size: "S", stock: 5 },
        { color: "Sky Blue", colorHex: "#87CEEB", size: "M", stock: 12 },
      ],
    },
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
      variants: [
        { color: "Gold", colorHex: "#FFD700", size: "S", stock: 3 },
        { color: "Gold", colorHex: "#FFD700", size: "M", stock: 5 },
        { color: "Burgundy", colorHex: "#800020", size: "S", stock: 4 },
        { color: "Burgundy", colorHex: "#800020", size: "M", stock: 6 },
      ],
    },
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
      variants: [
        { size: "3Y", color: "Pink", colorHex: "#FF69B4", stock: 8 },
        { size: "5Y", color: "Pink", colorHex: "#FF69B4", stock: 10 },
        { size: "7Y", color: "Pink", colorHex: "#FF69B4", stock: 6 },
        { size: "3Y", color: "Lavender", colorHex: "#E6E6FA", stock: 5 },
        { size: "5Y", color: "Lavender", colorHex: "#E6E6FA", stock: 8 },
      ],
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (!existing) {
      const { variants, ...productData } = p;
      await prisma.product.create({
        data: {
          ...productData,
          isActive: true,
          sellerId: seller.id,
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
  console.log("\n✨ Database seeded successfully!");
  console.log("\n📋 Accounts:");
  console.log("   Admin:    admin@haladresses.com    / Admin@12345");
  console.log("   Seller:   seller@haladresses.com   / Seller@12345");
  console.log("   Customer: customer@haladresses.com / Customer@12345");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
