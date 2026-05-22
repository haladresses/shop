"use client";
import { useRef, useState, useEffect } from "react";
import { useLanguage } from "@/app/context/LanguageContext";

const langs = [
  { code: "en" as const, label: "English", short: "EN" },
  { code: "ar" as const, label: "عربي", short: "عربي" },
];

const LanguageDropdown = () => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = langs.find((l) => l.code === language) ?? langs[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border transition-all duration-200 ${
          open
            ? "border-blue/40 bg-white shadow-sm text-blue"
            : "border-gray-3 bg-gray-1 hover:bg-white hover:border-gray-4 hover:shadow-sm text-dark-4"
        }`}
      >
        {/* Globe */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 2.75C12 2.75 8.5 7 8.5 12C8.5 17 12 21.25 12 21.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 2.75C12 2.75 15.5 7 15.5 12C15.5 17 12 21.25 12 21.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.75 12H21.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 7.5H20" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 16.5H20" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <span className="text-xs font-semibold text-dark">{current.short}</span>

        {/* Chevron */}
        <svg
          className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          width="10" height="6" viewBox="0 0 10 6" fill="none"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Panel */}
      <div
        className={`absolute top-full mt-1.5 end-0 w-36 bg-white rounded-xl border border-gray-3 shadow-2 py-1 z-[99999] overflow-hidden transition-all duration-200 origin-top-end ${
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {langs.map((lang) => {
          const active = language === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors duration-150 ${
                active ? "bg-blue/5 text-blue font-semibold" : "text-dark-3 hover:bg-gray-1 hover:text-dark"
              }`}
            >
              <span className="flex-1 text-start">{lang.label}</span>
              {active && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                  <path d="M1.5 6L4.5 9L10.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageDropdown;
