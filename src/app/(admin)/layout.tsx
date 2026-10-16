"use client";
import "../css/style.css";
import "./admin.css";
import SiteDocument from "@/components/SiteDocument";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteDocument
      lang="en"
      head={
        <>
          <title>Admin Panel | Hala Dresses</title>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link rel="icon" type="image/svg+xml" href="/logo.svg" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="theme-color" content="#8C3B49" />
        </>
      }
    >
      {children}
    </SiteDocument>
  );
}
