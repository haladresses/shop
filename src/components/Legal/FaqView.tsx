"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Common/Breadcrumb";
import { useLanguage } from "@/app/context/LanguageContext";
import { fetchFaq, DEFAULT_FAQ_CONFIG, FaqConfig } from "@/lib/legalPages";

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
  >
    <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FaqView = () => {
  const { isArabic } = useLanguage();
  const [config, setConfig] = useState<FaqConfig>(DEFAULT_FAQ_CONFIG);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchFaq(controller.signal)
      .then(setConfig)
      .catch(() => setConfig(DEFAULT_FAQ_CONFIG))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const title = isArabic ? config.titleAr : config.titleEn;
  const intro = isArabic ? config.introAr : config.introEn;

  return (
    <>
      <Breadcrumb title={title} pages={[title]} />

      <section className="overflow-hidden py-14 sm:py-20 bg-gray-2">
        <div className="max-w-[900px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          <div className={isArabic ? "text-right" : "text-left"} dir={isArabic ? "rtl" : "ltr"}>
            {intro && <p className="text-dark-3 mb-8 leading-relaxed max-w-[640px]">{intro}</p>}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="spinner" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {config.items.map((item, i) => {
                  const question = isArabic ? item.questionAr : item.questionEn;
                  const answer = isArabic ? item.answerAr : item.answerEn;
                  if (!question) return null;
                  const open = openIndex === i;
                  return (
                    <div key={i} className="bg-white rounded-xl shadow-1 overflow-hidden">
                      <button
                        onClick={() => setOpenIndex(open ? null : i)}
                        className={`w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-start font-medium text-dark hover:text-blue transition-colors ${isArabic ? "flex-row-reverse" : ""}`}
                      >
                        <span>{question}</span>
                        <ChevronIcon open={open} />
                      </button>
                      <div className={`grid transition-all duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                        <div className="overflow-hidden">
                          <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-dark-3 leading-relaxed">{answer}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default FaqView;
