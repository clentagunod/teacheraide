import { useId, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useElementWidth } from '@/hooks/useElementWidth';

export interface AreaPoint {
  label: string;
  /** 0–100 */
  value: number;
  caption: string;
}

interface AreaChartProps {
  data: AreaPoint[];
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 16, right: 20, bottom: 30, left: 44 };
const TICKS = [0, 25, 50, 75, 100];

interface XY {
  x: number;
  y: number;
}

/** Smooth line through points using horizontal-tangent Béziers (never overshoots the data). */
function smoothPath(points: XY[]): string {
  if (points.length === 0) return '';
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` C${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

export function AreaChart({ data, height = 240, ariaLabel }: AreaChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '');

  const innerW = Math.max(width - PAD.left - PAD.right, 0);
  const innerH = height - PAD.top - PAD.bottom;
  const baseY = PAD.top + innerH;

  const points: XY[] = data.map((d, i) => ({
    x: PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1)),
    y: PAD.top + innerH - (Math.min(Math.max(d.value, 0), 100) / 100) * innerH,
  }));

  const line = smoothPath(points);
  const area = points.length > 1 ? `${line} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z` : '';
  const labelStep = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 64))));

  function handleMove(e: ReactMouseEvent<SVGRectElement>) {
    if (data.length === 0 || innerW === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setActive(data.length === 1 ? 0 : Math.round(ratio * (data.length - 1)));
  }

  const activePoint = active !== null ? points[active] : undefined;
  const activeData = active !== null ? data[active] : undefined;

  return (
    <div ref={wrapRef} className="area-chart" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {TICKS.map((t) => {
            const y = PAD.top + innerH - (t / 100) * innerH;
            return (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} className="chart-grid" />
                <text x={PAD.left - 10} y={y + 4} textAnchor="end" className="chart-label">{t}%</text>
              </g>
            );
          })}

          {area && <path d={area} fill={`url(#${gradientId})`} />}
          {line && points.length > 1 && <path d={line} className="chart-line" fill="none" />}

          {data.map((d, i) =>
            i % labelStep === 0 ? (
              <text key={d.caption} x={points[i].x} y={height - 8} textAnchor="middle" className="chart-label">
                {d.label}
              </text>
            ) : null,
          )}

          {points.map((p, i) => (
            <circle key={data[i].caption} cx={p.x} cy={p.y} r={active === i ? 5.5 : 3.5} className="chart-dot" />
          ))}

          {activePoint && <line x1={activePoint.x} x2={activePoint.x} y1={PAD.top} y2={baseY} className="chart-cursor" />}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setActive(null)}
          />
        </svg>
      )}
      {activePoint && activeData && (
        <div className="chart-tooltip" style={{ left: activePoint.x, top: activePoint.y }}>
          <span>{activeData.caption}</span>
          <strong>{activeData.value}% present</strong>
        </div>
      )}
    </div>
  );
}
