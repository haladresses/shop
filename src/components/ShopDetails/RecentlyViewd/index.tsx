"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import ProductItem from "@/components/Common/ProductItem";
import { getShopData } from "@/components/Shop/shopData";
import { fetchProducts } from "@/lib/storefront";
import { Product } from "@/types/product";
import { useLanguage } from "@/app/context/LanguageContext";

import "swiper/css/navigation";
import "swiper/css";

const RecentlyViewdItems = ({
  categorySlug,
  excludeId,
}: {
  categorySlug?: string;
  excludeId?: string;
}) => {
  const { language, isArabic } = useLanguage();
  const sliderRef = useRef(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({
      pageSize: 8,
      language,
      category: categorySlug,
      signal: controller.signal,
    })
      .then((res) => {
        const list = res.products.filter((p) => p.id !== excludeId);
        setProducts(list.length ? list : getShopData(language).slice(0, 8));
      })
      .catch(() => setProducts(getShopData(language).slice(0, 8)));
    return () => controller.abort();
  }, [language, categorySlug, excludeId]);

  const handlePrev = useCallback(() => {
    if (!sliderRef.current) return;
    sliderRef.current.swiper.slidePrev();
  }, []);

  const handleNext = useCallback(() => {
    if (!sliderRef.current) return;
    sliderRef.current.swiper.slideNext();
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="overflow-hidden pt-12 sm:pt-17.5">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0 pb-10 sm:pb-15 border-b border-gray-3">
        <div className="swiper common-carousel">
          {/* <!-- section title --> */}
          <div className={`mb-6 sm:mb-10 flex items-center justify-between ${isArabic ? "flex-row-reverse" : ""}`}>
            <div className={isArabic ? "text-right" : ""}>
              <span className={`flex items-center gap-2.5 font-medium text-dark mb-1.5 ${isArabic ? "flex-row-reverse" : ""}`}>
                <Image src="/images/icons/icon-05.svg" width={17} height={17} alt="icon" />
                {isArabic ? "منتجات مشابهة" : "You May Also Like"}
              </span>
              <h2 className="font-semibold text-xl xl:text-heading-5 text-dark">
                {isArabic ? "قد يعجبك أيضاً" : "Complete the Look"}
              </h2>
            </div>

            <div className="carousel-controls flex items-center gap-3">
              <button onClick={handlePrev} className="swiper-button-prev" aria-label="previous">
                <svg className="fill-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M15.4881 4.43057C15.8026 4.70014 15.839 5.17361 15.5694 5.48811L9.98781 12L15.5694 18.5119C15.839 18.8264 15.8026 19.2999 15.4881 19.5695C15.1736 19.839 14.7001 19.8026 14.4306 19.4881L8.43056 12.4881C8.18981 12.2072 8.18981 11.7928 8.43056 11.5119L14.4306 4.51192C14.7001 4.19743 15.1736 4.161 15.4881 4.43057Z" fill="" />
                </svg>
              </button>

              <button onClick={handleNext} className="swiper-button-next" aria-label="next">
                <svg className="fill-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.51192 4.43057C8.82641 4.161 9.29989 4.19743 9.56946 4.51192L15.5695 11.5119C15.8102 11.7928 15.8102 12.2072 15.5695 12.4881L9.56946 19.4881C9.29989 19.8026 8.82641 19.839 8.51192 19.5695C8.19743 19.2999 8.161 18.8264 8.43057 18.5119L14.0122 12L8.43057 5.48811C8.161 5.17361 8.19743 4.70014 8.51192 4.43057Z" fill="" />
                </svg>
              </button>
            </div>
          </div>

          <Swiper
            key={`${language}-${categorySlug ?? "all"}`}
            ref={sliderRef}
            dir={isArabic ? "rtl" : "ltr"}
            slidesPerView={4}
            spaceBetween={20}
            breakpoints={{
              0: { slidesPerView: 1.4, spaceBetween: 14 },
              480: { slidesPerView: 2, spaceBetween: 16 },
              768: { slidesPerView: 3 },
              1024: { slidesPerView: 4 },
            }}
          >
            {products.map((item, key) => (
              <SwiperSlide key={key}>
                <ProductItem item={item} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewdItems;
