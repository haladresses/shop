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
