"use client";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export type BarcodeRenderFormat = "auto" | "EAN13" | "CODE128";

const isEan13 = (v: string) => {
  if (!/^\d{13}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(v[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(v[12]);
};

/** The symbology actually used for a value ("auto" = EAN-13 when the code is a valid EAN-13, else Code 128). */
export function resolveBarcodeFormat(value: string, format: BarcodeRenderFormat = "auto"): "EAN13" | "CODE128" {
  if (format === "CODE128") return "CODE128";
  return isEan13(value.trim()) ? "EAN13" : "CODE128";
}

/**
 * Renders `value` as a scannable barcode (blank/invalid values render
 * nothing). Bars are explicitly black on white — never inherited colours —
 * so they print.
 *  • default: keeps proportions and scales to fit its box, digits included.
 *  • stretch: bars only, filling the box exactly (for labels sized in mm —
 *    stretching keeps every bar's width ratio, so it stays scannable). Put
 *    the human-readable digits under it yourself.
 */
export default function BarcodePreview({
  value,
  className,
  height = 40,
  barWidth = 2,
  fontSize = 12,
  displayValue = true,
  margin = 6,
  format = "auto",
  stretch = false,
  onModules,
}: {
  value: string;
  className?: string;
  height?: number;
  /** Width of the thinnest bar in SVG units (scaled to fit when printed). */
  barWidth?: number;
  fontSize?: number;
  displayValue?: boolean;
  margin?: number;
  format?: BarcodeRenderFormat;
  stretch?: boolean;
  /** Reports how many modules (thinnest-bar widths) the symbol spans, for density checks. */
  onModules?: (modules: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const v = value.trim();
    if (!v) {
      el.replaceChildren();
      el.removeAttribute("viewBox");
      return;
    }
    const fmt = resolveBarcodeFormat(v, format);
    try {
      JsBarcode(el, fmt === "EAN13" ? v.slice(0, 12) : v, {
        format: fmt,
        displayValue: stretch ? false : displayValue,
        flat: stretch,
        fontSize,
        height,
        width: barWidth,
        margin: stretch ? 0 : margin,
        background: "#ffffff",
        lineColor: "#000000",
        font: "monospace",
      });
      const w = parseFloat(el.getAttribute("width") || "0");
      const h = parseFloat(el.getAttribute("height") || "0");
      if (w && h) {
        el.setAttribute("viewBox", `0 0 ${w} ${h}`);
        el.setAttribute("preserveAspectRatio", stretch ? "none" : "xMidYMid meet");
        el.setAttribute("shape-rendering", "crispEdges");
        // Let CSS size it (label box in mm, or width:100%).
        el.removeAttribute("width");
        el.removeAttribute("height");
        onModules?.((w - (stretch ? 0 : 2 * margin)) / barWidth);
      }
    } catch {
      el.replaceChildren();
      el.removeAttribute("viewBox");
    }
  }, [value, height, barWidth, fontSize, displayValue, margin, format, stretch, onModules]);

  return <svg ref={ref} className={className} style={{ display: "block", maxWidth: "100%" }} />;
}
