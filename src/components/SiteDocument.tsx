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
  footerClassName?: string;
  footer?: ReactNode;
};

export default function SiteDocument({
  head,
  children,
  bodyClassName,
  footerClassName = "",
  footer = (
    <footer
      className={`border-t border-gray-3 bg-white px-4 py-3 text-center print:hidden ${footerClassName}`}
    >
      <SbcCredit />
    </footer>
  ),
  ...htmlAttributes
}: SiteDocumentProps) {
  return (
    <html {...htmlAttributes} data-sbc-site={siteId}>
      {/* eslint-disable-next-line @next/next/no-head-element -- Shared by the App Router root layouts. */}
      <head>
        {head}
        <meta name="generator" content="SBC — sbc.om" />
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
