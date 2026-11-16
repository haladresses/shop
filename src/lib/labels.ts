import { z } from "zod";

// Barcode sticker templates. Every size is in millimetres so the printout
// matches the physical label stock exactly:
//   • roll  — one label per page, for thermal label printers (Zebra, TSC,
//             Xprinter, Brother …). The page IS the label.
//   • sheet — a grid of labels on a page (A4 / Letter sticker sheets, or a
//             2-across label roll treated as a page per row).
// Calibration offsets shift everything to correct a printer that feeds a
// little off.

export type BarcodeFormat = "auto" | "EAN13" | "CODE128";

export type LabelTemplate = {
  id: string;
  name: string;
  /** Shipped with the app (read-only — duplicate it to change). */
  builtIn?: boolean;
  mode: "roll" | "sheet";
  /** Label size (mm). */
  labelW: number;
  labelH: number;
  /** Sheet only: page size, grid, distance from the page edge to the first label, gaps between labels (mm). */
  pageW: number;
  pageH: number;
  cols: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  gapX: number;
  gapY: number;
  /** Inner padding of each label (mm). */
  padding: number;
  /** Height of the bars (mm). */
  barcodeHeight: number;
  /** White space either side of the bars that scanners need (mm). */
  quietZone: number;
  /** Text size multiplier. */
  fontScale: number;
  barcodeFormat: BarcodeFormat;
  /** Calibration (mm): + moves everything right / down. */
  offsetX: number;
  offsetY: number;
};

const roll = (id: string, name: string, w: number, h: number, extra: Partial<LabelTemplate> = {}): LabelTemplate => ({
  id,
  name,
  builtIn: true,
  mode: "roll",
  labelW: w,
  labelH: h,
  pageW: w,
  pageH: h,
  cols: 1,
  rows: 1,
  marginTop: 0,
  marginLeft: 0,
  gapX: 0,
  gapY: 0,
  padding: h <= 25 ? 1.2 : 1.8,
  barcodeHeight: Math.round(h * 0.34 * 10) / 10,
  quietZone: 2,
  fontScale: 1,
  barcodeFormat: "auto",
  offsetX: 0,
  offsetY: 0,
  ...extra,
});

const sheet = (
  id: string,
  name: string,
  g: { labelW: number; labelH: number; cols: number; rows: number; marginTop: number; marginLeft: number; gapX: number; gapY: number; pageW?: number; pageH?: number },
): LabelTemplate => ({
  ...roll(id, name, g.labelW, g.labelH),
  mode: "sheet",
  pageW: g.pageW ?? 210,
  pageH: g.pageH ?? 297,
  cols: g.cols,
  rows: g.rows,
  marginTop: g.marginTop,
  marginLeft: g.marginLeft,
  gapX: g.gapX,
  gapY: g.gapY,
});

export const BUILT_IN_TEMPLATES: LabelTemplate[] = [
  roll("roll-50x30", "Label printer · 50 × 30 mm", 50, 30),
  roll("roll-40x30", "Label printer · 40 × 30 mm", 40, 30),
  roll("roll-40x25", "Label printer · 40 × 25 mm", 40, 25),
  roll("roll-38x25", "Label printer · 38 × 25 mm", 38, 25),
  roll("roll-58x40", "Label printer · 58 × 40 mm", 58, 40),
  roll("roll-60x40", "Label printer · 60 × 40 mm", 60, 40),
  roll("roll-30x20", "Label printer · 30 × 20 mm (small)", 30, 20, { padding: 0.8, barcodeHeight: 7, quietZone: 1.5, fontScale: 0.85 }),
  sheet("a4-21", "A4 sheet · 21 labels (63.5 × 38.1, e.g. L7160)", { labelW: 63.5, labelH: 38.1, cols: 3, rows: 7, marginTop: 15.15, marginLeft: 7.2, gapX: 2.5, gapY: 0 }),
  sheet("a4-24", "A4 sheet · 24 labels (63.5 × 33.9, e.g. L7159)", { labelW: 63.5, labelH: 33.9, cols: 3, rows: 8, marginTop: 12.9, marginLeft: 7.2, gapX: 2.5, gapY: 0 }),
  sheet("a4-40", "A4 sheet · 40 labels (48.5 × 25.4)", { labelW: 48.5, labelH: 25.4, cols: 4, rows: 10, marginTop: 21.5, marginLeft: 8, gapX: 0, gapY: 0 }),
  sheet("a4-65", "A4 sheet · 65 labels (38.1 × 21.2, e.g. L7651)", { labelW: 38.1, labelH: 21.2, cols: 5, rows: 13, marginTop: 10.7, marginLeft: 4.7, gapX: 2.5, gapY: 0 }),
];

