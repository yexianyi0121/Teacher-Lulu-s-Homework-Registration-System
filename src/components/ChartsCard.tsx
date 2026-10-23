import { useStore } from '../store';
import { selectHistoryWindow, selectStats } from '../store/selectors';
import { MODE_LABEL } from '../domain/constants';
import { formatDateCN } from '../domain/date';
import { DonutChart } from './charts/DonutChart';
import type { DonutSegment } from './charts/DonutChart';
import { GroupBarChart } from './charts/GroupBarChart';
import { LineChart } from './charts/LineChart';
import type { LinePoint } from './charts/LineChart';

/**
 * 数据分析卡片（PRD FR-07 / 设计 §16 #1、#3、#4）
 * 仅在单元测试模式挂载；图 3 与下拉框同源（最近 8 条历史）。
 */
export function ChartsCard() {
  const rec = useStore((s) => s.drafts[s.activeKey]);
  const stats = useStore(selectStats);
  const settings = useStore((s) => s.settings);
  const history = useStore(selectHistoryWindow);
  const compareId = useStore((s) => s.compareId);
  const setCompareId = useStore((s) => s.setCompareId);
  const open = useStore((s) => s.chartsOpen);
  const setOpen = useStore((s) => s.setChartsOpen);

  if (!rec || rec.mode !== 'quiz') return null;

  const total = stats.entered;
  const ratio = (v: number) => (total === 0 ? 0 : v / total);

  const segments: DonutSegment[] = [
    { label: `${settings.excellentLine}分+`, value: stats.excellent, ratio: ratio(stats.excellent), color: 'var(--green)' },
    { label: `80-${settings.excellentLine - 1}`, value: stats.good, ratio: ratio(stats.good), color: 'var(--blue)' },
    { label: `${settings.passLine}-79`, value: stats.pass, ratio: ratio(stats.pass), color: 'var(--amber)' },
    { label: '不及格', value: stats.fail, ratio: ratio(stats.fail), color: 'var(--red)' },
  ];

  const compared = history.find((h) => h.id === compareId) ?? null;

  // 趋势按日期升序（老师可能补录往日作业，按提交先后画线会画出倒退的折线）
  const points: LinePoint[] = [
    ...[...history]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((h) => ({
        label: `${Number(h.date.split('-')[1])}/${Number(h.date.split('-')[2])}`,
        value: h.metrics.avg,
      })),
    { label: '本次', value: stats.avg },
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
            <option key={h.id} value={h.id}>
              {formatDateCN(h.date)} · {h.content || '未填写'} · {MODE_LABEL[h.mode]}
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
                current={{ avg: stats.avg, rate: stats.excellentRate }}
                history={compared ? { avg: compared.metrics.avg, rate: compared.metrics.excellentRate } : null}
              />
              <LineChart points={points} />
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
