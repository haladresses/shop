"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import ProductItem from "@/components/Common/ProductItem";
import { getShopData } from "@/components/Shop/shopData";
import { fetchProducts } from "@/lib/storefront";
import { Product } from "@/types/product";
import { useLanguage } from "@/app/context/LanguageContext";

const PromoBanner = () => {
  const { language, isArabic } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({ pageSize: 3, language, signal: controller.signal })
      .then((res) => {
        const list = res.products.length ? res.products : getShopData(language);
        setProducts(list.slice(0, 3));
      })
      .catch(() => setProducts(getShopData(language).slice(0, 3)));
    return () => controller.abort();
  }, [language]);

  const copy = isArabic
    ? { eyebrow: "وصل حديثاً", title: "أحدث المنتجات", cta: "زيارة المتجر" }
    : { eyebrow: "Just In", title: "Latest Products", cta: "Visit the Shop" };

  return (
    <section className="overflow-hidden py-20">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        {/* Heading */}
        <div className={`mb-9 ${isArabic ? "text-right" : "text-left"}`}>
          <span className="block font-medium text-custom-sm text-blue mb-2">
            {copy.eyebrow}
          </span>
          <h2 className="font-bold text-2xl xl:text-heading-4 text-dark">
            {copy.title}
          </h2>
        </div>

        {/* Three latest products */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-7.5 gap-y-9">
          {products.map((item, key) => (
            <ProductItem item={item} key={key} />
          ))}
        </div>

        {/* Shop button */}
        <div className="flex justify-center mt-12">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2.5 font-medium text-custom-sm text-white bg-blue py-3 px-10 rounded-md ease-out duration-200 hover:bg-blue-dark"
          >
            {copy.cta}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={isArabic ? "rotate-180" : ""}
            >
              <path
                d="M3 8h10M8 3l5 5-5 5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
