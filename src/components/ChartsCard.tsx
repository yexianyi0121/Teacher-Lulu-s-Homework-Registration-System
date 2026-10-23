import { useStore } from '../store';
import { selectHistoryWindow, selectStats } from '../store/selectors';
import { formatDateCN } from '../domain/date';
import { SHEET_TEMPLATES } from '../domain/constants';
import { DonutChart } from './charts/DonutChart';
import type { DonutSegment } from './charts/DonutChart';
import { GroupBarChart } from './charts/GroupBarChart';
import { LineChart } from './charts/LineChart';
import type { LinePoint } from './charts/LineChart';

/** 数据分析卡片（设计 04 §6.2 / PRD-V2 §2.4）：仅 quality 模板挂载 */
export function ChartsCard() {
  const draft = useStore((s) => s.draft);
  const stats = useStore(selectStats);
  const settings = useStore((s) => s.settings);
  const history = useStore(selectHistoryWindow);
  const compareId = useStore((s) => s.compareId);
  const setCompareId = useStore((s) => s.setCompareId);
  const open = useStore((s) => s.chartsOpen);
  const setOpen = useStore((s) => s.setChartsOpen);

  if (!SHEET_TEMPLATES[draft.templateId].showGraph) return null;

  const total = stats.entered;
  const ratio = (v: number) => (total === 0 ? 0 : v / total);
  const s = draft.scheme;

  const segments: DonutSegment[] = [
    { label: `优秀(≥${Math.round(s.excellentRate * 100)}%)`, value: stats.excellent, ratio: ratio(stats.excellent), color: 'var(--green)' },
    { label: `良好(≥${Math.round(s.goodRate * 100)}%)`, value: stats.good, ratio: ratio(stats.good), color: 'var(--blue)' },
    { label: `及格(≥${Math.round(s.passRate * 100)}%)`, value: stats.pass, ratio: ratio(stats.pass), color: 'var(--amber)' },
    { label: '不及格', value: stats.fail, ratio: ratio(stats.fail), color: 'var(--red)' },
  ];

  const compared = history.find((h) => h.key === compareId) ?? null;

  const points: LinePoint[] = [
    ...[...history]
      .filter((h) => h.metricsVersion === 2)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((h) => ({
        label: `${Number(h.date.split('-')[1])}/${Number(h.date.split('-')[2])}`,
        value: h.metrics.avgPercent,
      })),
    { label: '本次', value: stats.avgPercent },
  ];

  return (
    <section className="charts-card" aria-label="班级学情数据分析">
      <div className="charts-head">
        <button
          type="button"
          className="charts-title"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? '收起数据分析' : '展开数据分析'}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span> 📊 班级学情数据分析
        </button>

        <select
          className="history-select"
          aria-label="选择历史记录对比"
          value={compareId ?? ''}
          disabled={history.length === 0}
          onChange={(e) => setCompareId(e.target.value || null)}
        >
          <option value="">{history.length === 0 ? '暂无历史记录' : '选择历史记录对比...'}</option>
          {history.map((h) => (
            <option key={h.key} value={h.key}>
              {formatDateCN(h.date)} · {h.content || '未填写'} · {SHEET_TEMPLATES[h.templateId].name}
            </option>
          ))}
        </select>
      </div>

      {open ? (
        <div className="charts-body">
          {total === 0 ? (
            <div className="chart-empty" style={{ gridColumn: '1 / -1' }}>
              <span aria-hidden="true">🌷</span>
              <span>暂无数据</span>
            </div>
          ) : (
            <>
              <DonutChart
                segments={segments}
                ariaLabel={`分数段占比：优秀 ${stats.excellent} 人，良好 ${stats.good} 人，及格 ${stats.pass} 人，不及格 ${stats.fail} 人`}
              />
              <GroupBarChart
                current={{ avg: stats.avgPercent, rate: stats.qualifiedRate === null ? null : stats.qualifiedRate * 100 }}
                history={
                  compared && compared.metricsVersion === 2
                    ? {
                      avg: compared.metrics.avgPercent,
                      rate: compared.metrics.qualifiedRate === null ? null : compared.metrics.qualifiedRate * 100,
                    }
                    : null
                }
              />
              <LineChart points={points} />
            </>
          )}
        </div>
      ) : null}
      {settings.showName ? null : null}
    </section>
  );
}
