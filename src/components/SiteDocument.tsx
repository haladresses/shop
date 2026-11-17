import type { ComponentPropsWithoutRef, ReactNode } from "react";

const siteId = "hala-dresses";
const siteDomain = "hala-dresses.com";

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Hala Dresses",
  url: `https://${siteDomain}`,
  creator: {
    "@type": "Organization",
    name: "SBC",
    url: "https://sbc.om",
  },
};

export function SbcCredit({ className = "" }: { className?: string }) {
  return (
    <p lang="en" dir="ltr" className={`text-xs text-dark-4 ${className}`}>
      Designed &amp; built by{" "}
      <a
        href={`https://sbc.om/?utm_source=${siteDomain}&utm_medium=referral&utm_campaign=footer-credit`}
        target="_blank"
        rel="noopener"
        className="hover:text-blue"
      >
        SBC
      </a>
    </p>
  );
}

type SiteDocumentProps = Omit<ComponentPropsWithoutRef<"html">, "children"> & {
  head: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  /** Rendered after the page content. None by default — the "Designed & built by" credit only appears on the storefront home page (see components/Footer). */
  footer?: ReactNode;
};

export default function SiteDocument({
  head,
  children,
  bodyClassName,
  footer = null,
  ...htmlAttributes
}: SiteDocumentProps) {
  return (
    <html {...htmlAttributes} data-sbc-site={siteId}>
      {/* eslint-disable-next-line @next/next/no-head-element -- Shared by the App Router root layouts. */}
      <head>
        {head}
        {/* Arabic typeface (Vazirmatn) — preloaded so Arabic text never flashes in a fallback font. */}
        <link rel="preload" href="/fonts/vazirmatn/Vazirmatn-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* English typeface (Inter), Latin characters only. */}
        <link rel="preload" href="/fonts/inter/Inter-Variable-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <meta name="generator" content="SBC (sbc.om)" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
        />
      </head>
      <body className={bodyClassName}>
        {children}
        {footer}
      </body>
    </html>
  );
}
