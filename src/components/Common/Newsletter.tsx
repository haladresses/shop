"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useLanguage } from "@/app/context/LanguageContext";

const Newsletter = () => {
  const { isArabic } = useLanguage();
  const [email, setEmail] = useState("");
  const copy = isArabic
    ? {
        title: "انضمي إلى دائرة هلا",
        description:
          "احصلي على تحديثات أحدث وصولات النساء والأطفال، والتنزيلات، وأخبار المتجر من مسقط.",
        placeholder: "أدخلي بريدك الإلكتروني لأحدث الوصولات",
        cta: "اشتركي الآن",
        success: "شكراً لاشتراكك! ترقبي أحدث العروض قريباً.",
      }
    : {
        title: "Join the Hala Circle",
        description:
          "Get updates on women's and kids' new arrivals, sale announcements, and store news from Muscat.",
        placeholder: "Enter your email for new arrivals",
        cta: "Stay Updated",
        success: "Thanks for subscribing! Watch your inbox for new arrivals.",
      };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success(copy.success);
    setEmail("");
  };

  return (
    <section className="overflow-hidden">
      <div className="max-w-[1170px] mx-auto px-4 sm:px-8 xl:px-0">
        <div className="relative z-1 overflow-hidden rounded-2xl bg-gradient-to-br from-blue via-blue-dark to-[#4A1D25]">
          {/* decorative accents */}
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 left-10 w-56 h-56 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 sm:gap-8 px-5 sm:px-7.5 xl:pl-12.5 xl:pr-14 py-9 sm:py-11">
            <div className="max-w-[491px] w-full">
              <h2 className="max-w-[399px] text-white font-bold text-lg sm:text-xl xl:text-heading-4 mb-3">
                {copy.title}
              </h2>
              <p className="text-white/80 text-sm sm:text-base">
                {copy.description}
              </p>
            </div>

            <div className="max-w-[477px] w-full">
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    name="email"
                    id="email"
                    required
                    placeholder={copy.placeholder}
                    dir={isArabic ? "rtl" : "ltr"}
                    className="w-full bg-white/95 border border-white/0 outline-none rounded-md placeholder:text-dark-4 py-3 px-5 focus:ring-2 focus:ring-white/40"
                  />
                  <button
                    type="submit"
                    className="inline-flex justify-center py-3 px-7 text-blue bg-white font-semibold rounded-md ease-out duration-200 hover:bg-white/90 whitespace-nowrap"
                  >
                    {copy.cta}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
