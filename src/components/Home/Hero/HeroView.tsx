"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { HeroConfig, HeroSlide } from "@/lib/hero";

// WebGL is decoration only — load it after the page is interactive.
const ThreeBackdrop = dynamic(() => import("@/components/Common/ThreeBackdrop"), { ssr: false });

const HEIGHT: Record<HeroConfig["settings"]["height"], string> = {
  md: "min-h-[520px] lg:min-h-[560px]",
  lg: "min-h-[600px] lg:min-h-[680px]",
  screen: "min-h-[640px] lg:min-h-[calc(100svh-80px)]",
};

/**
 * Presentational hero. Layout uses logical properties (start/end) only, so the
 * same markup is correct in LTR and RTL — the browser mirrors it from `dir`.
 * `isArabic` picks the copy; `dir` is set on the section itself so it also
 * renders correctly inside the admin preview.
 */
export default function HeroView({
  config,
  isArabic,
  preview = false,
}: {
  config: HeroConfig;
  isArabic: boolean;
  preview?: boolean;
}) {
  const { slides, settings } = config;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const count = slides.length;
  const safeIndex = count ? index % count : 0;
  const slide = slides[safeIndex];
  const accent = slide?.accent || settings.accent;

  const go = useCallback(
    (to: number) => {
      if (!count) return;
      setIndex(((to % count) + count) % count);
      setProgressKey((k) => k + 1);
    },
    [count],
  );

  // Autoplay — restarts its timer on every slide change, pauses on hover/focus.
  useEffect(() => {
    if (!settings.autoplay || paused || count < 2) return;
    const t = setTimeout(() => go(safeIndex + 1), settings.intervalMs);
    return () => clearTimeout(t);
  }, [settings.autoplay, settings.intervalMs, paused, count, safeIndex, go, progressKey]);

  // Visual "next" depends on reading direction.
  const next = () => go(safeIndex + 1);
  const prev = () => go(safeIndex - 1);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") (isArabic ? prev : next)();
    if (e.key === "ArrowLeft") (isArabic ? next : prev)();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    setPaused(false);
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    // Swiping toward the reading start moves forward.
    const forward = isArabic ? dx > 0 : dx < 0;
    (forward ? next : prev)();
  };

  if (!slide) return null;

  const t = (en: string, ar: string) => (isArabic ? ar || en : en || ar);
  const fullbleed = settings.layout === "fullbleed";
  const centered = settings.layout === "centered";
  const lightText = fullbleed;

  return (
    <section
      dir={isArabic ? "rtl" : "ltr"}
      lang={isArabic ? "ar" : "en"}
      aria-roledescription="carousel"
      aria-label={isArabic ? "عروض مميزة" : "Featured collections"}
      className={`hero-root relative isolate overflow-hidden ${preview ? "" : "pt-[88px] xl:pt-[110px]"}`}
      style={{ ["--hero-accent" as string]: accent }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKey}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <ThreeBackdrop effect={settings.effect} from={settings.background} to={settings.background} accent={accent} className="-z-10" />

      {/* Full-bleed photo layer */}
      {fullbleed &&
        slides.map((s, i) => (
          <div key={`bg-${i}`} aria-hidden className={`absolute inset-0 -z-10 transition-opacity duration-[1100ms] ease-out ${i === safeIndex ? "opacity-100" : "opacity-0"}`}>
            {s.image && (
              <picture>
                {s.mobileImage && <source media="(max-width: 640px)" srcSet={s.mobileImage} />}
                <img src={s.image} alt="" className={`w-full h-full object-cover object-top ${i === safeIndex ? "hero-kenburns" : ""}`} />
              </picture>
            )}
            <div className="absolute inset-0" style={{ background: `rgba(25,15,12,${settings.overlay / 100})` }} />
          </div>
        ))}

      <div className={`relative max-w-[1170px] mx-auto px-4 sm:px-8 xl:px-0 flex items-center ${HEIGHT[settings.height]} ${preview ? "!min-h-[460px]" : ""}`}>
        <div
          key={safeIndex}
          className={`w-full grid items-center gap-8 lg:gap-14 py-10 sm:py-14 ${
            fullbleed || centered ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[1.05fr_0.95fr]"
          }`}
        >
          {/* Copy */}
          <div
            className={`flex flex-col ${
              centered ? "items-center text-center mx-auto max-w-[760px]" : "items-center text-center md:items-start md:text-start"
            } ${fullbleed ? "max-w-[640px]" : ""}`}
          >
            {t(slide.badgeEn, slide.badgeAr) && (
              <span
                className="hero-rise inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold tracking-wide mb-5 backdrop-blur-sm"
                style={{
                  ["--d" as string]: "0ms",
                  color: lightText ? "#fff" : accent,
                  background: lightText ? "rgba(255,255,255,.14)" : `color-mix(in srgb, ${accent} 10%, white)`,
                  boxShadow: lightText ? "inset 0 0 0 1px rgba(255,255,255,.25)" : `inset 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
                }}
              >
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: lightText ? "#fff" : accent }} />
                  <span className="relative w-2 h-2 rounded-full" style={{ background: lightText ? "#fff" : accent }} />
                </span>
                {t(slide.badgeEn, slide.badgeAr)}
              </span>
            )}

            <h1
              className={`hero-rise font-bold tracking-tight text-[30px] leading-[1.15] xsm:text-[34px] sm:text-[42px] lg:text-[52px] xl:text-[58px] lg:leading-[1.08] mb-5 ${lightText ? "text-white" : "text-dark"} ${isArabic ? "leading-[1.35] lg:leading-[1.3]" : ""}`}
              style={{ ["--d" as string]: "90ms" }}
            >
              {t(slide.titleEn, slide.titleAr)}
            </h1>

            {t(slide.subtitleEn, slide.subtitleAr) && (
              <p
                className={`hero-rise text-sm sm:text-base lg:text-lg max-w-[520px] mb-8 ${lightText ? "text-white/85" : "text-dark-3"}`}
                style={{ ["--d" as string]: "180ms" }}
              >
                {t(slide.subtitleEn, slide.subtitleAr)}
              </p>
            )}

            <div className={`hero-rise flex flex-wrap gap-3 ${centered ? "justify-center" : "justify-center md:justify-start"}`} style={{ ["--d" as string]: "270ms" }}>
              {t(slide.ctaEn, slide.ctaAr) && (
                <a
                  href={slide.href || "/shop"}
                  className="hero-cta group relative inline-flex items-center gap-2.5 overflow-hidden font-semibold text-white text-sm sm:text-[15px] rounded-full py-3.5 sm:py-4 px-7 sm:px-9 transition-transform duration-300 hover:-translate-y-0.5"
                  style={{ background: accent, boxShadow: `0 14px 30px -10px color-mix(in srgb, ${accent} 70%, transparent)` }}
                >
                  <span className="relative z-10">{t(slide.ctaEn, slide.ctaAr)}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="relative z-10 transition-transform duration-300 rtl:-scale-x-100 group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                    <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
              {t(slide.cta2En, slide.cta2Ar) && (
                <a
                  href={slide.href2 || "/shop"}
                  className={`inline-flex items-center font-semibold text-sm sm:text-[15px] rounded-full py-3.5 sm:py-4 px-7 sm:px-8 transition-colors duration-300 ${
                    lightText ? "text-white ring-1 ring-white/50 hover:bg-white/10" : "text-dark ring-1 ring-dark/15 bg-white/60 backdrop-blur hover:bg-white"
                  }`}
                >
                  {t(slide.cta2En, slide.cta2Ar)}
                </a>
              )}
            </div>

            {settings.showSocialProof && t(settings.socialProofEn, settings.socialProofAr) && (
              <div className="hero-rise flex items-center gap-3 mt-9" style={{ ["--d" as string]: "360ms" }}>
                <div className="flex -space-x-2.5 rtl:space-x-reverse">
                  {["/images/users/user-01.jpg", "/images/users/user-02.jpg", "/images/users/user-03.jpg"].map((src, i) => (
                    <span key={i} className="relative w-9 h-9 rounded-full ring-2 ring-white overflow-hidden">
                      <Image src={src} alt="" fill sizes="36px" className="object-cover" />
                    </span>
                  ))}
                </div>
                <div className="text-start">
                  <div className="flex items-center gap-0.5 text-[#F5A524]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                        <path d="M8 .5l2.24 4.54 5.01.73-3.63 3.53.86 4.99L8 12.9l-4.48 2.36.86-4.99L.75 5.77l5.01-.73L8 .5z" />
                      </svg>
                    ))}
                  </div>
                  <p className={`text-xs mt-0.5 ${lightText ? "text-white/80" : "text-dark-4"}`}>{t(settings.socialProofEn, settings.socialProofAr)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Photo (split layout) */}
          {!fullbleed && !centered && slide.image && (
            <div className={`relative flex justify-center order-first ${slide.imageSide === "start" ? "md:order-first" : "md:order-last"}`}>
              <HeroPhoto slide={slide} accent={accent} priority={safeIndex === 0} alt={t(slide.titleEn, slide.titleAr)} />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-5 sm:bottom-7 z-10">
          <div className="max-w-[1170px] mx-auto px-4 sm:px-8 xl:px-0 flex items-center justify-center md:justify-start gap-6">
            <div className="flex items-center gap-2" role="tablist">
              {slides.map((s, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`${isArabic ? "الشريحة" : "Slide"} ${i + 1}`}
                  onClick={() => go(i)}
                  className={`relative h-1.5 rounded-full overflow-hidden transition-all duration-500 ${i === safeIndex ? "w-14" : "w-6 hover:w-8"} ${lightText ? "bg-white/30" : "bg-dark/10"}`}
                >
                  {i === safeIndex && (
                    <span
                      key={progressKey}
                      className="absolute inset-y-0 start-0 rounded-full hero-progress"
                      style={{
                        background: lightText ? "#fff" : accent,
                        animationDuration: `${settings.intervalMs}ms`,
                        animationPlayState: paused || !settings.autoplay ? "paused" : "running",
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
            {settings.showArrows && (
              <div className="hidden md:flex items-center gap-2">
                <ArrowBtn dir="prev" onClick={prev} light={lightText} label={isArabic ? "السابق" : "Previous"} />
                <ArrowBtn dir="next" onClick={next} light={lightText} label={isArabic ? "التالي" : "Next"} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ArrowBtn({ dir, onClick, light, label }: { dir: "prev" | "next"; onClick: () => void; light: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur transition-all duration-300 hover:scale-105 ${
        light ? "bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25" : "bg-white/70 text-dark ring-1 ring-dark/10 hover:bg-white shadow-sm"
      }`}
    >
      {/* Arrows point along the reading direction (mirrored in RTL). */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={dir === "prev" ? "-scale-x-100 rtl:scale-x-100" : "rtl:-scale-x-100"}>
        <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Arched photo frame with a gentle pointer parallax and slow zoom. */
function HeroPhoto({ slide, accent, priority, alt }: { slide: HeroSlide; accent: string; priority: boolean; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(hover: none)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        el.style.setProperty("--px", `${x * 14}px`);
        el.style.setProperty("--py", `${y * 14}px`);
        el.style.setProperty("--rx", `${-y * 4}deg`);
        el.style.setProperty("--ry", `${x * 5}deg`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={ref} className="hero-photo relative w-[230px] xsm:w-[260px] sm:w-[320px] lg:w-[400px] xl:w-[430px] aspect-[4/5]" style={{ perspective: "1200px" }}>
      {/* decorative rings */}
      <span aria-hidden className="absolute -inset-4 sm:-inset-6 rounded-t-full rounded-b-[44px] border" style={{ borderColor: `color-mix(in srgb, ${accent} 25%, transparent)` }} />

      <div className="hero-photo-inner relative w-full h-full rounded-t-full rounded-b-[40px] overflow-hidden shadow-[0_30px_60px_-30px_rgba(47,36,31,0.45)] ring-[6px] sm:ring-8 ring-white">
        <picture>
          {slide.mobileImage && <source media="(max-width: 767px)" srcSet={slide.mobileImage} />}
          <Image src={slide.image} alt={alt} fill priority={priority} sizes="(max-width: 640px) 260px, (max-width: 1024px) 320px, 430px" className="object-cover object-top hero-kenburns" />
        </picture>
      </div>
    </div>
  );
}
