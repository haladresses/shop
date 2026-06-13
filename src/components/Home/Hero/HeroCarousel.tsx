"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import { fetchHero, DEFAULT_HERO_SLIDES, HeroSlide } from "@/lib/hero";
import Image from "next/image";

import "swiper/css/pagination";
import "swiper/css";

const HeroCarousal = () => {
  const { language, isArabic } = useLanguage();
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_HERO_SLIDES);

  useEffect(() => {
    const controller = new AbortController();
    fetchHero(controller.signal)
      .then((cfg) => setSlides(cfg.slides))
      .catch(() => setSlides(DEFAULT_HERO_SLIDES));
    return () => controller.abort();
  }, []);

  return (
    <Swiper
      key={`${language}-${slides.length}`}
      dir={isArabic ? "rtl" : "ltr"}
      spaceBetween={0}
      centeredSlides={true}
      autoplay={{ delay: 4000, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      modules={[Autoplay, Pagination]}
      className="hero-carousel"
    >
      {slides.map((slide, index) => {
        const badge = isArabic ? slide.badgeAr : slide.badgeEn;
        const title = isArabic ? slide.titleAr : slide.titleEn;
        const cta = isArabic ? slide.ctaAr : slide.ctaEn;
        return (
          <SwiperSlide key={index}>
            <div className="flex items-center min-h-[420px] px-8 sm:px-12 lg:px-16 py-12 gap-10">

              {/* Text */}
              <div className={`flex-1 ${isArabic ? "text-right order-2" : ""}`}>
                {badge && (
                  <span className="inline-flex rounded-full bg-blue/10 px-4 py-1.5 text-sm font-medium text-blue mb-5">
                    {badge}
                  </span>
                )}
                <h1 className="font-bold text-dark text-3xl sm:text-5xl leading-tight mb-8">
                  {title}
                </h1>
                <a
                  href={slide.href || "/shop"}
                  className="inline-flex items-center gap-2.5 font-semibold text-white text-sm rounded-lg py-3.5 px-8 bg-dark hover:bg-blue ease-out duration-200"
                >
                  {cta}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={isArabic ? "rotate-180" : ""}>
                    <path d="M3 8h10M8 3l5 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>

              {/* Circular image */}
              {slide.image && (
                <div className={`hidden sm:flex flex-shrink-0 ${isArabic ? "order-1" : ""}`}>
                  <div className="relative w-[220px] h-[220px] lg:w-[280px] lg:h-[280px] rounded-full overflow-hidden border-[6px] border-[#F7EDE7] shadow-xl">
                    <Image
                      src={slide.image}
                      alt={title}
                      fill
                      className="object-cover object-top"
                      sizes="280px"
                      priority={index === 0}
                    />
                  </div>
                </div>
              )}

            </div>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
};

export default HeroCarousal;
