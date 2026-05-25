"use client";
import "../css/style.css";
import "./seller.css";

export default function SellerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
