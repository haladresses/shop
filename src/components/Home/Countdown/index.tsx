"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { useLanguage } from "@/app/context/LanguageContext";

const CounDown = () => {
  const { isArabic } = useLanguage();
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const deadline = useMemo(
    () => new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).getTime(),
    [],
  );

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
  }, [deadline]);

  return (
    <section className="overflow-hidden py-20">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="relative overflow-hidden z-1 rounded-lg bg-[#D0E9F3] p-4 sm:p-7.5 lg:p-10 xl:p-15">
          <div
            className={`relative z-10 max-w-[422px] w-full ${
              isArabic ? "text-right lg:ml-auto" : "lg:mr-auto"
            }`}
          >
            <span className="block font-medium text-custom-1 text-blue mb-2.5">
              {isArabic ? "لا تفوتيه" : "Don’t Miss!!"}
            </span>

            <h2 className="font-bold text-dark text-xl lg:text-heading-4 xl:text-heading-3 mb-3">
              {isArabic ? "الدفعة القادمة من هلا تنتهي قريباً." : "The next Hala capsule closes soon."}
            </h2>

            <p>
              {isArabic
                ? "احجزي القطع المفضلة لديك قبل انتهاء الدفعة الحالية."
                : "Reserve your favorite silhouette before the private release ends."}
            </p>

            {/* <!-- Countdown timer --> */}
            <div
              className={`flex flex-wrap gap-6 mt-6 ${
                isArabic ? "justify-end" : "justify-start"
              }`}
              x-data="timer()"
              x-init="countdown()"
            >
              {/* <!-- timer day --> */}
              <div>
                <span
                  className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2"
                  x-text="days"
                >
                  {" "}
                  {days < 10 ? "0" + days : days}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "أيام" : "Days"}
                </span>
              </div>

              {/* <!-- timer hours --> */}
              <div>
                <span
                  className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2"
                  x-text="hours"
                >
                  {" "}
                  {hours < 10 ? "0" + hours : hours}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "ساعات" : "Hours"}
                </span>
              </div>

              {/* <!-- timer minutes --> */}
              <div>
                <span
                  className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2"
                  x-text="minutes"
                >
                  {minutes < 10 ? "0" + minutes : minutes}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "دقائق" : "Minutes"}
                </span>
              </div>

              {/* <!-- timer seconds --> */}
              <div>
                <span
                  className="min-w-[64px] h-14.5 font-semibold text-xl lg:text-3xl text-dark rounded-lg flex items-center justify-center bg-white shadow-2 px-4 mb-2"
                  x-text="seconds"
                >
                  {seconds < 10 ? "0" + seconds : seconds}{" "}
                </span>
                <span className="block text-custom-sm text-dark text-center">
                  {isArabic ? "ثوانٍ" : "Seconds"}
                </span>
              </div>
            </div>
            {/* <!-- Countdown timer ends --> */}

            <a
              href="/shop-with-sidebar"
              className="inline-flex font-medium text-custom-sm text-white bg-blue py-3 px-9.5 rounded-md ease-out duration-200 hover:bg-blue-dark mt-7.5"
            >
              {isArabic ? "احجزي إطلالتك" : "Reserve Your Look"}
            </a>
          </div>

          {/* <!-- bg shapes --> */}
          <Image
            src="/images/countdown/countdown-bg.png"
            alt="bg shapes"
            className={`hidden sm:block absolute bottom-0 -z-1 ${
              isArabic ? "left-0 scale-x-[-1]" : "right-0"
            }`}
            width={737}
            height={482}
          />
          <Image
            src="/images/countdown/countdown-01.png"
            alt="product"
            className={`hidden lg:block absolute bottom-4 xl:bottom-10 -z-1 ${
              isArabic ? "left-4 xl:left-33" : "right-4 xl:right-33"
            }`}
            width={411}
            height={376}
          />
        </div>
      </div>
    </section>
  );
};

export default CounDown;
