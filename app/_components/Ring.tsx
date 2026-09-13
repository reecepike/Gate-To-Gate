/**
 * A progress ring.
 *
 * Deliberately honest about missing data: `pct = null` draws the track and
 * nothing else, with a dash in the middle. A ring sitting at zero reads as
 * failure, and "not measured yet" is not failure.
 */
export function Ring({
  pct,
  value,
  label,
  size = 84,
  stroke = 9,
  colour = 'var(--accent)',
}: {
  pct: number | null;
  value: string;
  label?: string;
  size?: number;
  stroke?: number;
  colour?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const dash = (shown / 100) * c;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--sunk)" strokeWidth={stroke}
        />
        {pct != null && (
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            style={{ transition: 'stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)' }}
          />
        )}
      </svg>
      <div className="mid">
        <div className="v">{value}</div>
        {label && <div className="n">{label}</div>}
      </div>
    </div>
  );
}

/** A labelled horizontal progress bar, for goals. */
export function Bar({ pct, area }: { pct: number | null; area?: string }) {
  return (
    <div className={`pbar ${pct == null ? 'none' : area ?? ''}`}>
      <i style={{ width: `${pct == null ? 100 : Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default Ring;
