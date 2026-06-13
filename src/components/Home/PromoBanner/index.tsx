"use client";

import React from "react";
import { useLanguage } from "@/app/context/LanguageContext";

const PromoBanner = () => {
  const supportPhone = "+968 9944 0312";
  const { isArabic } = useLanguage();
  const copy = isArabic
    ? {
        heroEyebrow: "مختارات هلا دريسز",
        heroTitle: "أزياء نسائية وأطفال مناسبة للحياة اليومية والمناسبات.",
        heroDescription:
          "من الإطلالات اليومية إلى مناسبات العائلة، تقدم هلا دريسز تشكيلات تجمع الراحة واللون والأناقة للعائلات في عمان.",
        heroCta: "تصفحي التشكيلات",
        timingEyebrow: "أوقات المتجر",
        timingTitle: "من السبت إلى الخميس",
        timingText: "11 صباحاً - 1 ظهراً و6 مساءً - 8 مساءً",
        timingCta: "زورينا",
        whatsappEyebrow: "طلبات واتساب",
        whatsappTitle: "رد سريع على",
        whatsappText: "اسألي عن التوفر والمقاسات وأقرب إطلالة تناسبك مباشرة عبر واتساب هلا دريسز.",
        whatsappCta: "تواصلي عبر واتساب",
      }
    : {
        heroEyebrow: "Hala Dresses Retail Edit",
        heroTitle: "Women and kids fashion, chosen for real life and special days.",
        heroDescription:
          "From daily outfits to celebration looks, Hala Dresses offers retail collections that balance comfort, color, and polished style for families in Oman.",
        heroCta: "Browse Collections",
        timingEyebrow: "Store Timing",
        timingTitle: "Saturday to Thursday",
        timingText: "11AM-1PM and 6PM-8PM",
        timingCta: "Visit Us",
        whatsappEyebrow: "WhatsApp Orders",
        whatsappTitle: "Fast replies on",
        whatsappText:
          "Ask about stock, sizing, or your nearest favorite look directly through the Hala Dresses WhatsApp line.",
        whatsappCta: "Chat on WhatsApp",
      };

  return (
    <section className="overflow-hidden py-20">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        {/* <!-- promo banner big --> */}
        <div className="relative z-1 overflow-hidden rounded-lg bg-[#F6E5E1] py-12.5 lg:py-17.5 xl:py-22.5 px-4 sm:px-7.5 lg:px-14 xl:px-19 mb-7.5">
          <div className="max-w-[550px] w-full">
            <span className="block font-medium text-xl text-dark mb-3">
              {copy.heroEyebrow}
            </span>

            <h2 className="font-bold text-xl lg:text-heading-4 xl:text-heading-3 text-dark mb-5">
              {copy.heroTitle}
            </h2>

            <p>{copy.heroDescription}</p>

            <a
              href="/shop"
              className="inline-flex font-medium text-custom-sm text-white bg-blue py-[11px] px-9.5 rounded-md ease-out duration-200 hover:bg-blue-dark mt-7.5"
            >
              {copy.heroCta}
            </a>
          </div>
        </div>

        <div className="grid gap-7.5 grid-cols-1 lg:grid-cols-2">
          {/* <!-- promo banner small --> */}
          <div className="relative z-1 overflow-hidden rounded-lg bg-[#EFE7E1] py-10 xl:py-16 px-4 sm:px-7.5 xl:px-10">
            <div className="text-right">
              <span className="block text-lg text-dark mb-1.5">
                {copy.timingEyebrow}
              </span>

              <h2 className="font-bold text-xl lg:text-heading-4 text-dark mb-2.5">
                {copy.timingTitle}
              </h2>

              <p className="font-semibold text-custom-1 text-teal">
                {copy.timingText}
              </p>

              <a
                href="/contact"
                className="inline-flex font-medium text-custom-sm text-white bg-dark py-2.5 px-8.5 rounded-md ease-out duration-200 hover:bg-blue mt-9"
              >
                {copy.timingCta}
              </a>
            </div>
          </div>

          {/* <!-- promo banner small --> */}
          <div className="relative z-1 overflow-hidden rounded-lg bg-[#F7EEE8] py-10 xl:py-16 px-4 sm:px-7.5 xl:px-10">
            <div>
              <span className="block text-lg text-dark mb-1.5">
                {copy.whatsappEyebrow}
              </span>

              <h2 className="font-bold text-xl lg:text-heading-4 text-dark mb-2.5">
                <span className="text-orange">
                  {copy.whatsappTitle}{" "}
                  <span className="phone-ltr inline-block">{supportPhone}</span>
                </span>
              </h2>

              <p className="max-w-[285px] text-custom-sm">
                {copy.whatsappText}
              </p>

              <a
                href="https://api.whatsapp.com/send?phone=96899440312"
                className="inline-flex font-medium text-custom-sm text-white bg-orange py-2.5 px-8.5 rounded-md ease-out duration-200 hover:bg-orange-dark mt-7.5"
              >
                {copy.whatsappCta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
