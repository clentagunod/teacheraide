interface MeterProps {
  /** 0–100 */
  percent: number;
  color?: string;
  label: string;
}

/** Thin horizontal progress bar. */
export function Meter({ percent, color = 'var(--accent)', label }: MeterProps) {
  const safe = Math.min(Math.max(Number.isFinite(percent) ? percent : 0, 0), 100);
  return (
    <div className="meter" role="img" aria-label={`${label}: ${Math.round(safe)}%`}>
      <div className="meter__fill" style={{ width: `${safe}%`, background: color }} />
    </div>
  );
}
