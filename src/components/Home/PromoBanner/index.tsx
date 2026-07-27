"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/app/context/LanguageContext";

const tiles = [
  {
    image: "/images/hero/seed-promo-women.jpg",
    href: "/shop?category=womens-dresses",
    eyebrowEn: "Women's Edit",
    eyebrowAr: "تشكيلة النساء",
    titleEn: "Everyday elegance",
    titleAr: "أناقة يومية",
    ctaEn: "Shop Women",
    ctaAr: "تسوقي تشكيلة النساء",
  },
  {
    image: "/images/hero/seed-promo-girls.jpg",
    href: "/shop?category=girls-dresses",
    eyebrowEn: "Girls' Edit",
    eyebrowAr: "تشكيلة البنات",
    titleEn: "Party-ready & playful",
    titleAr: "إطلالات مرحة للمناسبات",
    ctaEn: "Shop Girls",
    ctaAr: "تسوقي تشكيلة البنات",
  },
];

const PromoBanner = () => {
  const { isArabic } = useLanguage();

  return (
    <section className="overflow-hidden py-14 sm:py-20">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7.5">
          {tiles.map((tile, key) => (
            <Link
              key={key}
              href={tile.href}
              className="group relative overflow-hidden rounded-2xl min-h-[260px] sm:min-h-[340px] xl:min-h-[400px] flex items-end"
            >
              <Image
                src={tile.image}
                alt={isArabic ? tile.titleAr : tile.titleEn}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover object-top ease-out duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-dark/10 to-transparent" />

              <div className={`relative z-10 p-6 sm:p-8 w-full ${isArabic ? "text-right" : "text-left"}`}>
                <span className="inline-block text-white/80 text-xs sm:text-sm font-medium mb-2 tracking-wide">
                  {isArabic ? tile.eyebrowAr : tile.eyebrowEn}
                </span>
                <h3 className="font-bold text-white text-xl sm:text-2xl xl:text-heading-5 mb-4">
                  {isArabic ? tile.titleAr : tile.titleEn}
                </h3>
                <span className="inline-flex items-center gap-2 font-medium text-sm text-dark bg-white rounded-full py-2.5 px-5 ease-out duration-200 group-hover:bg-blue group-hover:text-white">
                  {isArabic ? tile.ctaAr : tile.ctaEn}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`ease-out duration-200 group-hover:translate-x-1 ${isArabic ? "rotate-180 group-hover:-translate-x-1" : ""}`}
                  >
                    <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
