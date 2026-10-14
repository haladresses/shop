"use client";

import { useEffect, useState } from "react";
import HeroView from "./HeroView";
import HeroFeature from "./HeroFeature";
import { fetchHero, HeroConfig } from "@/lib/hero";
import { useLanguage } from "@/app/context/LanguageContext";

const Hero = () => {
  const [config, setConfig] = useState<HeroConfig | null>(null);
  const { isArabic } = useLanguage();

  useEffect(() => {
    const controller = new AbortController();
    fetchHero(controller.signal).then(setConfig);
    return () => controller.abort();
  }, []);

  if (!config) {
    return (
      <section className="relative overflow-hidden pt-[88px] xl:pt-[110px] bg-[#F7F2EE]">
        <div className="max-w-[1170px] mx-auto px-4 sm:px-8 xl:px-0 min-h-[600px] lg:min-h-[680px] grid md:grid-cols-2 items-center gap-10 animate-pulse">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="h-7 w-44 rounded-full bg-white/70" />
            <div className="h-12 w-full max-w-[460px] rounded-xl bg-white/70" />
            <div className="h-12 w-3/4 max-w-[340px] rounded-xl bg-white/70" />
            <div className="h-12 w-44 rounded-full bg-white/70 mt-4" />
          </div>
          <div className="order-first md:order-last flex justify-center">
            <div className="w-[260px] sm:w-[320px] lg:w-[400px] aspect-[4/5] rounded-t-full rounded-b-[40px] bg-white/70" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <HeroView config={config} isArabic={isArabic} />
      {config.settings.showFeatures && <HeroFeature features={config.features} />}
    </>
  );
};

export default Hero;
