"use client";
import React, { useEffect, useState } from "react";
import SingleItem from "./SingleItem";
import Image from "next/image";
import Link from "next/link";
import { getShopData } from "@/components/Shop/shopData";
import { fetchProducts } from "@/lib/storefront";
import { Product } from "@/types/product";
import { useLanguage } from "@/app/context/LanguageContext";

const BestSeller = () => {
  const { language, isArabic } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({ pageSize: 6, language, signal: controller.signal })
      .then((res) => {
        setProducts(res.products.length ? res.products : getShopData(language));
      })
      .catch(() => setProducts(getShopData(language)));
    return () => controller.abort();
  }, [language]);

  const copy = isArabic
    ? { eyebrow: "هذا الشهر", title: "الأكثر مبيعاً", viewAll: "عرض الكل" }
    : { eyebrow: "This Month", title: "Best Sellers", viewAll: "View All" };

  return (
    <section className="overflow-hidden">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className={`mb-10 flex items-center justify-between ${isArabic ? "flex-row-reverse" : ""}`}>
          <div className={isArabic ? "text-right" : ""}>
            <span className={`flex items-center gap-2.5 font-medium text-dark mb-1.5 ${isArabic ? "flex-row-reverse" : ""}`}>
              <Image
                src="/images/icons/icon-07.svg"
                alt="icon"
                width={17}
                height={17}
              />
              {copy.eyebrow}
            </span>
            <h2 className="font-semibold text-xl xl:text-heading-5 text-dark">
              {copy.title}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7.5">
          {products.map((item, key) => (
            <SingleItem item={item} key={key} />
          ))}
        </div>

        <div className="text-center mt-12.5">
          <Link
            href="/shop-without-sidebar"
            className="inline-flex font-medium text-custom-sm py-3 px-7 sm:px-12.5 rounded-md border-gray-3 border bg-gray-1 text-dark ease-out duration-200 hover:bg-dark hover:text-white hover:border-transparent"
          >
            {copy.viewAll}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BestSeller;
