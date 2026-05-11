"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useLanguage } from "@/app/context/LanguageContext";

// Import Swiper styles
import "swiper/css/pagination";
import "swiper/css";

const HeroCarousal = () => {
  const { isArabic } = useLanguage();
  const slides = isArabic
    ? [
        {
          badge: "هلا دريسز لأزياء النساء والأطفال",
          title: "إطلالات يومية ومناسبات جميلة للنساء والصغيرات.",
          description:
            "اكتشفي تشكيلات مختارة في مسقط تضم أزياء نسائية متجددة، وإطلالات للبنات، وقطعاً مريحة لكل موسم.",
          cta: "تسوقي التشكيلة",
          href: "/shop-with-sidebar",
          tone: "dark",
        },
        {
          badge: "بوشر، مسقط",
          title: "زوري المتجر أو اطلبي مباشرة عبر واتساب.",
          description:
            "هلا دريسز يخدم العائلات في عمان بأزياء نسائية وأطفال مع دعم مباشر خلال ساعات عمل المتجر من السبت إلى الخميس.",
          cta: "تواصلي مع المتجر",
          href: "/contact",
          tone: "blue",
        },
      ]
    : [
        {
          badge: "Hala Dresses Women and Kids Retail",
          title: "Everyday favorites and occasion looks for women and little ones.",
          description:
            "Discover curated retail collections in Muscat with fresh women's styles, girls' looks, and playful wardrobe essentials for every season.",
          cta: "Shop the Collection",
          href: "/shop-with-sidebar",
          tone: "dark",
        },
        {
          badge: "Bousher, Muscat",
          title: "Visit the store or order directly through WhatsApp.",
          description:
            "Hala Dresses serves families across Oman with retail fashion for women and children, plus direct support during store hours from Saturday to Thursday.",
          cta: "Contact the Store",
          href: "/contact",
          tone: "blue",
        },
      ];

  return (
    <Swiper
      spaceBetween={30}
      centeredSlides={true}
      autoplay={{
        delay: 2500,
        disableOnInteraction: false,
      }}
      pagination={{
        clickable: true,
      }}
      modules={[Autoplay, Pagination]}
      className="hero-carousel"
    >
      {slides.map((slide) => (
        <SwiperSlide key={slide.title}>
        <div className="px-6 sm:px-8 lg:px-12 py-14 sm:py-18 lg:py-24 min-h-[420px] flex items-center">
          <div className={`max-w-[560px] ${isArabic ? "text-right" : ""}`}>
            <span className={`inline-flex rounded-full px-4 py-2 text-sm font-medium mb-6 ${slide.tone === "blue" ? "bg-dark/5 text-dark" : "bg-blue/10 text-blue"}`}>
              {slide.badge}
            </span>
            <h1 className="font-semibold text-dark text-3xl sm:text-5xl leading-tight mb-5">
              {slide.title}
            </h1>
            <p className="max-w-[500px] text-dark-3 text-custom-sm sm:text-base">
              {slide.description}
            </p>
            <a
              href={slide.href}
              className={`inline-flex font-medium text-white text-custom-sm rounded-md py-3 px-9 ease-out duration-200 mt-10 ${slide.tone === "blue" ? "bg-blue hover:bg-blue-dark" : "bg-dark hover:bg-blue"}`}
            >
              {slide.cta}
            </a>
          </div>
        </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default HeroCarousal;
