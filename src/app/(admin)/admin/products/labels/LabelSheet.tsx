"use client";
import BarcodePreview from "@/components/admin/BarcodePreview";
import type { PrintPage } from "@/lib/print";

// Barcode label layouts. Sizes are real millimetres so what prints matches
// the label stock: A4 sheets (Avery-style) or one label per page on a
// thermal label printer roll.

export type LabelLayoutId = "a4-21" | "a4-40" | "roll-50x30" | "roll-40x25" | "roll-58x40";

export type LabelLayout = {
  id: LabelLayoutId;
  name: string;
  hint: string;
  /** Label size in mm. */
  w: number;
  h: number;
  /** Sheet layouts: labels per row and the gap between them (mm). */
  cols?: number;
  gapX?: number;
  gapY?: number;
  page: PrintPage;
};

export const LABEL_LAYOUTS: LabelLayout[] = [
  { id: "a4-21", name: "A4 sheet · 21 labels", hint: "3 × 7, 63.5 × 38.1 mm (e.g. L7160)", w: 63.5, h: 38.1, cols: 3, gapX: 2.5, gapY: 0, page: { size: "A4 portrait", margin: "15mm 7mm 0 7mm" } },
  { id: "a4-40", name: "A4 sheet · 40 labels", hint: "4 × 10, 48.5 × 25.4 mm", w: 48.5, h: 25.4, cols: 4, gapX: 0, gapY: 0, page: { size: "A4 portrait", margin: "21.5mm 8mm 0 8mm" } },
  { id: "roll-50x30", name: "Label printer · 50 × 30 mm", hint: "One label per page", w: 50, h: 30, page: { size: "50mm 30mm", margin: "0" } },
  { id: "roll-40x25", name: "Label printer · 40 × 25 mm", hint: "One label per page", w: 40, h: 25, page: { size: "40mm 25mm", margin: "0" } },
  { id: "roll-58x40", name: "Label printer · 58 × 40 mm", hint: "One label per page", w: 58, h: 40, page: { size: "58mm 40mm", margin: "0" } },
];

export type LabelOptions = {
  showName: boolean;
  showArabic: boolean;
  showVariant: boolean;
  showPrice: boolean;
  showSku: boolean;
  /** Show the original price struck through when on sale. */
  showWasPrice: boolean;
  /** "incl. VAT" note under the price. */
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

export function Label({ item, layout, opts }: { item: LabelItem; layout: LabelLayout; opts: LabelOptions }) {
  const small = layout.h < 28;
  const onSale = opts.showWasPrice && item.basePrice > item.price + 0.0005;
  return (
    <div
      className="bg-white text-black overflow-hidden flex flex-col items-center justify-between text-center"
      style={{
        width: `${layout.w}mm`,
        height: `${layout.h}mm`,
        padding: small ? "1mm 1.5mm" : "1.5mm 2mm",
        fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif',
        lineHeight: 1.15,
        boxSizing: "border-box",
      }}
    >
      <div className="w-full min-w-0">
        {opts.storeName && !small && <div style={{ fontSize: "5.5pt", letterSpacing: "0.04em" }} className="uppercase truncate">{opts.storeName}</div>}
        {opts.showName && <div className="font-bold truncate" style={{ fontSize: small ? "6.5pt" : "7.5pt" }}>{item.nameEn}</div>}
        {opts.showArabic && item.nameAr && (
          <div dir="rtl" className="truncate" style={{ fontSize: small ? "6.5pt" : "7.5pt" }}>{item.nameAr}</div>
        )}
        {opts.showVariant && item.variantLabel && <div className="truncate" style={{ fontSize: "6pt" }}>{item.variantLabel}</div>}
      </div>
      <div className="w-full flex-1 min-h-0 flex items-center justify-center" style={{ padding: "0.5mm 0" }}>
        <BarcodePreview value={item.barcode} className="w-full h-full" height={small ? 34 : 44} barWidth={2} fontSize={small ? 11 : 13} margin={2} />
      </div>
      <div className="w-full flex items-end justify-between gap-1" style={{ fontSize: small ? "6pt" : "6.5pt" }}>
        <span className="truncate">{opts.showSku && item.sku ? item.sku : ""}</span>
        {opts.showPrice && (
          <span className="shrink-0 text-right">
            {onSale && <span style={{ textDecoration: "line-through", marginRight: "1mm" }}>{item.basePrice.toFixed(3)}</span>}
            <span className="font-bold" style={{ fontSize: small ? "8pt" : "9.5pt" }}>{item.price.toFixed(3)}</span>
            <span> OMR</span>
            {opts.vatNote && <span style={{ display: "block", fontSize: "5pt" }}>incl. VAT · شامل الضريبة</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/** The whole print job: every copy of every label, laid out for the chosen stock. */
export function LabelSheet({ items, layout, opts }: { items: LabelItem[]; layout: LabelLayout; opts: LabelOptions }) {
  if (layout.cols) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${layout.cols}, ${layout.w}mm)`,
          columnGap: `${layout.gapX ?? 0}mm`,
          rowGap: `${layout.gapY ?? 0}mm`,
        }}
      >
        {items.map((it, i) => (
          <div key={`${it.key}-${i}`} className="print-avoid-break">
            <Label item={it} layout={layout} opts={opts} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      {items.map((it, i) => (
        <div key={`${it.key}-${i}`} className={i < items.length - 1 ? "print-page-break" : ""}>
          <Label item={it} layout={layout} opts={opts} />
        </div>
      ))}
    </div>
  );
}