export const PAGE_PRESETS = [
  { id: "a4", name: "A4 (210 × 297)", w: 210, h: 297 },
  { id: "letter", name: "Letter (215.9 × 279.4)", w: 215.9, h: 279.4 },
  { id: "a5", name: "A5 (148 × 210)", w: 148, h: 210 },
] as const;

export const LABEL_TEMPLATES_KEY = "label_templates_v1";

const mm = (min: number, max: number) => z.number().min(min).max(max);

export const labelTemplateSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().trim().min(1, "Give the template a name").max(80),
  mode: z.enum(["roll", "sheet"]),
  labelW: mm(10, 300),
  labelH: mm(8, 300),
  pageW: mm(10, 600),
  pageH: mm(8, 900),
  cols: z.number().int().min(1).max(20),
  rows: z.number().int().min(1).max(50),
  marginTop: mm(0, 200),
  marginLeft: mm(0, 200),
  gapX: mm(0, 100),
  gapY: mm(0, 100),
  padding: mm(0, 20),
  barcodeHeight: mm(3, 200),
  quietZone: mm(0, 15),
  fontScale: z.number().min(0.5).max(2.5),
  barcodeFormat: z.enum(["auto", "EAN13", "CODE128"]),
  offsetX: mm(-20, 20),
  offsetY: mm(-20, 20),
});

export const labelTemplatesSchema = z.object({
  templates: z.array(labelTemplateSchema).max(50),
  defaultId: z.string().max(60).nullable().optional(),
});

/** Where each label sits on its page (mm, from the page's top-left, calibration included). */
export function labelPositions(t: LabelTemplate): { x: number; y: number }[] {
  if (t.mode === "roll") return [{ x: t.offsetX, y: t.offsetY }];
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      out.push({
        x: t.marginLeft + c * (t.labelW + t.gapX) + t.offsetX,
        y: t.marginTop + r * (t.labelH + t.gapY) + t.offsetY,
      });
    }
  }
  return out;
}

export function labelsPerPage(t: LabelTemplate): number {
  return t.mode === "roll" ? 1 : t.cols * t.rows;
}

export function pageSize(t: LabelTemplate): { w: number; h: number } {
  return t.mode === "roll" ? { w: t.labelW, h: t.labelH } : { w: t.pageW, h: t.pageH };
}

/** Problems that would make the printout wrong (shown before printing). */
export function templateProblems(t: LabelTemplate): string[] {
  const p: string[] = [];
  if (t.mode === "sheet") {
    const usedW = t.marginLeft + t.cols * t.labelW + (t.cols - 1) * t.gapX;
    const usedH = t.marginTop + t.rows * t.labelH + (t.rows - 1) * t.gapY;
    if (usedW > t.pageW + 0.05) p.push(`The labels need ${usedW.toFixed(1)} mm across but the page is ${t.pageW} mm wide.`);
    if (usedH > t.pageH + 0.05) p.push(`The labels need ${usedH.toFixed(1)} mm down but the page is ${t.pageH} mm tall.`);
  }
  if (t.barcodeHeight + 2 * t.padding > t.labelH) p.push("The barcode is taller than the label.");
  if (t.labelW - 2 * t.padding - 2 * t.quietZone < 15) p.push("The label is too narrow for a readable barcode. Reduce padding / quiet zone or use a wider label.");
  return p;
}

export function newTemplateFrom(base: LabelTemplate, name: string): LabelTemplate {
  const { builtIn: _builtIn, ...rest } = base;
  void _builtIn;
  return { ...rest, id: `custom-${Date.now().toString(36)}`, name };
}
