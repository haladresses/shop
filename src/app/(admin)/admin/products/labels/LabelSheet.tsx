"use client";
import type { ReactNode } from "react";
import BarcodePreview from "@/components/admin/BarcodePreview";
import { labelPositions, labelsPerPage, pageSize, type LabelTemplate } from "@/lib/labels";

// Barcode stickers laid out in real millimetres. Each page is exactly the
// template's page size and every label is placed absolutely, so nothing
// drifts from label to label or page to page.

export type LabelOptions = {
  showName: boolean;
  showArabic: boolean;
  showVariant: boolean;
  showPrice: boolean;
  showSku: boolean;
  /** Human-readable digits under the bars. */
  showDigits: boolean;
  /** Original price struck through when on sale. */
  showWasPrice: boolean;
  /** "incl. VAT" under the price. */
  vatNote: boolean;
  storeName: string;
};

export type LabelItem = {
  key: string;
  nameEn: string;
  nameAr: string;
  variantLabel: string;
  sku: string | null;
  barcode: string;
  price: number;
  basePrice: number;
};

const FONT = 'Vazirmatn, Inter, SBC, Tahoma, "Segoe UI", Arial, sans-serif';
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

const PT_MM = 25.4 / 72;
const LINE = 1.12;

export function Label({ item, t, opts }: { item: LabelItem; t: LabelTemplate; opts: LabelOptions }) {
  // Text scales with the label height and the template's text size setting.
  const s = t.fontScale * clamp(t.labelH / 30, 0.72, 1.3);
  const pt = (n: number) => `${(n * s).toFixed(2)}pt`;
  const lineMm = (n: number) => n * s * PT_MM * LINE;
  const onSale = opts.showWasPrice && item.basePrice > item.price + 0.0005;
  const hasFooter = !!((opts.showSku && item.sku) || opts.showPrice);

  // Fit whole text lines into the space above the bars — never cut a line in
  // half. Least important lines go first when space is short.
  const digitsMm = opts.showDigits ? lineMm(6.2) + 0.3 : 0;
  const footerMm = hasFooter ? lineMm(opts.showPrice ? 8.5 : 5.6) + (opts.showPrice && opts.vatNote ? lineMm(4.6) : 0) + 0.4 : 0;
  let room = t.labelH - 2 * t.padding - t.barcodeHeight - digitsMm - footerMm;
  type Line = { key: string; size: number; node: ReactNode };
  const candidates = ([
    opts.showName ? { key: "name", size: 7, node: <span style={{ fontWeight: 700 }}>{item.nameEn}</span> } : null,
    opts.showVariant && item.variantLabel ? { key: "variant", size: 5.8, node: item.variantLabel } : null,
    opts.showArabic && item.nameAr ? { key: "ar", size: 7, node: <span dir="rtl">{item.nameAr}</span> } : null,
    opts.storeName ? { key: "store", size: 5, node: <span style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>{opts.storeName}</span> } : null,
  ] as (Line | null)[]).filter((l): l is Line => !!l);
  const fits = new Set<string>();
  for (const l of candidates) {
    const h = lineMm(l.size);
    if (h <= room + 0.05) {
      fits.add(l.key);
      room -= h;
    }
  }
  const order = ["store", "name", "ar", "variant"];
  const lines = candidates.filter((l) => fits.has(l.key)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <div
      style={{
        width: `${t.labelW}mm`,
        height: `${t.labelH}mm`,
        padding: `${t.padding}mm`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        color: "#000",
        fontFamily: FONT,
        lineHeight: LINE,
        textAlign: "center",
      }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {lines.map((l) => (
          <div key={l.key} style={{ fontSize: pt(l.size), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.node}</div>
        ))}
      </div>
      <div style={{ flex: "none", height: `${t.barcodeHeight}mm`, padding: `0 ${t.quietZone}mm`, boxSizing: "border-box" }}>
        <BarcodePreview value={item.barcode} format={t.barcodeFormat} stretch className="w-full h-full" />
      </div>
      {opts.showDigits && (
        <div style={{ flex: "none", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: pt(6.2), letterSpacing: "0.12em", marginTop: "0.3mm" }}>{item.barcode}</div>
      )}
      {hasFooter && (
        <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1mm", fontSize: pt(5.6), marginTop: "0.4mm" }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opts.showSku && item.sku ? item.sku : ""}</span>
          {opts.showPrice && (
            <span style={{ flex: "none", textAlign: "right" }}>
              {onSale && <span style={{ textDecoration: "line-through", marginRight: "1mm" }}>{item.basePrice.toFixed(3)}</span>}
              <span style={{ fontWeight: 700, fontSize: pt(8.5) }}>{item.price.toFixed(3)}</span>
              <span> OMR</span>
              {opts.vatNote && <span style={{ display: "block", fontSize: pt(4.6) }}>incl. VAT · شامل الضريبة</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Outline({ t, n, preview }: { t: LabelTemplate; n: number; preview?: boolean }) {
  return (
    <div
      style={{
        width: `${t.labelW}mm`,
        height: `${t.labelH}mm`,
        boxSizing: "border-box",
        border: preview ? "0.25mm dashed #cbd5e1" : "0.2mm solid #000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontSize: "7pt",
        color: preview ? "#94a3b8" : "#000",
      }}
    >
      {n}
    </div>
  );
}

type Slot = LabelItem | null;

function buildPages(t: LabelTemplate, items: LabelItem[], startAt: number, testPage: boolean): Slot[][] {
  const per = labelsPerPage(t);
  const slots: Slot[] = testPage
    ? Array.from({ length: per }, () => null)
    : [...Array.from({ length: t.mode === "sheet" ? Math.max(0, Math.min(per - 1, startAt - 1)) : 0 }, () => null), ...items];
  const pages: Slot[][] = [];
  for (let i = 0; i < slots.length; i += per) pages.push(slots.slice(i, i + per));
  return pages;
}

/** The whole print job: every page at its exact size, labels at exact positions. */
export function LabelPrintJob({
  items,
  t,
  opts,
  startAt = 1,
  outlines = false,
  testPage = false,
}: {
  items: LabelItem[];
  t: LabelTemplate;
  opts: LabelOptions;
  /** Sheet mode: first free position on a partly used sheet (1-based). */
  startAt?: number;
  /** Draw each label's outline (for checking alignment). */
  outlines?: boolean;
  /** Only numbered outlines, no content — to check alignment on plain paper. */
  testPage?: boolean;
}) {
  const { w, h } = pageSize(t);
  const positions = labelPositions(t);
  const pages = buildPages(t, items, startAt, testPage);
  return (
    <div>
      {pages.map((page, pi) => (
        <div
          key={pi}
          className={pi < pages.length - 1 ? "print-page-break" : ""}
          style={{ position: "relative", width: `${w}mm`, height: `${h}mm`, overflow: "hidden", background: "#fff" }}
        >
          {page.map((item, i) => (
            <div key={i} style={{ position: "absolute", left: `${positions[i].x}mm`, top: `${positions[i].y}mm` }}>
              {item ? (
                <div style={{ position: "relative" }}>
                  <Label item={item} t={t} opts={opts} />
                  {outlines && <div style={{ position: "absolute", inset: 0, border: "0.2mm solid #000", pointerEvents: "none" }} />}
                </div>
              ) : testPage ? (
                <Outline t={t} n={pi * labelsPerPage(t) + i + 1} />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const PX_PER_MM = 96 / 25.4;

/** On-screen, to-scale preview of the first page (label slots outlined). */
export function PagePreview({
  items,
  t,
  opts,
  startAt = 1,
  widthPx,
}: {
  items: LabelItem[];
  t: LabelTemplate;
  opts: LabelOptions;
  startAt?: number;
  widthPx: number;
}) {
  const { w, h } = pageSize(t);
  const scale = Math.min(widthPx / (w * PX_PER_MM), (t.mode === "roll" ? 260 : 520) / (h * PX_PER_MM));
  const positions = labelPositions(t);
  const first = buildPages(t, items, startAt, false)[0] ?? [];
  return (
    <div style={{ width: w * PX_PER_MM * scale, height: h * PX_PER_MM * scale }} className="mx-auto">
      <div
        style={{ width: `${w}mm`, height: `${h}mm`, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative", background: "#fff", boxShadow: "0 0 0 1px #e2e8f0, 0 4px 14px rgb(15 23 42 / 0.08)" }}
      >
        {positions.map((pos, i) => (
          <div key={i} style={{ position: "absolute", left: `${pos.x}mm`, top: `${pos.y}mm` }}>
            {first[i] ? <Label item={first[i]!} t={t} opts={opts} /> : <Outline t={t} n={i + 1} preview />}
          </div>
        ))}
      </div>
    </div>
  );
}
