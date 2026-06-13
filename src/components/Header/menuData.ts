import { Menu } from "@/types/Menu";

export const getMenuData = (language: "en" | "ar"): Menu[] => {
  const isArabic = language === "ar";

  return [
    {
      id: 1,
      title: isArabic ? "الرئيسية" : "Home",
      newTab: false,
      path: "/",
    },
    {
      id: 2,
      title: isArabic ? "التشكيلات" : "Collections",
      newTab: false,
      path: "/shop",
    },
    {
      id: 3,
      title: isArabic ? "اتصل بنا" : "Contact",
      newTab: false,
      path: "/contact",
    },
    {
      id: 6,
      title: isArabic ? "حسابي" : "Client Area",
      newTab: false,
      path: "/",
      submenu: [
        {
          id: 61,
          title: isArabic ? "كل التشكيلة" : "Full Collection",
          newTab: false,
          path: "/shop",
        },
        {
          id: 62,
          title: isArabic ? "العروض الخاصة" : "Special Picks",
          newTab: false,
          path: "/shop-without-sidebar",
        },
        {
          id: 64,
          title: isArabic ? "الدفع" : "Checkout",
          newTab: false,
          path: "/checkout",
        },
        {
          id: 65,
          title: isArabic ? "سلة التسوق" : "Shopping Bag",
          newTab: false,
          path: "/cart",
        },
        {
          id: 66,
          title: isArabic ? "المفضلة" : "Wishlist",
          newTab: false,
          path: "/wishlist",
        },
        {
          id: 67,
          title: isArabic ? "تسجيل الدخول" : "Client Login",
          newTab: false,
          path: "/signin",
        },
        {
          id: 68,
          title: isArabic ? "إنشاء حساب" : "Create Account",
          newTab: false,
          path: "/signup",
        },
        {
          id: 69,
          title: isArabic ? "حسابي" : "My Account",
          newTab: false,
          path: "/my-account",
        },
        {
          id: 70,
          title: isArabic ? "اتصل بنا" : "Contact",
          newTab: false,
          path: "/contact",
        },
      ],
    },
    {
      id: 7,
      title: isArabic ? "المدونة" : "Journal",
      newTab: false,
      path: "/",
      submenu: [
        {
          id: 71,
          title: isArabic ? "المدونة مع الشريط الجانبي" : "Journal With Sidebar",
          newTab: false,
          path: "/blogs/blog-grid-with-sidebar",
        },
        {
          id: 72,
          title: isArabic ? "شبكة المدونة" : "Journal Grid",
          newTab: false,
          path: "/blogs/blog-grid",
        },
        {
          id: 73,
          title: isArabic ? "تفاصيل المقال مع الشريط" : "Journal Story With Sidebar",
          newTab: false,
          path: "/blogs/blog-details-with-sidebar",
        },
        {
          id: 74,
          title: isArabic ? "تفاصيل المقال" : "Journal Story",
          newTab: false,
          path: "/blogs/blog-details",
        },
      ],
    },
  ];
};
