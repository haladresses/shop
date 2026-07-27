"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import { fetchHero, DEFAULT_HERO_FEATURES, HeroFeatureItem } from "@/lib/hero";

const HeroFeature = () => {
  const { isArabic } = useLanguage();
  const [features, setFeatures] = useState<HeroFeatureItem[]>(DEFAULT_HERO_FEATURES);

  useEffect(() => {
    const controller = new AbortController();
    fetchHero(controller.signal)
      .then((cfg) => setFeatures(cfg.features))
      .catch(() => setFeatures(DEFAULT_HERO_FEATURES));
    return () => controller.abort();
  }, []);

  return (
    <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0 mt-6 sm:mt-8 relative z-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {features.map((item, key) => (
          <div
            key={key}
            className={`flex items-center gap-3 sm:gap-4 bg-white rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-3.5 sm:py-4 shadow-1 ring-1 ring-blue/10 ease-out duration-200 hover:shadow-2 hover:ring-blue/20 hover:-translate-y-0.5 ${
              isArabic ? "flex-row-reverse text-right" : ""
            }`}
          >
            {item.image && (
              <div className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-blue/10 flex items-center justify-center">
                <Image src={item.image} alt={isArabic ? item.titleAr : item.titleEn} width={20} height={20} className="sm:w-[22px] sm:h-[22px]" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-dark leading-tight truncate">
                {isArabic ? item.titleAr : item.titleEn}
              </h3>
              <p className="text-2xs sm:text-xs text-dark-4 mt-0.5 truncate">
                {isArabic ? item.descAr : item.descEn}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroFeature;
