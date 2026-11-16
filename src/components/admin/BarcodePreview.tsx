"use client";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * Renders `value` as a scannable Code128 barcode (blank/invalid values render
 * nothing). Bars are explicitly black on white — never inherited colours —
 * so they print, and the SVG gets a viewBox so it scales to whatever box the
 * label gives it without being clipped.
 */
export default function BarcodePreview({
  value,
  className,
  height = 40,
  barWidth = 2,
  fontSize = 12,
  displayValue = true,
  margin = 6,
}: {
  value: string;
  className?: string;
  height?: number;
  /** Width of the thinnest bar in SVG units (scaled to fit when printed). */
  barWidth?: number;
  fontSize?: number;
  displayValue?: boolean;
  margin?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!value.trim()) {
      el.replaceChildren();
      el.removeAttribute("viewBox");
      return;
    }
    try {
      JsBarcode(el, value, {
        format: "CODE128",
        displayValue,
        fontSize,
        height,
        width: barWidth,
        margin,
        background: "#ffffff",
        lineColor: "#000000",
        font: "monospace",
      });
      const w = parseFloat(el.getAttribute("width") || "0");
      const h = parseFloat(el.getAttribute("height") || "0");
      if (w && h) {
        el.setAttribute("viewBox", `0 0 ${w} ${h}`);
        el.setAttribute("preserveAspectRatio", "xMidYMid meet");
        // Let CSS size it (width:100% / fixed label height) while keeping proportions.
        el.removeAttribute("width");
        el.removeAttribute("height");
      }
    } catch {
      el.replaceChildren();
      el.removeAttribute("viewBox");
    }
  }, [value, height, barWidth, fontSize, displayValue, margin]);

  return <svg ref={ref} className={className} style={{ display: "block", maxWidth: "100%" }} />;
}
