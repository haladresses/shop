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
    <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0 mt-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((item, key) => (
          <div
            key={key}
            className={`flex items-center gap-4 bg-white rounded-xl px-5 py-4 shadow-sm ${isArabic ? "flex-row-reverse text-right" : ""}`}
          >
            {item.image && (
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#F7EDE7] flex items-center justify-center">
                <Image src={item.image} alt={isArabic ? item.titleAr : item.titleEn} width={22} height={22} />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-sm text-dark leading-tight">{isArabic ? item.titleAr : item.titleEn}</h3>
              <p className="text-xs text-dark-4 mt-0.5">{isArabic ? item.descAr : item.descEn}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroFeature;
