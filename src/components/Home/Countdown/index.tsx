"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useLanguage } from "@/app/context/LanguageContext";
import { fetchCountdown, normalizeCountdown, CountdownConfig } from "@/lib/countdown";

const CounDown = () => {
  const { isArabic } = useLanguage();
  const [config, setConfig] = useState<CountdownConfig>(() => normalizeCountdown(null));
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchCountdown(controller.signal)
      .then(setConfig)
      .catch(() => setConfig(normalizeCountdown(null)));
    return () => controller.abort();
  }, []);

  const deadline = new Date(config.endsAt).getTime();

  const getTime = useCallback(() => {
    const time = Math.max(deadline - Date.now(), 0);

    setDays(Math.floor(time / (1000 * 60 * 60 * 24)));
    setHours(Math.floor((time / (1000 * 60 * 60)) % 24));
    setMinutes(Math.floor((time / 1000 / 60) % 60));
    setSeconds(Math.floor((time / 1000) % 60));
  }, [deadline]);

  useEffect(() => {
    getTime();
    const interval = setInterval(getTime, 1000);

    return () => clearInterval(interval);
  }, [getTime]);

  if (!config.enabled) return null;

  return (
    <section className="overflow-hidden py-14 sm:py-20">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="relative overflow-hidden z-1 rounded-2xl bg-gradient-to-br from-[#F3E3D9] to-[#EAD3E6] p-5 sm:p-7.5 lg:p-10 xl:p-15">
          <div
            className={`relative z-10 max-w-[422px] w-full ${
              isArabic ? "text-right lg:ml-auto" : "lg:mr-auto"
            }`}
          >
            <span className="block font-medium text-custom-1 text-blue mb-2.5">
              {isArabic ? config.eyebrowAr : config.eyebrowEn}
            </span>

            <h2 className="font-bold text-dark text-xl lg:text-heading-4 xl:text-heading-3 mb-3">
              {isArabic ? config.titleAr : config.titleEn}
            </h2>

            {/* <!-- Countdown timer --> */}
            <div
              className={`flex flex-wrap gap-3 sm:gap-6 mt-6 ${
                isArabic ? "justify-end" : "justify-start"
              }`}
            >
              {/* <!-- timer day --> */}
              <div>
                <span className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2">
                  {" "}
                  {days < 10 ? "0" + days : days}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "أيام" : "Days"}
                </span>
              </div>

              {/* <!-- timer hours --> */}
              <div>
                <span className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2">
                  {" "}
                  {hours < 10 ? "0" + hours : hours}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "ساعات" : "Hours"}
                </span>
              </div>

              {/* <!-- timer minutes --> */}
              <div>
                <span className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2">
                  {minutes < 10 ? "0" + minutes : minutes}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "دقائق" : "Minutes"}
                </span>
              </div>

              {/* <!-- timer seconds --> */}
              <div>
                <span className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2">
                  {seconds < 10 ? "0" + seconds : seconds}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "ثوانٍ" : "Seconds"}
                </span>
              </div>
            </div>
            {/* <!-- Countdown timer ends --> */}

            <a
              href={config.href}
              className="inline-flex font-medium text-custom-sm text-white bg-blue py-3 px-9.5 rounded-md ease-out duration-200 hover:bg-blue-dark mt-7.5"
            >
              {isArabic ? config.ctaAr : config.ctaEn}
            </a>
          </div>

          {config.image && (
            <div
              className={`hidden lg:block absolute bottom-0 -z-1 ${
                isArabic ? "left-0" : "right-0"
              }`}
              style={{ width: 480, height: "100%" }}
            >
              <div className="relative w-full h-full">
                <Image
                  src={config.image}
                  alt="featured product"
                  fill
                  className="object-cover object-top"
                  sizes="480px"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CounDown;
