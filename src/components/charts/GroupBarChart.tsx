export interface BarPair {
  avg: number | null;
  rate: number | null;
}

export interface GroupBarChartProps {
  current: BarPair;
  history?: BarPair | null;
}

const X0 = 48;
const X1 = 300;
const Y0 = 16;
const Y1 = 180;

const TICKS = [0, 20, 40, 60, 80, 100];

function yOf(v: number): number {
  const clamped = Math.min(100, Math.max(0, v));
  return Y1 - (clamped / 100) * (Y1 - Y0);
}

/** 新老数据对比分组柱状图（设计 §8.4.2） */
export function GroupBarChart({ current, history }: GroupBarChartProps) {
  const slot = (X1 - X0) / 2;
  const barW = 28;
  const gap = 8;
  const totalW = history ? barW * 2 + gap : barW;
  const baseX = (i: number) => X0 + slot * i + (slot - totalW) / 2;

  const cats: Array<{ name: string; v: number | null; hv: number | null }> = [
    { name: '平均分', v: current.avg, hv: history?.avg ?? null },
    { name: '优秀率(%)', v: current.rate, hv: history?.rate ?? null },
  ];

  const aria = cats
    .map((c) => `${c.name}：本次 ${c.v === null ? '—' : c.v.toFixed(1)}${history ? `，历史 ${c.hv === null ? '—' : c.hv.toFixed(1)}` : ''}`)
    .join('；');

  return (
    <figure className="chart-figure" role="img" aria-label={`新老数据对比。${aria}`}>
      <svg
        viewBox="0 0 320 220"
        width="100%"
        style={{ display: 'block', height: 'auto' }}
        aria-hidden="true"
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={X0} y1={yOf(t)} x2={X1} y2={yOf(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={X0 - 8} y={yOf(t) + 4} textAnchor="end" fontSize="9" fill="var(--text-3)">
              {t}
            </text>
          </g>
        ))}

        {cats.map((c, i) => {
          const bx = baseX(i);
          return (
            <g key={c.name}>
              {history ? (
                <rect
                  x={bx}
                  y={c.hv === null ? Y1 : yOf(c.hv)}
                  width={barW}
                  height={c.hv === null ? 0 : Y1 - yOf(c.hv)}
                  rx={5}
                  fill="var(--gray)"
                  opacity={0.4}
                />
              ) : null}
              <rect
                x={history ? bx + barW + gap : bx}
                y={c.v === null ? Y1 : yOf(c.v)}
                width={barW}
                height={c.v === null ? 0 : Y1 - yOf(c.v)}
                rx={5}
                fill="var(--blue)"
              />
              <text x={bx + totalW / 2} y={202} textAnchor="middle" fontSize="11" fill="var(--text-2)">
                {c.name}
              </text>
            </g>
          );
        })}

        <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="var(--line)" />
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-2)' }}>
        {history ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="donut-swatch" style={{ background: 'var(--gray)', opacity: 0.4 }} />
            历史选择
          </span>
        ) : null}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="donut-swatch" style={{ background: 'var(--blue)' }} />
          本次成绩
        </span>
      </div>
      <figcaption className="chart-caption">新老数据对比</figcaption>
    </figure>
  );
}
