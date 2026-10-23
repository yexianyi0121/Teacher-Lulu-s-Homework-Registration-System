import type { SessionMetrics } from '../domain/types';
import { formatPercent } from '../domain/round';

/** 统计条（设计 04 §6.2 / PRD-V2 §2.4）：仅 quality 模板渲染 */
export function StatsBar({ metrics, schemeLabel }: { metrics: SessionMetrics; schemeLabel: string }) {
  const avgText =
    metrics.avgScore !== null
      ? String(metrics.avgScore)
      : metrics.avgPercent !== null
        ? `${formatPercent(metrics.avgPercent)}%`
        : '—';

  const items: Array<{ label: string; value: string; tone?: string }> = [
    { label: '有值', value: String(metrics.entered) },
    { label: '优秀', value: String(metrics.excellent), tone: 'green' },
    { label: '良好', value: String(metrics.good), tone: 'blue' },
    { label: '及格', value: String(metrics.pass), tone: 'amber' },
    { label: '不及格', value: String(metrics.fail), tone: 'red' },
    { label: '缺交', value: String(metrics.missing) },
    { label: '请假', value: String(metrics.leave) },
    { label: '未提交', value: String(metrics.notSubmitted) },
    { label: '平均', value: avgText },
    {
      label: '达标率',
      value: metrics.qualifiedRate === null ? '—' : `${formatPercent(metrics.qualifiedRate * 100)}%`,
    },
    { label: '方案', value: schemeLabel },
  ];

  return (
    <div className="stats" role="status" aria-label="本次统计">
      {items.map((it) => (
        <div className="stat" key={it.label} data-tone={it.tone}>
          <span className="stat-label">{it.label}</span>
          <span className="stat-value">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
