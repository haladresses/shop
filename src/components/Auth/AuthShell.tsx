"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLanguage } from "@/app/context/LanguageContext";

const ThreeBackdrop = dynamic(() => import("@/components/Common/ThreeBackdrop"), { ssr: false });

/**
 * Shared frame for sign-in / sign-up: an animated Hala logo panel on large
 * screens (solid colour + floating petals) and a focused single-column form.
 */
export default function AuthShell({
  title,
  subtitle,
  quote,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  image?: string;
  quote: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { isArabic } = useLanguage();
  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="pt-[73px] xl:pt-[125px] bg-white">
      <div className="border-t border-gray-3">
        <div className="max-w-[1170px] mx-auto lg:px-8 xl:px-0 lg:py-12">
          <div className="grid lg:grid-cols-[1fr_1fr] lg:rounded-[28px] lg:overflow-hidden lg:ring-1 lg:ring-gray-3 min-h-[calc(100dvh-140px)] lg:min-h-[640px]">
            {/* Brand panel — large screens */}
            <div className="relative hidden lg:flex flex-col items-center justify-center overflow-hidden bg-[#F4EDE8]">
              <ThreeBackdrop effect="particles" from="#F4EDE8" to="#F4EDE8" accent="#8C3B49" />
              <AnimatedLogo size={150} />
              <p className="relative mt-10 text-xl font-semibold text-dark text-center leading-snug max-w-[340px] auth-quote">{quote}</p>
            </div>

            {/* Form */}
            <div className="flex items-start lg:items-center justify-center px-5 sm:px-10 py-10 sm:py-14">
              <div className="w-full max-w-[400px] auth-in">
                <Link href="/" className="flex justify-center sm:justify-start mb-8 lg:hidden" aria-label="Hala Dresses">
                  <AnimatedLogo size={64} compact />
                </Link>
                <h1 className="text-[28px] sm:text-[32px] font-semibold text-dark leading-tight tracking-tight">{title}</h1>
                <p className="mt-2 text-dark-4">{subtitle}</p>
                <div className="mt-8">{children}</div>
                <div className="mt-8 text-center text-sm text-dark-4">{footer}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const inputCls =
  "w-full h-[52px] rounded-2xl border border-gray-3 bg-white px-4 text-[16px] text-dark placeholder:text-dark-5 outline-none transition focus:border-dark focus:ring-4 focus:ring-dark/5";

export function AuthField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-2 text-sm font-medium text-dark">
        {label}
        {hint}
      </span>
      <input {...props} className={inputCls} />
    </label>
  );
}

export function PasswordField({
  label,
  hint,
  showLabel,
  hideLabel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode; showLabel: string; hideLabel: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-2 text-sm font-medium text-dark">
        {label}
        {hint}
      </span>
      {/* Same direction as the input, so the eye button sits on the padded side. */}
      <span className="relative block" dir={props.dir}>
        <input {...props} type={show ? "text" : "password"} className={`${inputCls} pe-12`} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? hideLabel : showLabel}
          className="absolute end-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-dark-4 hover:text-dark hover:bg-gray-1"
        >
          {show ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10 10 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.4 8 2.9 10.2 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="pos-shake mb-5 flex items-start gap-2.5 rounded-2xl bg-red-light-6 text-red-dark px-4 py-3 text-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-px" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7.5v5.5M12 16.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {message}
    </div>
  );
}

export function AuthSubmit({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="fx-press w-full h-[52px] rounded-full bg-dark text-white font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-blue disabled:opacity-70 disabled:cursor-wait"
    >
      {loading && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
      {children}
    </button>
  );
}

/** Hala logo with a gentle float, breathing rings and a soft entrance. */
function AnimatedLogo({ size, compact = false }: { size: number; compact?: boolean }) {
  const ring = size * (compact ? 1.5 : 1.7);
  return (
    <div className="relative flex items-center justify-center" style={{ width: ring, height: ring }} aria-hidden={compact ? undefined : true}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="logo-ring absolute inset-0 rounded-full border border-[#8C3B49]/25"
          style={{ animationDelay: `${i * 1.2}s` }}
        />
      ))}
      <span className="absolute rounded-full bg-white shadow-[0_20px_50px_-20px_rgba(140,59,73,.45)]" style={{ width: size * 1.15, height: size * 1.15 }} />
      <span className="logo-float relative">
        <Image src="/logo.svg" alt="Hala Dresses" width={size} height={size} priority className="logo-draw" style={{ width: size * 0.8, height: size * 0.8 }} />
      </span>
    </div>
  );
}
