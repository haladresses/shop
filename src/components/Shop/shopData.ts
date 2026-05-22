import { Product } from "@/types/product";

const p = ["/images/products/p1.png", "/images/products/p2.png", "/images/products/p3.png"];

export const getShopData = (language: "en" | "ar"): Product[] => {
  const isArabic = language === "ar";
  return [
    {
      title: isArabic ? "فستان كاجوال منقوش للبنات" : "Girls Floral Casual Dress",
      reviews: 12,
      price: 18.5,
      discountedPrice: 14.9,
      id: 1,
      imgs: {
        thumbnails: [p[0], p[1]],
        previews: [p[0], p[1]],
      },
    },
    {
      title: isArabic ? "فستان ماكسي مطرز للسيدات" : "Women's Embroidered Maxi Dress",
      reviews: 8,
      price: 35.0,
      discountedPrice: 28.5,
      id: 2,
      imgs: {
        thumbnails: [p[1], p[2]],
        previews: [p[1], p[2]],
      },
    },
    {
      title: isArabic ? "فستان سهرة ساتان للبنات" : "Girls Satin Party Dress",
      reviews: 20,
      price: 22.5,
      discountedPrice: 18.0,
      id: 3,
      imgs: {
        thumbnails: [p[2], p[0]],
        previews: [p[2], p[0]],
      },
    },
  ];
};

const shopData = getShopData("en");
export default shopData;
