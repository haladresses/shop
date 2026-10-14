"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// Lightweight SVG charts for the admin reports. Palette follows the shared
// data-viz reference: one hue for magnitude, a blue/red diverging pair for
// profit vs loss, recessive grid, hover tooltip on every mark.
export const VIZ = {
  series1: "#2a78d6",
  series2: "#eb6834",
  positive: "#2a78d6",
  negative: "#e34948",
  grid: "#e7e5e4",
  axis: "#78716c",
  text: "#44403c",
};

export type ColumnDatum = { key: string; label: string; value: number };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : n.toFixed(Math.abs(n) < 10 && n % 1 ? 1 : 0);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(240, entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/**
 * Column chart. With `diverging`, values below zero are drawn downward in the
 * negative color (profit vs loss); otherwise a single-hue magnitude chart.
 */
export function ColumnChart({
  data,
  height = 220,
  diverging = false,
  color = VIZ.series1,
  format,
  renderTooltip,
  ariaLabel,
}: {
  data: ColumnDatum[];
  height?: number;
  diverging?: boolean;
  color?: string;
  format: (n: number) => string;
  renderTooltip?: (d: ColumnDatum, index: number) => React.ReactNode;
  ariaLabel: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 44;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const { top, bottom } = useMemo(() => {
    const max = Math.max(0, ...data.map((d) => d.value));
    const min = diverging ? Math.min(0, ...data.map((d) => d.value)) : 0;
    const t = niceMax(max);
    const b = min < 0 ? -niceMax(-min) : 0;
    return { top: max === 0 && b < 0 ? 0 : t, bottom: b };
  }, [data, diverging]);

  const span = top - bottom || 1;
  const y = (v: number) => padT + ((top - v) / span) * plotH;
  const zeroY = y(0);
  const band = data.length ? plotW / data.length : plotW;
  const barW = Math.max(2, Math.min(28, band * 0.68));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => bottom + span * f);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 64))));

  const barPath = (x: number, v: number) => {
    const h = Math.abs(y(v) - zeroY);
    if (h < 0.5) return "";
    const r = Math.min(4, barW / 2, h);
    const yv = y(v);
    if (v >= 0) {
      return `M${x},${zeroY} V${yv + r} Q${x},${yv} ${x + r},${yv} H${x + barW - r} Q${x + barW},${yv} ${x + barW},${yv + r} V${zeroY} Z`;
    }
    return `M${x},${zeroY} V${yv - r} Q${x},${yv} ${x + r},${yv} H${x + barW - r} Q${x + barW},${yv} ${x + barW},${yv - r} V${zeroY} Z`;
  };

  const hovered = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? padL + band * hover + band / 2 : 0;

  return (
    <div ref={ref} className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill={VIZ.axis}>
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + band * i + (band - barW) / 2;
          const fill = diverging && d.value < 0 ? VIZ.negative : diverging ? VIZ.positive : color;
          return (
            <path
              key={d.key}
              d={barPath(x, d.value)}
              fill={fill}
              opacity={hover === null || hover === i ? 1 : 0.45}
              style={{ transition: "opacity .15s" }}
            />
          );
        })}
        <line x1={padL} x2={width - padR} y1={zeroY} y2={zeroY} stroke={VIZ.axis} strokeWidth={1} />
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.key} x={padL + band * i + band / 2} y={height - 8} textAnchor="middle" fontSize={10.5} fill={VIZ.axis}>
              {d.label}
            </text>
          ) : null,
        )}
        {/* hit targets — wider than the marks */}
        {data.map((d, i) => (
          <rect
            key={d.key}
            x={padL + band * i}
            y={padT}
            width={band}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          />
        ))}
        {hover !== null && (
          <line x1={tipLeft} x2={tipLeft} y1={padT} y2={padT + plotH} stroke={VIZ.axis} strokeOpacity={0.25} strokeWidth={1} pointerEvents="none" />
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 top-1 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 px-3 py-2 text-xs text-slate-700 whitespace-nowrap"
          style={{ left: Math.min(Math.max(tipLeft, 80), width - 80), transform: "translateX(-50%)" }}
        >
          {renderTooltip ? (
            renderTooltip(hovered, hover!)
          ) : (
            <>
              <p className="font-semibold text-slate-800">{hovered.label}</p>
              <p>{format(hovered.value)}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for top-N lists. Values are labeled directly. */
export function BarList({
  items,
  format,
  color = VIZ.series1,
}: {
  items: { label: string; value: number; sub?: string }[];
  format: (n: number) => string;
  color?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value)) || 1;
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-700 truncate">{it.label}</span>
            <span className="text-slate-800 font-medium tabular-nums shrink-0">{format(it.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: color }} />
          </div>
          {it.sub && <p className="text-[11px] text-slate-400 mt-0.5">{it.sub}</p>}
        </li>
      ))}
    </ul>
  );
}
