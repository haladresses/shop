"use client";
import "../css/style.css";
import SiteDocument from "@/components/SiteDocument";

export default function PosRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteDocument
      lang="en"
      bodyClassName="bg-slate-100"
      footerClassName="pb-24 lg:pb-3"
      head={
        <>
          <title>POS | Hala Dresses</title>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <meta name="theme-color" content="#8C3B49" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1"
          />
        </>
      }
    >
      {children}
    </SiteDocument>
  );
}
