"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useLanguage } from "@/app/context/LanguageContext";
import Image from "next/image";

import "swiper/css/pagination";
import "swiper/css";

const HeroCarousal = () => {
  const { language, isArabic } = useLanguage();

  const slides = isArabic
    ? [
        {
          badge: "هلا دريسز — مسقط",
          title: "أزياء نسائية وأطفال مختارة.",
          cta: "تسوقي الآن",
          href: "/shop",
          img: "/images/products/p1.png",
        },
        {
          badge: "تشكيلة البنات",
          title: "فساتين أنيقة لكل مناسبة.",
          cta: "اكتشفي التشكيلة",
          href: "/shop",
          img: "/images/products/p3.png",
        },
      ]
    : [
        {
          badge: "Hala Dresses — Muscat",
          title: "Women & kids fashion, curated.",
          cta: "Shop Now",
          href: "/shop",
          img: "/images/products/p1.png",
        },
        {
          badge: "Girls' Collection",
          title: "Elegant dresses for every occasion.",
          cta: "Explore",
          href: "/shop",
          img: "/images/products/p3.png",
        },
      ];

  return (
    <Swiper
      key={language}
      dir={isArabic ? "rtl" : "ltr"}
      spaceBetween={0}
      centeredSlides={true}
      autoplay={{ delay: 4000, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      modules={[Autoplay, Pagination]}
      className="hero-carousel"
    >
      {slides.map((slide) => (
        <SwiperSlide key={slide.title}>
          <div className="flex items-center min-h-[420px] px-8 sm:px-12 lg:px-16 py-12 gap-10">

            {/* Text */}
            <div className={`flex-1 ${isArabic ? "text-right order-2" : ""}`}>
              <span className="inline-flex rounded-full bg-blue/10 px-4 py-1.5 text-sm font-medium text-blue mb-5">
                {slide.badge}
              </span>
              <h1 className="font-bold text-dark text-3xl sm:text-5xl leading-tight mb-8">
                {slide.title}
              </h1>
              <a
                href={slide.href}
                className="inline-flex items-center gap-2.5 font-semibold text-white text-sm rounded-lg py-3.5 px-8 bg-dark hover:bg-blue ease-out duration-200"
              >
                {slide.cta}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={isArabic ? "rotate-180" : ""}>
                  <path d="M3 8h10M8 3l5 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>

            {/* Circular image */}
            <div className={`hidden sm:flex flex-shrink-0 ${isArabic ? "order-1" : ""}`}>
              <div className="relative w-[220px] h-[220px] lg:w-[280px] lg:h-[280px] rounded-full overflow-hidden border-[6px] border-[#F7EDE7] shadow-xl">
                <Image
                  src={slide.img}
                  alt={slide.title}
                  fill
                  className="object-cover object-top"
                  sizes="280px"
                  priority
                />
              </div>
            </div>

          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default HeroCarousal;
