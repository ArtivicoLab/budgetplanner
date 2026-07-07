// Lightweight charts built with CSS/JS only (no SVG, no chart library).
// Donut = conic-gradient; bars = flex divs; line chart = JS-measured dots +
// rotated-div segments + clip-path area fill. Enough for the dashboard.

import { useEffect, useRef, useState } from "react";

interface Slice {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  size = 120,
  thickness = 18,
  center,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  let acc = 0;
  const stops = slices
    .map((s) => {
      const start = (acc / total) * 360;
      acc += Math.max(0, s.value);
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  const summary = slices
    .map((s) => `${s.label} ${Math.round((Math.max(0, s.value) / total) * 100)}%`)
    .join(", ");

  return (
    <div className="chart-donut">
      <div
        className="chart-donut__ring"
        role="img"
        aria-label={summary || "No data"}
        style={{
          width: size,
          height: size,
          background: total > 0 ? `conic-gradient(${stops})` : "var(--surface-2)",
        }}
      >
        <div className="chart-donut__hole" style={{ inset: thickness }}>
          {center}
        </div>
      </div>
      <div className="chart-donut__legend">
        {slices.map((s) => (
          <div key={s.label} className="spread fs-13">
            <span className="chart-donut__slice-label">
              <span className="chart-donut__swatch" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="muted">{Math.round((Math.max(0, s.value) / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A single rounded track split into proportional colored segments, with a legend
 * of count chips below. Honest at any shape: one status → one full bar. Replaces
 * a single-value "donut" that isn't really a chart.
 */
export function StatusBar({ segments }: { segments: Slice[] }) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((a, s) => a + s.value, 0) || 1;
  const summary = shown.map((s) => `${s.label} ${s.value}`).join(", ");
  return (
    <div>
      <div className="chart-statusbar__track" role="img" aria-label={summary || "No data"}>
        {shown.map((s) => (
          <div key={s.label} title={`${s.label}: ${s.value}`} style={{ flex: s.value, background: s.color }} />
        ))}
      </div>
      <div className="chart-statusbar__legend">
        {shown.map((s) => (
          <span key={s.label} className="chart-legend-item">
            <span className="dot-9" style={{ background: s.color }} />
            {s.label}
            <span className="muted txt-strong">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal comparison bars (budget vs actual style). */
export function Bars({ data, max }: { data: BarDatum[]; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart-bars">
      {data.map((d) => (
        <div key={d.label}>
          <div className="spread row-label-12">
            <span className="muted">{d.label}</span>
          </div>
          <div className="pbar" role="img" aria-label={`${d.label}: ${d.value}`}>
            <div
              className="pbar__fill"
              style={{
                width: `${Math.min(100, (d.value / top) * 100)}%`,
                background: d.color ?? "var(--accent)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface GroupedDatum {
  label: string;
  budget: number;
  actual: number;
}

/** Paired horizontal bars per category — "Budget vs Actual" style comparisons. */
export function GroupedBars({ data }: { data: GroupedDatum[] }) {
  const top = Math.max(1, ...data.flatMap((d) => [d.budget, d.actual]));
  return (
    <div className="chart-groupedbars">
      <div className="chart-groupedbars__legend">
        <span className="chart-legend-item">
          <span className="dot-9 dot-9--accent" />
          <span className="muted">Budget</span>
        </span>
        <span className="chart-legend-item">
          <span className="dot-9 dot-9--accent2" />
          <span className="muted">Actual</span>
        </span>
      </div>
      {data.map((d) => (
        <div key={d.label}>
          <div className="chart-groupedbars__label">{d.label}</div>
          <div className="pbar mb-1" role="img" aria-label={`${d.label} budget: ${d.budget}`}>
            <div className="pbar__fill pbar__fill--budget" style={{ width: `${Math.min(100, (d.budget / top) * 100)}%` }} />
          </div>
          <div className="pbar" role="img" aria-label={`${d.label} actual: ${d.actual}`}>
            <div className="pbar__fill pbar__fill--actual" style={{ width: `${Math.min(100, (d.actual / top) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Vertical column trend (weight over time, daily % completion, etc). CSS
 * columns, JS-normalized. Pass `min`/`max` for a fixed domain (e.g. 0–100 for
 * percentages) — omit them to auto-scale to the data's own range (e.g. weight).
 */
export function Columns({
  points,
  height = 120,
  color = "var(--accent)",
  min,
  max,
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
  min?: number;
  max?: number;
}) {
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value);
  const lo = min ?? Math.min(...vals);
  const hi = max ?? Math.max(...vals);
  const span = hi - lo || 1;
  return (
    <div className="chart-columns" style={{ height }}>
      {points.map((p, i) => {
        const h = 18 + ((p.value - lo) / span) * (height - 30);
        return (
          <div key={i} className="chart-column">
            <div
              title={`${p.label}: ${p.value}`}
              role="img"
              aria-label={`${p.label}: ${p.value}`}
              className="chart-column__bar"
              style={{
                height: Math.max(2, h),
                background: color,
                opacity: 0.55 + 0.45 * ((p.value - lo) / span),
              }}
            />
            {points.length <= 8 && (
              <span className="muted chart-column__label">{p.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface LineSeries {
  label: string;
  color: string;
  points: number[];
}

/**
 * A financial-market style line chart, pure CSS/JS (no SVG, no library). The
 * plot width is measured with a ResizeObserver so it stays responsive; each
 * segment is a thin div rotated to connect two points, every data point gets a
 * dot marker, and a clip-path polygon fills the area beneath each line. Multiple
 * series overlay on a shared scale (e.g. Income vs Spending).
 */
export function LineChart({
  series,
  xLabels,
  height = 200,
  formatValue = (n: number) => String(Math.round(n)),
}: {
  series: LineSeries[];
  xLabels: string[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = xLabels.length;
  const vals = series.flatMap((s) => s.points);
  const lo = Math.min(...vals, 0);
  const rawHi = Math.max(...vals, 1);
  const hi = rawHi + (rawHi - lo) * 0.08; // headroom so the peak dot clears the top
  const span = hi - lo || 1;
  const padY = 10;
  const plotH = height - padY * 2;
  const baseline = padY + plotH; // y of the value `lo`
  const px = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * w);
  const py = (v: number) => padY + (1 - (v - lo) / span) * plotH;

  const gridCount = 4;
  const gridVals = Array.from({ length: gridCount + 1 }, (_, i) => lo + (span * (gridCount - i)) / gridCount);

  return (
    <div className="linechart">
      <div className="linechart__plot" ref={ref} style={{ height }}>
        {w > 0 && gridVals.map((gv, i) => (
          <div key={`g${i}`} className="linechart__grid" style={{ top: py(gv) }}>
            <span className="linechart__ylabel">{formatValue(gv)}</span>
          </div>
        ))}
        {w > 0 && series.map((s) => {
          const pts = s.points.map((v, i) => ({ x: px(i), y: py(v) }));
          const areaClip = `polygon(${pts[0].x}px ${baseline}px, ${pts
            .map((p) => `${p.x}px ${p.y}px`)
            .join(", ")}, ${pts[pts.length - 1].x}px ${baseline}px)`;
          return (
            <div key={s.label}>
              <div
                className="linechart__area"
                style={{ background: `linear-gradient(${s.color}, transparent)`, clipPath: areaClip }}
              />
              {pts.slice(0, -1).map((p, i) => {
                const q = pts[i + 1];
                const len = Math.hypot(q.x - p.x, q.y - p.y);
                const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
                return (
                  <div
                    key={`s${i}`}
                    className="linechart__seg"
                    style={{ left: p.x, top: p.y, width: len, background: s.color, transform: `rotate(${ang}deg)` }}
                  />
                );
              })}
              {pts.map((p, i) => (
                <div
                  key={`d${i}`}
                  className="linechart__dot"
                  title={`${s.label} · ${xLabels[i]}: ${formatValue(s.points[i])}`}
                  role="img"
                  aria-label={`${s.label} ${xLabels[i]}: ${formatValue(s.points[i])}`}
                  style={{ left: p.x, top: p.y, borderColor: s.color }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="linechart__xaxis" style={{ position: "relative", height: 16 }}>
        {w > 0 && xLabels.map((l, i) => (
          <span
            key={`x${i}`}
            className="linechart__xlabel"
            style={{ left: px(i), transform: `translateX(${i === 0 ? "0" : i === n - 1 ? "-100%" : "-50%"})` }}
          >
            {l}
          </span>
        ))}
      </div>
      <div className="linechart__legend">
        {series.map((s) => (
          <span key={s.label} className="chart-legend-item">
            <span className="dot-9" style={{ background: s.color }} />
            <span className="muted">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface ComboBar {
  label: string;
  color: string;
  values: number[];
}
export interface ComboLine {
  label: string;
  color: string;
  values: number[];
  smooth?: boolean;
}

/**
 * Combo chart (financial): vertical bars for one metric overlaid with a smooth
 * curved line + dots for another — e.g. Spending (bars) vs Income (line). Pure
 * CSS/JS, no SVG: bars are divs, the "smooth" curve is a Catmull-Rom spline
 * sampled into many short rotated-div segments (curved look, no <path>).
 */
export function ComboChart({
  xLabels,
  bars = [],
  lines = [],
  height = 220,
  formatValue = (n: number) => String(Math.round(n)),
}: {
  xLabels: string[];
  bars?: ComboBar[];
  lines?: ComboLine[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = xLabels.length;
  const allVals = [...bars.flatMap((b) => b.values), ...lines.flatMap((l) => l.values)];
  const lo = Math.min(0, ...allVals);
  const rawHi = Math.max(1, ...allVals);
  const hi = rawHi + (rawHi - lo) * 0.08;
  const span = hi - lo || 1;
  const padY = 10;
  const plotH = height - padY * 2;
  const slotW = n > 0 ? w / n : 0;
  const cx = (i: number) => slotW * (i + 0.5);
  const py = (v: number) => padY + (1 - (v - lo) / span) * plotH;
  const baseY = py(0);

  const gridCount = 4;
  const gridVals = Array.from({ length: gridCount + 1 }, (_, i) => lo + (span * (gridCount - i)) / gridCount);

  // Catmull-Rom spline sampled to dense points → straight micro-segments read
  // as a smooth curve without any SVG path.
  function pathFor(values: number[], smooth?: boolean) {
    const P = values.map((v, i) => ({ x: cx(i), y: py(v) }));
    if (!smooth || P.length < 3) return P;
    const out: { x: number; y: number }[] = [];
    const STEPS = 16;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i];
      const p1 = P[i];
      const p2 = P[i + 1];
      const p3 = P[i + 2] || P[i + 1];
      for (let s = 0; s < STEPS; s++) {
        const t = s / STEPS;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    out.push(P[P.length - 1]);
    return out;
  }

  return (
    <div className="linechart">
      <div className="linechart__plot" ref={ref} style={{ height }}>
        {w > 0 && gridVals.map((gv, i) => (
          <div key={`g${i}`} className="linechart__grid" style={{ top: py(gv) }}>
            <span className="linechart__ylabel">{formatValue(gv)}</span>
          </div>
        ))}

        {/* bars */}
        {w > 0 && bars.length > 0 && xLabels.map((_, i) => {
          const groupW = slotW * 0.56;
          const barW = groupW / bars.length;
          return bars.map((bar, bi) => {
            const v = bar.values[i] ?? 0;
            const top = py(v);
            return (
              <div
                key={`b${bi}-${i}`}
                className="combochart__bar"
                title={`${bar.label} · ${xLabels[i]}: ${formatValue(v)}`}
                style={{
                  left: cx(i) - groupW / 2 + bi * barW,
                  top,
                  width: Math.max(2, barW - 2),
                  height: Math.max(1, baseY - top),
                  background: bar.color,
                }}
              />
            );
          });
        })}

        {/* smooth line(s) + dots */}
        {w > 0 && lines.map((line) => {
          const path = pathFor(line.values, line.smooth);
          const dots = line.values.map((v, i) => ({ x: cx(i), y: py(v) }));
          const areaClip = `polygon(${path[0].x}px ${baseY}px, ${path
            .map((p) => `${p.x}px ${p.y}px`)
            .join(", ")}, ${path[path.length - 1].x}px ${baseY}px)`;
          return (
            <div key={line.label}>
              <div
                className="linechart__area"
                style={{ background: `linear-gradient(${line.color}, transparent)`, clipPath: areaClip, opacity: 0.12 }}
              />
              <div className="linechart__line" style={{ background: line.color, clipPath: strokePolygon(path, 2.6) }} />

              {dots.map((p, i) => (
                <div
                  key={`d${i}`}
                  className="linechart__dot"
                  title={`${line.label} · ${xLabels[i]}: ${formatValue(line.values[i])}`}
                  role="img"
                  aria-label={`${line.label} ${xLabels[i]}: ${formatValue(line.values[i])}`}
                  style={{ left: p.x, top: p.y, borderColor: line.color }}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="linechart__xaxis" style={{ position: "relative", height: 16 }}>
        {w > 0 && xLabels.map((l, i) => (
          <span
            key={`x${i}`}
            className="linechart__xlabel"
            style={{ left: cx(i), transform: "translateX(-50%)" }}
          >
            {l}
          </span>
        ))}
      </div>

      <div className="linechart__legend">
        {bars.map((b) => (
          <span key={b.label} className="chart-legend-item">
            <span className="combochart__swatch" style={{ background: b.color }} />
            <span className="muted">{b.label}</span>
          </span>
        ))}
        {lines.map((l) => (
          <span key={l.label} className="chart-legend-item">
            <span className="dot-9" style={{ background: l.color }} />
            <span className="muted">{l.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Catmull-Rom spline → dense points, so straight micro-segments read as a
// smooth curve without any SVG path. Shared by the smooth line charts.
function catmullRom(P: { x: number; y: number }[], steps = 16): { x: number; y: number }[] {
  if (P.length < 3) return P;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] || P[i + 1];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(P[P.length - 1]);
  return out;
}

/**
 * Build a `clip-path` polygon that traces a path as a constant-width ribbon —
 * one continuous filled shape for the whole line, so there are NO joints and no
 * sub-pixel gaps (the chain-of-rotated-divs approach leaves visible "dashes").
 * Offsets each point along its local normal by ±half the stroke width.
 */
function strokePolygon(path: { x: number; y: number }[], width: number): string {
  if (path.length < 2) return "none";
  const h = width / 2;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[i - 1] || path[i];
    const next = path[i + 1] || path[i];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const L = Math.hypot(tx, ty) || 1;
    tx /= L;
    ty /= L;
    const nx = -ty; // unit normal
    const ny = tx;
    const p = path[i];
    top.push(`${(p.x + nx * h).toFixed(2)}px ${(p.y + ny * h).toFixed(2)}px`);
    bottom.push(`${(p.x - nx * h).toFixed(2)}px ${(p.y - ny * h).toFixed(2)}px`);
  }
  return `polygon(${top.join(", ")}, ${bottom.reverse().join(", ")})`;
}

const AREA_GUTTER = 64; // right-hand price-axis pill column

/**
 * Yahoo-Finance-style area chart, pure CSS/JS (no SVG). Smooth gradient-filled
 * area, up/down coloring (green above the reference, red below), a dashed
 * reference line, right-axis value pills incl. a highlighted "last value", and
 * an emphasized end-point marker. Built for a single running series like an
 * account balance over time.
 */
export function AreaChart({
  points,
  xLabels,
  height = 240,
  formatValue = (n: number) => String(Math.round(n)),
  referenceValue,
}: {
  points: number[];
  xLabels: string[];
  height?: number;
  formatValue?: (n: number) => string;
  referenceValue?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const plotW = Math.max(1, w - AREA_GUTTER);
  const lo0 = Math.min(...points, referenceValue ?? Infinity);
  const hi0 = Math.max(...points, referenceValue ?? -Infinity);
  const pad = (hi0 - lo0) * 0.15 || Math.abs(hi0) * 0.1 || 1;
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const span = hi - lo || 1;
  const padY = 12;
  const plotH = height - padY * 2;
  const baseline = padY + plotH;
  const px = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const py = (v: number) => padY + (1 - (v - lo) / span) * plotH;

  const first = points[0];
  const lastVal = points[n - 1];
  const up = lastVal >= (referenceValue ?? first);
  const color = up ? "var(--success)" : "var(--alert)";

  const P = points.map((v, i) => ({ x: px(i), y: py(v) }));
  const path = catmullRom(P, 16);
  const last = P[n - 1];
  const areaClip = `polygon(${path[0].x}px ${baseline}px, ${path
    .map((p) => `${p.x}px ${p.y}px`)
    .join(", ")}, ${path[path.length - 1].x}px ${baseline}px)`;

  const gridCount = 4;
  const gridVals = Array.from({ length: gridCount + 1 }, (_, i) => lo + (span * (gridCount - i)) / gridCount);
  const refY = referenceValue != null ? py(referenceValue) : null;

  return (
    <div className="areachart">
      <div className="areachart__plot" ref={ref} style={{ height }}>
        {w > 0 && gridVals.map((gv, i) => (
          <div key={`g${i}`} className="areachart__grid" style={{ top: py(gv), width: plotW }} />
        ))}
        {w > 0 && gridVals.map((gv, i) => (
          <span key={`yl${i}`} className="areachart__ylabel" style={{ top: py(gv) }}>{formatValue(gv)}</span>
        ))}

        {w > 0 && (
          <>
            <div
              className="areachart__area"
              style={{ background: `linear-gradient(${color}, transparent)`, clipPath: areaClip }}
            />
            <div className="areachart__line" style={{ background: color, clipPath: strokePolygon(path, 2.6) }} />


            {refY != null && (
              <>
                <div className="areachart__refline" style={{ top: refY, width: plotW }} />
                <span className="areachart__pill areachart__pill--ref" style={{ top: refY }}>
                  {formatValue(referenceValue as number)}
                </span>
              </>
            )}

            {/* end-point marker */}
            <div className="areachart__endring" style={{ left: last.x, top: last.y, borderColor: color }} />
            <div className="areachart__enddot" style={{ left: last.x, top: last.y, background: color }} />

            {/* highlighted last-value pill on the right axis */}
            <span
              className="areachart__pill areachart__pill--last"
              style={{ top: last.y, background: color }}
            >
              {formatValue(lastVal)}
            </span>
          </>
        )}
      </div>

      <div className="areachart__xaxis" style={{ position: "relative", height: 16, width: plotW }}>
        {w > 0 && xLabels.map((l, i) => (
          <span
            key={`x${i}`}
            className="linechart__xlabel"
            style={{ left: px(i), transform: `translateX(${i === 0 ? "0" : i === n - 1 ? "-100%" : "-50%"})` }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface Stacked100Part {
  label: string;
  color: string;
  value: number;
}
export interface Stacked100Column {
  label: string;
  parts: Stacked100Part[];
}

/**
 * 100% stacked bar chart — every column is normalized to full height, so each
 * segment shows its share of that column's total (e.g. the mix of Bills /
 * Expenses / Debt / Savings within each month's spending). Pure flex divs.
 */
export function Stacked100({
  columns,
  height = 200,
  formatValue = (n: number) => `${Math.round(n)}%`,
}: {
  columns: Stacked100Column[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  if (columns.length === 0) return null;
  const legend = columns[0].parts;
  return (
    <div>
      <div className="linechart__legend" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {legend.map((p) => (
          <span key={p.label} className="chart-legend-item">
            <span className="combochart__swatch" style={{ background: p.color }} />
            <span className="muted">{p.label}</span>
          </span>
        ))}
      </div>
      <div className="stacked100" style={{ height }}>
        {columns.map((col, ci) => {
          const total = col.parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
          return (
            <div key={ci} className="stacked100__col">
              <div className="stacked100__bar">
                {col.parts.map((p) => {
                  const pct = (Math.max(0, p.value) / total) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={p.label}
                      className="stacked100__seg"
                      title={`${col.label} · ${p.label}: ${formatValue(pct)}`}
                      style={{ height: `${pct}%`, background: p.color }}
                    />
                  );
                })}
              </div>
              <span className="stacked100__label muted">{col.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface StackedPoint {
  label: string;
  a: number; // bottom segment (e.g. completed)
  b: number; // top segment (e.g. pending)
}

/** Two-color stacked columns — an "activity timeline" of two totals per slot. */
export function StackedColumns({
  points,
  height = 120,
  colorA = "var(--success)",
  colorB = "var(--surface-2)",
  labelA = "Completed",
  labelB = "Pending",
}: {
  points: StackedPoint[];
  height?: number;
  colorA?: string;
  colorB?: string;
  labelA?: string;
  labelB?: string;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.a + p.b));
  return (
    <div>
      <div className="chart-stackedcolumns__legend">
        <span className="chart-legend-item">
          <span className="dot-9" style={{ background: colorA }} />
          <span className="muted">{labelA}</span>
        </span>
        <span className="chart-legend-item">
          <span className="dot-9" style={{ background: colorB }} />
          <span className="muted">{labelB}</span>
        </span>
      </div>
      <div className="chart-columns" style={{ height }}>
        {points.map((p, i) => {
          const total = p.a + p.b;
          const totalH = total > 0 ? Math.max(4, (total / max) * (height - 20)) : 2;
          const aH = total > 0 ? (p.a / total) * totalH : 0;
          const bH = totalH - aH;
          return (
            <div key={i} className="chart-column">
              <div
                title={`${p.label}: ${p.a} ${labelA.toLowerCase()}, ${p.b} ${labelB.toLowerCase()}`}
                role="img"
                aria-label={`${p.label}: ${p.a} ${labelA.toLowerCase()}, ${p.b} ${labelB.toLowerCase()}`}
                className="chart-stackedcolumns__bar"
                style={{ height: totalH }}
              >
                <div className="chart-stackedcolumns__seg" style={{ height: aH, background: colorA }} />
                <div className="chart-stackedcolumns__seg" style={{ height: bH, background: colorB }} />
              </div>
              {points.length <= 12 && (
                <span className="muted chart-column__label">{p.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
