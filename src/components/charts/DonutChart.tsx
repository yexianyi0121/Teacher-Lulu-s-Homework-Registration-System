export interface DonutSegment {
  label: string;
  value: number;
  ratio: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  ariaLabel: string;
}

const R = 70;
const C = 2 * Math.PI * R;

/** 分数段占比环形图（设计 §8.4.1）：环心留空，不做动画 */
export function DonutChart({ segments, ariaLabel }: DonutChartProps) {
  let acc = 0;

  return (
    <figure className="chart-figure" role="img" aria-label={ariaLabel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg viewBox="0 0 200 200" width={150} height={150} aria-hidden="true">
          <circle cx={100} cy={100} r={R} fill="none" stroke="var(--line)" strokeWidth={28} />
          {segments
            .filter((s) => s.value > 0 && s.ratio > 0)
            .map((s) => {
              const len = s.ratio * C;
              const dash = Math.max(0, len - 2);
              const offset = acc;
              acc += len;
              return (
                <circle
                  key={s.label}
                  cx={100}
                  cy={100}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={28}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 100 100)"
                />
              );
            })}
        </svg>
        <ul className="donut-legend">
          {segments.map((s) => (
            <li key={s.label}>
              <span className="donut-swatch" style={{ background: s.color }} />
              <span>
                {s.label} · {Math.round(s.ratio * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="chart-caption">分数段占比</figcaption>
    </figure>
  );
}
