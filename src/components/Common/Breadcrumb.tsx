"use client";

import Link from "next/link";
import React from "react";
import { useLanguage } from "@/app/context/LanguageContext";

const Breadcrumb = ({ title, pages }) => {
  const { isArabic } = useLanguage();

  return (
    <div className="overflow-hidden shadow-breadcrumb pt-[73px] xl:pt-[125px]">
      <div className="border-t border-gray-3">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0 py-4 xl:py-6">
          <div
            className={`flex flex-col gap-3 sm:items-center sm:justify-between ${
              isArabic
                ? "items-end text-right sm:flex-row"
                : "items-start text-left sm:flex-row"
            }`}
          >
            <div className="w-full sm:w-auto sm:order-1">
              <h1 className="font-semibold text-dark text-xl sm:text-2xl xl:text-custom-2">
                {title}
              </h1>
            </div>

            <ul
              dir={isArabic ? "rtl" : "ltr"}
              className={`flex w-full flex-wrap items-center gap-2 sm:w-auto ${
                isArabic ? "justify-start text-left sm:order-2" : "justify-start text-left sm:order-2"
              }`}
            >
              <li className="text-custom-sm hover:text-blue">
                <Link href="/">{isArabic ? "الرئيسية" : "Home"}</Link>
              </li>

              <li className="text-custom-sm text-dark-4">/</li>

              {pages.length > 0 &&
                pages.map((page, key) => (
                  <li className="text-custom-sm last:text-blue capitalize" key={key}>
                    {page}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Breadcrumb;
