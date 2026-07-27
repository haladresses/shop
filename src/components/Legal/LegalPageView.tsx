"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Common/Breadcrumb";
import { useLanguage } from "@/app/context/LanguageContext";
import { LegalPageConfig, normalizeLegalPage } from "@/lib/legalPages";
import RichText from "./RichText";

const LegalPageView = ({
  endpoint,
  fallback,
}: {
  endpoint: string;
  fallback: LegalPageConfig;
}) => {
  const { isArabic } = useLanguage();
  const [config, setConfig] = useState<LegalPageConfig>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => setConfig(json.success ? normalizeLegalPage(json.data, fallback) : fallback))
      .catch(() => setConfig(fallback))
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const title = isArabic ? config.titleAr : config.titleEn;
  const intro = isArabic ? config.introAr : config.introEn;

  return (
    <>
      <Breadcrumb title={title} pages={[title]} />

      <section className="overflow-hidden py-14 sm:py-20 bg-gray-2">
        <div className="max-w-[900px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          <div className={`bg-white rounded-xl shadow-1 p-5 sm:p-8 xl:p-11 ${isArabic ? "text-right" : "text-left"}`} dir={isArabic ? "rtl" : "ltr"}>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="spinner" />
              </div>
            ) : (
              <>
                {intro && <p className="text-dark font-medium mb-8 leading-relaxed">{intro}</p>}

                <div className="flex flex-col gap-8">
                  {config.sections.map((section, i) => {
                    const heading = isArabic ? section.headingAr : section.headingEn;
                    const body = isArabic ? section.bodyAr : section.bodyEn;
                    if (!heading && !body) return null;
                    return (
                      <div key={i}>
                        {heading && <h2 className="font-semibold text-lg text-dark mb-3">{heading}</h2>}
                        {body && <RichText text={body} isArabic={isArabic} />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default LegalPageView;
