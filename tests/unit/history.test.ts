import { describe, expect, it } from 'vitest';
import { refreshHistoryMetrics } from '../../src/domain/history';
import type { Entries, HistoryEntry, PersistedStateV2, ScoringScheme } from '../../src/domain/types';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import { makeScheme, studentsOf, e, text } from '../fixtures';

/** v2.0.0 把听写历史的 entered 存成 0（F1），loadState 需要无损自愈 */

function dictationEntries(): Entries {
  const entries: Entries = {};
  for (let no = 1; no <= 45; no++) entries[String(no)] = e(null, { pass: true });
  for (let no = 46; no <= 50; no++) entries[String(no)] = e(text('错2'));
  return entries;
}

function historyOf(over: Partial<HistoryEntry>): HistoryEntry {
  return {
    key: 'cls_1|2026-10-23|听写|sheet_d1',
    classId: 'cls_1',
    date: '2026-10-23',
    content: '听写',
    sheetId: 'sheet_d1',
    templateId: 'dictation',
    scheme: makeScheme('check') as ScoringScheme,
    entries: dictationEntries(),
    createdAt: 1,
    updatedAt: 1,
    metricsVersion: 2,
    savedAt: 1,
    metrics: {
      n: 50, entered: 0, excellent: 0, good: 0, pass: 0, fail: 0,
      missing: 0, leave: 0, madeUp: 0, notSubmitted: 50,
      avgPercent: null, avgScore: null, excellentRate: null, qualifiedRate: null,
      passCount: 45, max: null, min: null,
    },
    ...over,
  };
}

function stateWith(history: HistoryEntry[]): PersistedStateV2 {
  return {
    version: 2,
    activeClassId: 'cls_1',
    classes: [{
      id: 'cls_1', name: '三年二班', school: '', teacher: '刘露', subject: '语文',
      students: studentsOf(50), count: 50, createdAt: 1,
    }],
    records: [],
    history,
    pointRules: [],
    pointLedger: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSavedAt: 1,
  };
}

describe('refreshHistoryMetrics：历史 metrics 自愈', () => {
  it('把 v2.0.0 听写历史的 entered 0 → 50、未提交 50 → 0、passCount 保留', () => {
    const state = refreshHistoryMetrics(stateWith([historyOf({})]));
    const m = state.history[0].metrics;
    expect(m.entered).toBe(50);
    expect(m.notSubmitted).toBe(0);
    expect(m.passCount).toBe(45);
    expect(m.avgPercent).toBeNull();     // 过关制没有百分
  });

  it('metricsVersion = 1 的 v1 迁移历史不改（§4.6.5 不重算）', () => {
    const legacy = historyOf({ metricsVersion: 1 });
    const state = refreshHistoryMetrics(stateWith([legacy]));
    expect(state.history[0]).toBe(legacy);
    expect(state.history[0].metrics.entered).toBe(0);
  });

  it('幂等：已正确的历史原样返回（同一对象引用）', () => {
    const once = refreshHistoryMetrics(stateWith([historyOf({})]));
    const twice = refreshHistoryMetrics(once);
    expect(twice.history[0]).toBe(once.history[0]);
  });

  it('班级已删除时按记录里最大学号兜底，不崩', () => {
    const orphan = historyOf({ classId: 'cls_gone' });
    const state = refreshHistoryMetrics({ ...stateWith([orphan]), classes: [] });
    expect(state.history[0].metrics.n).toBe(50);
    expect(state.history[0].metrics.entered).toBe(50);
  });

  it('空历史直接返回原状态', () => {
    const state = stateWith([]);
    expect(refreshHistoryMetrics(state)).toBe(state);
  });
});
