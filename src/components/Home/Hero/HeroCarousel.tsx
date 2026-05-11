"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";

// Import Swiper styles
import "swiper/css/pagination";
import "swiper/css";

const HeroCarousal = () => {
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
      <SwiperSlide>
        <div className="px-6 sm:px-8 lg:px-12 py-14 sm:py-18 lg:py-24 min-h-[420px] flex items-center">
          <div className="max-w-[560px]">
            <span className="inline-flex rounded-full bg-blue/10 px-4 py-2 text-sm font-medium text-blue mb-6">
              Hala Dresses Women and Kids Retail
            </span>
            <h1 className="font-semibold text-dark text-3xl sm:text-5xl leading-tight mb-5">
              Everyday favorites and occasion looks for women and little ones.
            </h1>
            <p className="max-w-[500px] text-dark-3 text-custom-sm sm:text-base">
              Discover curated retail collections in Muscat with fresh women&apos;s styles, girls&apos; looks, and playful wardrobe essentials for every season.
            </p>
            <a
              href="/shop-with-sidebar"
              className="inline-flex font-medium text-white text-custom-sm rounded-md bg-dark py-3 px-9 ease-out duration-200 hover:bg-blue mt-10"
            >
              Shop the Collection
            </a>
          </div>
        </div>
      </SwiperSlide>
      <SwiperSlide>
        <div className="px-6 sm:px-8 lg:px-12 py-14 sm:py-18 lg:py-24 min-h-[420px] flex items-center">
          <div className="max-w-[560px]">
            <span className="inline-flex rounded-full bg-dark/5 px-4 py-2 text-sm font-medium text-dark mb-6">
              Bousher, Muscat
            </span>
            <h2 className="font-semibold text-dark text-3xl sm:text-5xl leading-tight mb-5">
              Visit the store or order directly through WhatsApp.
            </h2>
            <p className="max-w-[500px] text-dark-3 text-custom-sm sm:text-base">
              Hala Dresses serves families across Oman with retail fashion for women and children, plus direct support during store hours from Saturday to Thursday.
            </p>
            <a
              href="/contact"
              className="inline-flex font-medium text-white text-custom-sm rounded-md bg-blue py-3 px-9 ease-out duration-200 hover:bg-blue-dark mt-10"
            >
              Contact the Store
            </a>
          </div>
        </div>
      </SwiperSlide>
    </Swiper>
  );
};

export default HeroCarousal;
