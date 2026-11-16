"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Printable content, kept out of the page layout: it is rendered (hidden)
 * directly under <body> and only shown while `printArea(id)` is printing —
 * so scroll containers, sidebars and overflow-hidden wrappers can never
 * clip or blank it. Render your on-screen preview separately.
 */
export default function PrintArea({
  id,
  children,
  className = "",
  dir,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  dir?: "ltr" | "rtl";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className={`print-root ${className}`} data-print-id={id} dir={dir}>
      {children}
    </div>,
    document.body,
  );
}
