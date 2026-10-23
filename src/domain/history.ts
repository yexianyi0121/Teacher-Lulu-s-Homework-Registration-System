import type { HistoryEntry, PersistedStateV3, SessionMetrics } from './types';
import { computeStats } from './stats';

/**
 * 历史 metrics 自愈（设计 04 §4.6.5 的延伸）—— 纯函数。
 *
 * 背景：`HistoryEntry.metrics` 是保存当时的快照。v2.0.0 的 `entered` 只统计「有百分」的值，
 * 过关/文字（听写）的历史记录因此存成了 `entered: 0`，设置里的历史列表会显示「录入 0 人」。
 * 这些记录本身带着 `entries` 与 `scheme` 快照，可以按当前口径重算，不需要用户做任何事。
 *
 * 边界：
 *   - 只重算 `metricsVersion === 2` 的记录；v1 迁移来的历史明确「不重算、不回写」（§4.6.5），
 *     保留 `metricsVersion === 1` 的标记与旧数值。
 *   - 人数取该记录所属班级的 `count`；班级已被删除时退化为「该记录里出现过的最大学号」。
 *   - 完全幂等：重算结果与现有值相同就原样返回，不产生新对象。
 */
export function refreshHistoryMetrics(state: PersistedStateV3): PersistedStateV3 {
  if (state.history.length === 0) return state;

  const counts = new Map(state.classes.map((c) => [c.id, c.count]));
  let changed = false;

  const history = state.history.map((h) => {
    if (h.metricsVersion !== 2) return h;

    const n = counts.get(h.classId) ?? maxNoOf(h);
    const metrics = computeStats(h.entries, h.scheme, n, state.settings.honorIncludesA);
    if (sameMetrics(metrics, h.metrics)) return h;

    changed = true;
    return { ...h, metrics };
  });

  return changed ? { ...state, history } : state;
}

function maxNoOf(h: HistoryEntry): number {
  let max = 0;
  for (const key of Object.keys(h.entries)) {
    const no = Number(key);
    if (Number.isFinite(no) && no > max) max = no;
  }
  return max;
}

const FIELDS: Array<keyof SessionMetrics> = [
  'n', 'entered', 'excellent', 'good', 'pass', 'fail',
  'missing', 'leave', 'madeUp', 'notSubmitted',
  'avgPercent', 'avgScore', 'excellentRate', 'qualifiedRate',
  'passCount', 'max', 'min',
];

function sameMetrics(a: SessionMetrics, b: SessionMetrics): boolean {
  return FIELDS.every((k) => a[k] === b[k]);
}
