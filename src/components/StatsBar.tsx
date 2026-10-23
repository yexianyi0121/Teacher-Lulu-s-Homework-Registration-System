import type { SessionMetrics } from '../domain/types';
import type { Mode } from '../domain/types';
import { formatScore } from '../domain/grades';

export interface StatsBarProps {
  mode: Mode;
  metrics: SessionMetrics;
  excellentLine: number;
  passLine: number;
}

/**
 * 统计条（PRD FR-06 / 设计 §16 #1：只在单元测试模式渲染）
 */
export function StatsBar({ mode, metrics, excellentLine, passLine }: StatsBarProps) {
  if (mode !== 'quiz') return null;

  const items: Array<{ label: string; value: string; tone?: string }> = [
    { label: '录入人数', value: String(metrics.entered) },
    { label: '平均分', value: metrics.avg === null ? '—' : formatScore(metrics.avg) },
    { label: `优秀(${excellentLine}+)`, value: String(metrics.excellent), tone: 'green' },
    { label: '良好(80+)', value: String(metrics.good), tone: 'blue' },
    { label: `及格(${passLine}+)`, value: String(metrics.pass), tone: 'amber' },
    { label: '不及格', value: String(metrics.fail), tone: 'red' },
  ];

  return (
    <section className="stats" aria-label="本次统计">
      {items.map((it) => (
        <div className="stat" key={it.label}>
          <span className="stat-label">{it.label}</span>
          <span className="stat-value" data-tone={it.tone ?? (it.value === '—' ? 'muted' : undefined)}>
            {it.value}
          </span>
        </div>
      ))}
    </section>
  );
}
