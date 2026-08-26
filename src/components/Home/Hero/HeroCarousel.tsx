"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useLanguage } from "@/app/context/LanguageContext";
import { HeroSlide } from "@/lib/hero";
import Image from "next/image";

import "swiper/css/pagination";
import "swiper/css";

const HeroCarousal = ({ slides }: { slides: HeroSlide[] | null }) => {
  const { language, isArabic } = useLanguage();

  if (!slides) {
    return (
      <div className="min-h-[440px] sm:min-h-[420px] lg:min-h-[480px] flex items-center px-6 sm:px-10 lg:px-16">
        <div className="flex-1 flex flex-col items-center sm:items-start animate-pulse">
          <div className="h-6 w-40 rounded-full bg-gray-2 mb-5" />
          <div className="h-8 sm:h-10 w-full max-w-[380px] rounded-lg bg-gray-2 mb-3" />
          <div className="h-8 sm:h-10 w-full max-w-[260px] rounded-lg bg-gray-2 mb-6" />
          <div className="h-11 w-40 rounded-full bg-gray-2" />
        </div>
        <div className="hidden sm:block flex-shrink-0">
          <div className="w-[220px] h-[220px] lg:w-[300px] lg:h-[300px] rounded-full bg-gray-2 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <Swiper
      key={`${language}-${slides.length}`}
      dir={isArabic ? "rtl" : "ltr"}
      spaceBetween={0}
      centeredSlides={true}
      autoplay={{ delay: 5000, disableOnInteraction: false }}
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
            <div
              className={`flex flex-col sm:flex-row items-center min-h-[440px] sm:min-h-[420px] lg:min-h-[480px] px-6 sm:px-10 lg:px-16 pt-10 pb-14 sm:py-12 gap-8 sm:gap-10 lg:gap-14 text-center sm:text-start ${
                isArabic ? "sm:flex-row-reverse" : ""
              }`}
            >
              {/* Text */}
              <div className="flex-1 flex flex-col items-center sm:items-start">
                {badge && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue/10 px-4 py-1.5 text-xs sm:text-sm font-semibold text-blue mb-5 tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue" />
                    {badge}
                  </span>
                )}
                <h1 className="font-bold text-dark text-2xl leading-[1.2] xsm:text-[26px] sm:text-[32px] lg:text-[38px] xl:text-[44px] xl:leading-[1.15] mb-4 sm:mb-5 max-w-[480px]">
                  {title}
                </h1>
                <p className="hidden sm:block text-dark-4 text-sm lg:text-base max-w-[420px] mb-7">
                  {isArabic
                    ? "توصيل سريع داخل عُمان، مقاسات متعددة، وقطع مختارة أسبوعياً بأناقة تليق بكِ."
                    : "Fast delivery across Oman, sizes for every fit, and fresh pieces curated weekly just for you."}
                </p>
                <div className={`flex items-center gap-4 flex-wrap justify-center sm:justify-start`}>
                  <a
                    href={slide.href || "/shop"}
                    className="group inline-flex items-center gap-2.5 font-semibold text-white text-sm rounded-full py-3.5 px-8 bg-dark hover:bg-blue shadow-[0_10px_25px_-8px_rgba(47,36,31,0.45)] hover:shadow-[0_14px_30px_-8px_rgba(140,59,73,0.5)] ease-out duration-300 hover:-translate-y-0.5"
                  >
                    {cta}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={`transition-transform duration-300 group-hover:translate-x-1 ${isArabic ? "rotate-180 group-hover:-translate-x-1" : ""}`}
                    >
                      <path d="M3 8h10M8 3l5 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>

                {/* Social proof */}
                <div className="hidden sm:flex items-center gap-3 mt-8">
                  <div className="flex -space-x-2.5 rtl:space-x-reverse">
                    {["/images/users/user-01.jpg", "/images/users/user-02.jpg", "/images/users/user-03.jpg"].map((src, i) => (
                      <span key={i} className="relative w-8 h-8 rounded-full ring-2 ring-white overflow-hidden">
                        <Image src={src} alt="customer" fill sizes="32px" className="object-cover" />
                      </span>
                    ))}
                  </div>
                  <div className={isArabic ? "text-right" : ""}>
                    <div className="flex items-center gap-0.5 text-yellow">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 .5l2.24 4.54 5.01.73-3.63 3.53.86 4.99L8 12.9l-4.48 2.36.86-4.99L.75 5.77l5.01-.73L8 .5z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-2xs text-dark-4 leading-none mt-1">
                      {isArabic ? "أكثر من 5,000 عميلة سعيدة" : "5,000+ happy customers"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Circular image */}
              {slide.image && (
                <div className="flex-shrink-0">
                  <div className="relative w-[150px] h-[150px] xsm:w-[190px] xsm:h-[190px] sm:w-[220px] sm:h-[220px] lg:w-[300px] lg:h-[300px] rounded-full overflow-hidden border-[6px] sm:border-[8px] border-white shadow-[0_20px_45px_-12px_rgba(47,36,31,0.35)] ring-1 ring-blue/10">
                    <Image
                      src={slide.image}
                      alt={title}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 640px) 190px, (max-width: 1024px) 220px, 300px"
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
