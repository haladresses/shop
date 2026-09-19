"use client";
import "../css/style.css";

export default function PosRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>POS | Hala Dresses</title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="theme-color" content="#8C3B49" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-slate-100">{children}</body>
    </html>
  );
}
