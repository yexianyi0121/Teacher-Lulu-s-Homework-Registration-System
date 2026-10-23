export interface LinePoint {
  label: string;
  value: number | null;
}

export interface LineChartProps {
  points: LinePoint[];
}

const X0 = 48;
const X1 = 300;
const Y0 = 16;
const Y1 = 180;

function yOf(v: number): number {
  const clamped = Math.min(100, Math.max(60, v));
  return Y1 - ((clamped - 60) / 40) * (Y1 - Y0);
}

/** 近期趋势折线图（设计 §8.4.3）：≥1 个点就渲染，1 个点时只画点 + 水平参考线 */
export function LineChart({ points }: LineChartProps) {
  const valid = points.filter((p) => p.value !== null);
  const n = points.length;
  const step = n <= 1 ? 0 : (X1 - X0) / (n - 1);
  const xOf = (i: number) => (n <= 1 ? (X0 + X1) / 2 : X0 + step * i);

  const coords = points.map((p, i) => ({
    x: xOf(i),
    y: yOf(p.value ?? 60),
    has: p.value !== null,
    label: p.label,
  }));

  const line = coords.filter((c) => c.has);
  const polyline = line.map((c) => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];

  const aria =
    valid.length === 0
      ? '近期趋势：暂无数据'
      : `近期趋势均分：${points.map((p) => `${p.label} ${p.value ?? '—'}`).join('，')}`;

  return (
    <figure className="chart-figure" role="img" aria-label={aria}>
      <svg
        viewBox="0 0 320 220"
        width="100%"
        style={{ display: 'block', height: 'auto' }}
        aria-hidden="true"
      >
        {[60, 80, 100].map((t) => (
          <g key={t}>
            <line x1={X0} y1={yOf(t)} x2={X1} y2={yOf(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={X0 - 8} y={yOf(t) + 4} textAnchor="end" fontSize="9" fill="var(--text-3)">
              {t}
            </text>
          </g>
        ))}

        {n === 1 && last.has ? (
          <line x1={X0} y1={last.y} x2={X1} y2={last.y} stroke="var(--brand)" strokeDasharray="4 4" opacity={0.4} />
        ) : null}

        {line.length > 1 ? <polyline points={polyline} fill="none" stroke="var(--brand)" strokeWidth={2} /> : null}

        {line.map((c, i) => {
          const isLast = i === line.length - 1;
          return (
            <circle
              key={`${c.x}-${i}`}
              cx={c.x}
              cy={c.y}
              r={isLast ? 4 : 3}
              fill={isLast ? 'var(--brand)' : 'var(--surface)'}
              stroke="var(--brand)"
              strokeWidth={2}
            />
          );
        })}

        {points.map((p, i) => (
          <text
            key={`${p.label}-${i}`}
            x={xOf(i)}
            y={202}
            textAnchor="middle"
            fontSize="9"
            fill={i === n - 1 ? 'var(--brand)' : 'var(--text-3)'}
          >
            {p.label}
          </text>
        ))}

        <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="var(--line)" />
      </svg>
      <figcaption className="chart-caption">近期趋势（均分）</figcaption>
    </figure>
  );
}
