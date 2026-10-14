"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/app/context/LanguageContext";
import { fetchCountdown, CountdownConfig } from "@/lib/countdown";

type Left = { d: number; h: number; m: number; s: number; done: boolean };

const remaining = (deadline: number): Left => {
  const t = Math.max(deadline - Date.now(), 0);
  return {
    d: Math.floor(t / 86400000),
    h: Math.floor((t / 3600000) % 24),
    m: Math.floor((t / 60000) % 60),
    s: Math.floor((t / 1000) % 60),
    done: t <= 0,
  };
};

/**
 * Limited-time offer banner. Solid surface, photo mirrors in RTL, stacks on
 * phones. It hides itself once the deadline has passed (never shows 00:00).
 */
const CounDown = () => {
  const { isArabic } = useLanguage();
  const [config, setConfig] = useState<CountdownConfig | null>(null);
  const [left, setLeft] = useState<Left | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCountdown(controller.signal).then(setConfig).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!config) return;
    const deadline = new Date(config.endsAt).getTime();
    const tick = () => setLeft(remaining(deadline));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config]);

  if (!config || !config.enabled || !left || left.done) return null;

  const t = (en: string, ar: string) => (isArabic ? ar || en : en || ar);
  const units: [number, string, string][] = [
    [left.d, "Days", "أيام"],
    [left.h, "Hours", "ساعات"],
    [left.m, "Minutes", "دقائق"],
    [left.s, "Seconds", "ثواني"],
  ];

  return (
    <section className="py-12 sm:py-20" dir={isArabic ? "rtl" : "ltr"}>
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="grid md:grid-cols-[1.1fr_0.9fr] overflow-hidden rounded-3xl bg-[#F4EDE8] ring-1 ring-blue/10">
          <div className="order-last md:order-first p-6 sm:p-10 lg:p-14 flex flex-col justify-center text-center md:text-start">
            <span className="inline-flex self-center md:self-start items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-blue mb-4">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-blue animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-blue" />
              </span>
              {t(config.eyebrowEn, config.eyebrowAr)}
            </span>

            <h2 className="font-bold text-dark text-2xl sm:text-3xl lg:text-[40px] leading-tight mb-7">{t(config.titleEn, config.titleAr)}</h2>

            <div className="flex justify-center md:justify-start gap-2 sm:gap-3 mb-8" role="timer" aria-live="off">
              {units.map(([v, en, ar], i) => (
                <React.Fragment key={en}>
                  <div className="flex flex-col items-center">
                    <span className="relative w-[62px] sm:w-[76px] h-[64px] sm:h-[78px] rounded-2xl bg-white shadow-[0_10px_30px_-18px_rgba(47,36,31,.5)] flex items-center justify-center overflow-hidden">
                      <span key={v} className="cd-tick font-bold text-2xl sm:text-[32px] text-dark tabular-nums">
                        {String(v).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="mt-2 text-[11px] sm:text-xs font-medium uppercase tracking-wider text-dark-4">{t(en, ar)}</span>
                  </div>
                  {i < units.length - 1 && <span className="self-start mt-[20px] sm:mt-[26px] text-xl font-bold text-blue/40">:</span>}
                </React.Fragment>
              ))}
            </div>

            <a
              href={config.href}
              className="group self-center md:self-start inline-flex items-center gap-2.5 rounded-full bg-dark hover:bg-blue text-white font-semibold text-sm sm:text-[15px] py-3.5 px-8 transition-colors"
            >
              {t(config.ctaEn, config.ctaAr)}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1">
                <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          {config.image && (
            <div className="relative min-h-[300px] sm:min-h-[380px] md:min-h-full bg-[#EDE5E0]">
              <Image src={config.image} alt="" fill sizes="(max-width: 768px) 100vw, 520px" className="object-cover object-top" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CounDown;
