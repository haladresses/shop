import { StoreCategory } from "@/lib/storefront";

const p = ["/images/products/p1.png", "/images/products/p2.png", "/images/products/p3.png"];

export const getCategoryData = (language: "en" | "ar"): StoreCategory[] => {
  const isArabic = language === "ar";

  return [
    { id: "1", slug: "girls-dresses",  title: isArabic ? "لباس دخترانه"  : "Girls' Dresses",  img: p[0], products: 0 },
    { id: "2", slug: "womens-dresses", title: isArabic ? "لباس زنانه"     : "Women's Dresses", img: p[1], products: 0 },
    { id: "3", slug: "evening-wear",   title: isArabic ? "لباس مجلسی"     : "Evening Wear",    img: p[2], products: 0 },
    { id: "4", slug: "baby-collection",title: isArabic ? "لباس نوزادی"    : "Baby Collection", img: p[0], products: 0 },
    { id: "5", slug: "mom-mini",       title: isArabic ? "ست مادر و دختر" : "Mom & Mini",      img: p[1], products: 0 },
    { id: "6", slug: "accessories",    title: isArabic ? "اکسسوار"        : "Accessories",     img: p[2], products: 0 },
    { id: "7", slug: "sale-picks",     title: isArabic ? "تخفیف‌ها"       : "Sale Picks",      img: p[0], products: 0 },
  ];
};
