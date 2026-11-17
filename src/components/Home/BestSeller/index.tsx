"use client";
import React, { useEffect, useState } from "react";
import ProductItem from "@/components/Common/ProductItem";
import { getShopData } from "@/components/Shop/shopData";
import { fetchProducts, fullRows } from "@/lib/storefront";
import SectionHeading from "@/components/Common/SectionHeading";
import { Product } from "@/types/product";
import { useLanguage } from "@/app/context/LanguageContext";

const BestSeller = () => {
  const { language, isArabic } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({ pageSize: 8, language, isBestSeller: true, signal: controller.signal })
      .then((res) => {
        if (res.products.length >= 4) {
          setProducts(fullRows(res.products));
          return;
        }
        return fetchProducts({ pageSize: 8, language, sort: "bestseller", signal: controller.signal }).then((all) =>
          setProducts(fullRows(all.products.length ? all.products : getShopData(language)))
        );
      })
      .catch(() => setProducts(getShopData(language)));
    return () => controller.abort();
  }, [language]);

  const copy = isArabic
    ? { eyebrow: "هذا الشهر", title: "الأكثر مبيعاً", viewAll: "عرض الكل" }
    : { eyebrow: "This Month", title: "Best Sellers", viewAll: "View All" };

  return (
    <section className="overflow-hidden py-14 sm:py-20">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} href="/shop?sort=bestseller" linkLabel={copy.viewAll} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-10">
          {products.map((item, key) => (
            <ProductItem item={item} key={key} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BestSeller;
