"use client";
import { PAGE_PRESETS, type LabelTemplate } from "@/lib/labels";

// Every measurement of a sticker template, in millimetres.

function Num({
  label,
  value,
  onChange,
  step = 0.1,
  min = 0,
  suffix = "mm",
  disabled,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="block min-w-0" title={hint}>
      <span className="block text-[11px] font-medium text-slate-500 mb-1 truncate">{label}</span>
      <span className="flex items-center rounded-lg border border-slate-200 bg-white focus-within:border-indigo-300">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none disabled:text-slate-400"
        />
        {suffix && <span className="pr-2 text-[11px] text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
    {children}
  </div>
);

export default function TemplateEditor({
  t,
  onChange,
  disabled,
}: {
  t: LabelTemplate;
  onChange: (t: LabelTemplate) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof LabelTemplate>(k: K, v: LabelTemplate[K]) => onChange({ ...t, [k]: v });
  const presetId = PAGE_PRESETS.find((p) => Math.abs(p.w - t.pageW) < 0.05 && Math.abs(p.h - t.pageH) < 0.05)?.id ?? "custom";

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 mb-1">Template name</span>
        <input className="admin-input !py-1.5 text-sm" value={t.name} disabled={disabled} onChange={(e) => set("name", e.target.value)} />
      </label>

      <Section title="Printer type">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["roll", "Label printer (roll)", "One sticker per page"],
              ["sheet", "Sticker sheet", "A4 / Letter / multi-across"],
            ] as const
          ).map(([mode, title, sub]) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(
                  mode === "roll"
                    ? { ...t, mode, pageW: t.labelW, pageH: t.labelH }
                    : { ...t, mode, pageW: t.mode === "sheet" ? t.pageW : 210, pageH: t.mode === "sheet" ? t.pageH : 297 },
                )
              }
              className={`rounded-xl border px-3 py-2 text-left disabled:opacity-60 ${t.mode === mode ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <span className="block text-sm font-medium text-slate-800">{title}</span>
              <span className="block text-[11px] text-slate-500">{sub}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sticker size">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Width" value={t.labelW} disabled={disabled} onChange={(n) => onChange({ ...t, labelW: n, ...(t.mode === "roll" ? { pageW: n } : {}) })} />
          <Num label="Height" value={t.labelH} disabled={disabled} onChange={(n) => onChange({ ...t, labelH: n, ...(t.mode === "roll" ? { pageH: n } : {}) })} />
        </div>
      </Section>

      {t.mode === "sheet" && (
        <Section title="Sheet layout">
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-500 mb-1">Page size</span>
            <select
              className="admin-input admin-select !py-1.5 text-sm"
              value={presetId}
              disabled={disabled}
              onChange={(e) => {
                const p = PAGE_PRESETS.find((x) => x.id === e.target.value);
                if (p) onChange({ ...t, pageW: p.w, pageH: p.h });
              }}
            >
              {PAGE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="custom">Custom size</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Page width" value={t.pageW} disabled={disabled} onChange={(n) => set("pageW", n)} />
            <Num label="Page height" value={t.pageH} disabled={disabled} onChange={(n) => set("pageH", n)} />
            <Num label="Columns" value={t.cols} step={1} min={1} suffix="" disabled={disabled} onChange={(n) => set("cols", Math.max(1, Math.round(n)))} />
            <Num label="Rows" value={t.rows} step={1} min={1} suffix="" disabled={disabled} onChange={(n) => set("rows", Math.max(1, Math.round(n)))} />
            <Num label="Top margin" value={t.marginTop} disabled={disabled} hint="Page top edge → top of the first row" onChange={(n) => set("marginTop", n)} />
            <Num label="Left margin" value={t.marginLeft} disabled={disabled} hint="Page left edge → left of the first column" onChange={(n) => set("marginLeft", n)} />
            <Num label="Gap across" value={t.gapX} disabled={disabled} hint="Space between two stickers side by side" onChange={(n) => set("gapX", n)} />
            <Num label="Gap down" value={t.gapY} disabled={disabled} hint="Space between two rows" onChange={(n) => set("gapY", n)} />
          </div>
        </Section>
      )}

      <Section title="Inside the sticker">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Padding" value={t.padding} disabled={disabled} onChange={(n) => set("padding", n)} />
          <Num label="Barcode height" value={t.barcodeHeight} disabled={disabled} onChange={(n) => set("barcodeHeight", n)} />
          <Num label="Quiet zone" value={t.quietZone} disabled={disabled} hint="Blank space either side of the bars. Scanners need it" onChange={(n) => set("quietZone", n)} />
          <Num label="Text size" value={Math.round(t.fontScale * 100)} step={5} min={50} suffix="%" disabled={disabled} onChange={(n) => set("fontScale", Math.max(0.5, n / 100))} />
        </div>
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500 mb-1">Barcode type</span>
          <select className="admin-input admin-select !py-1.5 text-sm" value={t.barcodeFormat} disabled={disabled} onChange={(e) => set("barcodeFormat", e.target.value as LabelTemplate["barcodeFormat"])}>
            <option value="auto">Automatic (EAN-13 for 13-digit codes, else Code 128)</option>
            <option value="EAN13">EAN-13 (falls back to Code 128 if the code isn&apos;t EAN-13)</option>
            <option value="CODE128">Code 128 (any code)</option>
          </select>
        </label>
      </Section>

      <Section title="Printer calibration">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Shift right (−left)" value={t.offsetX} min={-20} disabled={disabled} onChange={(n) => set("offsetX", n)} />
          <Num label="Shift down (−up)" value={t.offsetY} min={-20} disabled={disabled} onChange={(n) => set("offsetY", n)} />
        </div>
        <p className="text-[11px] text-slate-400">
          Print the alignment test on plain paper, hold it against your sticker stock and nudge until the outlines sit on the stickers.
        </p>
      </Section>
    </div>
  );
}
