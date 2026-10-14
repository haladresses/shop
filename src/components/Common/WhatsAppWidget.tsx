"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeWhatsApp, waLink, WhatsAppWidgetConfig } from "@/lib/whatsapp";

const SEEN_KEY = "hala-wa-greeted";

/**
 * Floating WhatsApp chat button with a greeting card. Fully driven by admin
 * settings; the greeting pops up once per session after the configured delay.
 * On product pages the pre-filled message includes the product link.
 */
export default function WhatsAppWidget() {
  const { isArabic } = useLanguage();
  const pathname = usePathname();
  const [cfg, setCfg] = useState<WhatsAppWidgetConfig | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/whatsapp-widget")
      .then((r) => r.json())
      .then((d) => d.success && setCfg(normalizeWhatsApp(d.data)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cfg?.enabled || !cfg.autoOpenSeconds) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    if (seen) return;
    const t = setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* storage blocked */
      }
    }, cfg.autoOpenSeconds * 1000);
    return () => clearTimeout(t);
  }, [cfg]);

  if (!cfg?.enabled) return null;

  const t = (en: string, ar: string) => (isArabic ? ar || en : en || ar);
  const onProduct = pathname?.startsWith("/shop-details");
  const startChat = () => {
    let text = t(cfg.prefillEn, cfg.prefillAr);
    if (onProduct && typeof window !== "undefined") {
      const name = document.querySelector("h1")?.textContent?.trim();
      text += `\n\n${isArabic ? "المنتج" : "Product"}: ${name ? `${name} — ` : ""}${window.location.href}`;
    }
    window.open(waLink(cfg.phone, text), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const side = cfg.position === "start" ? "start-4 sm:start-6" : "end-4 sm:end-6";
  // Clear the mobile bottom bar / sticky buy bar.
  const bottom = onProduct ? "bottom-[104px] lg:bottom-6" : "bottom-[84px] lg:bottom-6";

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className={`fixed z-[9985] ${side} ${bottom} ${cfg.showOnMobile ? "" : "hidden lg:block"} print:hidden`}
    >
      {open && (
        <div
          role="dialog"
          aria-label="WhatsApp"
          className={`wa-card absolute bottom-[72px] ${cfg.position === "start" ? "start-0" : "end-0"} w-[min(340px,calc(100vw-2rem))] rounded-3xl overflow-hidden bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,.35)] ring-1 ring-black/5`}
        >
          <div className="flex items-center gap-3 bg-[#075E54] text-white px-4 py-3.5">
            <span className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
              <Image src="/logo.svg" alt="" width={30} height={30} />
              <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-[#25D366] ring-2 ring-[#075E54]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight truncate">{t(cfg.nameEn, cfg.nameAr)}</p>
              <p className="text-xs text-white/75 truncate">{t(cfg.statusEn, cfg.statusAr)}</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label={isArabic ? "إغلاق" : "Close"} className="p-1.5 -m-1 rounded-full hover:bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="px-4 py-5 bg-[#ECE5DD]">
            <div className="wa-bubble relative max-w-[88%] rounded-2xl rounded-ss-sm bg-white px-3.5 py-2.5 text-sm text-dark shadow-sm whitespace-pre-line">
              {t(cfg.greetingEn, cfg.greetingAr)}
              <span className="block text-end text-[10px] text-dark-4 mt-1">
                {new Date().toLocaleTimeString(isArabic ? "ar-OM" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <div className="p-3 bg-white">
            <button onClick={startChat} className="w-full h-12 rounded-full bg-[#25D366] hover:bg-[#1ebe5a] text-white font-semibold flex items-center justify-center gap-2 transition-colors">
              <WaIcon size={20} /> {isArabic ? "ابدئي المحادثة" : "Start chat"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={isArabic ? "تواصلي معنا على واتساب" : "Chat with us on WhatsApp"}
        aria-expanded={open}
        className="wa-fab relative w-14 h-14 rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,.7)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {!open && <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25" />}
        <span className={`relative transition-transform duration-300 ${open ? "rotate-90" : ""}`}>
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          ) : (
            <WaIcon size={28} />
          )}
        </span>
      </button>
    </div>
  );
}

function WaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.42 9.42 0 01-4.8-1.31l-.35-.2-3.57.93.95-3.48-.22-.36A9.44 9.44 0 1121.5 12.05a9.44 9.44 0 01-9.45 9.45zm8.04-17.49A11.3 11.3 0 0012.05.69C5.78.69.68 5.79.68 12.05c0 2 .52 3.96 1.52 5.68L.6 23.31l5.71-1.5a11.33 11.33 0 005.74 1.46c6.26 0 11.36-5.1 11.36-11.36 0-3.04-1.18-5.89-3.32-8.04z" />
    </svg>
  );
}
