"use client";

import Link from "next/link";
import React from "react";
import { useLanguage } from "@/app/context/LanguageContext";

/**
 * Page title + trail. Compact on phones (single line trail above a smaller
 * title) so products start higher on the screen; mirrors automatically in RTL.
 */
const Breadcrumb = ({ title, pages }: { title: string; pages: string[] }) => {
  const { isArabic } = useLanguage();
  const trail = pages.filter((p) => p && p !== "/");

  return (
    <div className="overflow-hidden pt-[73px] xl:pt-[125px] bg-white" dir={isArabic ? "rtl" : "ltr"}>
      <div className="border-t border-gray-3">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0 py-3 sm:py-5 xl:py-6 flex flex-col-reverse gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="font-semibold text-dark text-lg sm:text-2xl xl:text-custom-2 leading-tight truncate">{title}</h1>
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1.5 text-xs sm:text-custom-sm text-dark-4 whitespace-nowrap overflow-hidden">
              <li className="hover:text-blue shrink-0">
                <Link href="/">{isArabic ? "الرئيسية" : "Home"}</Link>
              </li>
              {trail.map((page, key) => (
                <React.Fragment key={key}>
                  <li aria-hidden className="text-gray-5">/</li>
                  <li className={`truncate capitalize ${key === trail.length - 1 ? "text-blue" : ""}`} aria-current={key === trail.length - 1 ? "page" : undefined}>
                    {page}
                  </li>
                </React.Fragment>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Breadcrumb;
