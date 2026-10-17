import type { ReactNode } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  ariaLabel: string;
  size?: number;
  thickness?: number;
  children?: ReactNode;
}

export function DonutChart({ segments, ariaLabel, size = 176, thickness = 22, children }: DonutChartProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 4 : 0;

  let offset = 0;
  const arcs = visible.map((s) => {
    const length = (s.value / total) * circumference;
    const dash = Math.max(length - gap, 0);
    const arc = (
      <circle
        key={s.label}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={s.color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    );
    offset += length;
    return arc;
  });

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {total > 0 && arcs}
      </svg>
      <div className="donut__center">{children}</div>
    </div>
  );
}
