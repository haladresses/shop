export const getCategoryData = (language: "en" | "ar") => {
  const isArabic = language === "ar";

  return [
    {
      title: isArabic ? "وصل حديثاً للنساء" : "Women New In",
      id: 1,
      img: "/images/categories/categories-01.png",
    },
    {
      title: isArabic ? "تشكيلة البنات" : "Girls Collection",
      id: 2,
      img: "/images/categories/categories-02.png",
    },
    {
      title: isArabic ? "تشكيلة الأطفال" : "Baby Collection",
      id: 3,
      img: "/images/categories/categories-03.png",
    },
    {
      title: isArabic ? "ملابس المناسبات" : "Party Wear",
      id: 4,
      img: "/images/categories/categories-04.png",
    },
    {
      title: isArabic ? "الأم والطفلة" : "Mom and Mini",
      id: 5,
      img: "/images/categories/categories-05.png",
    },
    {
      title: isArabic ? "الأساسيات اليومية" : "Everyday Basics",
      id: 6,
      img: "/images/categories/categories-06.png",
    },
    {
      title: isArabic ? "الإكسسوارات" : "Accessories",
      id: 7,
      img: "/images/categories/categories-07.png",
    },
    {
      title: isArabic ? "اختيارات التخفيضات" : "Sale Picks",
      id: 8,
      img: "/images/categories/categories-04.png",
    },
  ];
};
