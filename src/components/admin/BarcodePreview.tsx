"use client";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Renders `value` as a scannable Code128 barcode. Blank/invalid values render nothing. */
export default function BarcodePreview({
  value,
  className,
  height = 40,
}: {
  value: string;
  className?: string;
  height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!value.trim()) {
      el.replaceChildren();
      return;
    }
    try {
      JsBarcode(el, value, {
        format: "CODE128",
        displayValue: true,
        fontSize: 12,
        height,
        margin: 6,
      });
    } catch {
      el.replaceChildren();
    }
  }, [value, height]);

  return <svg ref={ref} className={className} />;
}
