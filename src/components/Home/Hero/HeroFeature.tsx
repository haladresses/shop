"use client";

import Image from "next/image";
import { useLanguage } from "@/app/context/LanguageContext";
import { HeroFeatureItem } from "@/lib/hero";

// Trust badges under the hero. Layout is direction-agnostic (the page `dir`
// mirrors it); on phones the cards scroll sideways instead of squashing.
const HeroFeature = ({ features }: { features: HeroFeatureItem[] }) => {
  const { isArabic } = useLanguage();
  if (features.length === 0) return null;

  return (
    <div className="relative z-10 -mt-6 sm:-mt-8 mb-4">
      <div className="max-w-[1170px] mx-auto px-4 sm:px-8 xl:px-0">
        <div className="flex lg:grid lg:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
          {features.map((item, key) => (
            <div
              key={key}
              data-reveal
              style={{ ["--reveal-delay" as string]: `${key * 80}ms` }}
              className="snap-start shrink-0 w-[78%] xsm:w-[62%] sm:w-[44%] lg:w-auto flex items-center gap-3.5 bg-white/90 backdrop-blur rounded-2xl px-4 sm:px-5 py-4 shadow-[0_18px_40px_-24px_rgba(47,36,31,0.35)] ring-1 ring-blue/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(47,36,31,0.45)]"
            >
              {item.image && (
                <div className="shrink-0 w-11 h-11 rounded-xl bg-blue/10 flex items-center justify-center">
                  <Image src={item.image} alt="" width={22} height={22} />
                </div>
              )}
              <div className="min-w-0 text-start">
                <h3 className="font-semibold text-sm text-dark leading-tight truncate">{isArabic ? item.titleAr || item.titleEn : item.titleEn}</h3>
                <p className="text-xs text-dark-4 mt-0.5 truncate">{isArabic ? item.descAr || item.descEn : item.descEn}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroFeature;
