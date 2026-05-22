const p = ["/images/products/p1.png", "/images/products/p2.png", "/images/products/p3.png"];

export const getCategoryData = (language: "en" | "ar") => {
  const isArabic = language === "ar";

  return [
    { id: 1, title: isArabic ? "لباس دخترانه"   : "Girls' Dresses",  img: p[0] },
    { id: 2, title: isArabic ? "لباس زنانه"      : "Women's Dresses", img: p[1] },
    { id: 3, title: isArabic ? "لباس مجلسی"      : "Evening Wear",    img: p[2] },
    { id: 4, title: isArabic ? "لباس نوزادی"     : "Baby Collection", img: p[0] },
    { id: 5, title: isArabic ? "ست مادر و دختر"  : "Mom & Mini",      img: p[1] },
    { id: 6, title: isArabic ? "اکسسوار"         : "Accessories",     img: p[2] },
    { id: 7, title: isArabic ? "تخفیف‌ها"        : "Sale Picks",      img: p[0] },
  ];
};
