import { describe, expect, it } from 'vitest';
import { readHealth, shouldBlockOverwrite } from '../../src/infra/storageHealth';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import type { PersistedStateV3 } from '../../src/domain/types';
import { studentsOf } from '../fixtures';

function state(records = 0, history = 0): PersistedStateV3 {
  return {
    version: 3,
    activeClassId: 'cls_1',
    classes: [{ id: 'cls_1', name: '三年二班', school: '', teacher: '', subject: '语文', students: studentsOf(5), count: 5, createdAt: 1 }],
    records: Array.from({ length: records }, (_, i) => ({
      key: `k${i}`, classId: 'cls_1', date: '2026-10-20', content: '', sheetId: `s${i}`, templateId: 'homework' as const,
      scheme: { kind: 'grade' as const, maxScore: null, grades: ['A+' as const], allowCheck: true, allowText: true, decimals: 0, excellentRate: 0.9, goodRate: 0.8, passRate: 0.6 },
      entries: {}, createdAt: i, updatedAt: i,
    })),
    history: Array.from({ length: history }, (_, i) => ({
      key: `h${i}`, classId: 'cls_1', date: '2026-10-19', content: '', sheetId: `h${i}`, templateId: 'homework' as const,
      scheme: { kind: 'grade' as const, maxScore: null, grades: ['A+' as const], allowCheck: true, allowText: true, decimals: 0, excellentRate: 0.9, goodRate: 0.8, passRate: 0.6 },
      entries: {}, createdAt: i, updatedAt: i, savedAt: i, metricsVersion: 2 as const,
      metrics: { n: 5, entered: 0, excellent: 0, good: 0, pass: 0, fail: 0, missing: 0, leave: 0, madeUp: 0, notSubmitted: 5, avgPercent: null, avgScore: null, excellentRate: null, qualifiedRate: null, passCount: 0, max: null, min: null },
    })),
    pointRules: [],
    pointLedger: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSavedAt: 1,
  };
}

describe('shouldBlockOverwrite：空覆盖保护（BR-75 / INV-24）', () => {
  it('首次启动（磁盘无内容）→ 放行', () => {
    expect(shouldBlockOverwrite(state(0, 0), null)).toBe(false);
  });

  it('磁盘 JSON 损坏 → 放行（有快照兜底，不能永远写不进去）', () => {
    expect(shouldBlockOverwrite(state(0, 0), '{oops')).toBe(false);
  });

  it('内存空 + 磁盘非空 → 拦截', () => {
    expect(shouldBlockOverwrite(state(0, 0), JSON.stringify(state(2, 1)))).toBe(true);
  });

  it('内存非空 → 放行（改数据不拦）', () => {
    expect(shouldBlockOverwrite(state(1, 0), JSON.stringify(state(2, 1)))).toBe(false);
  });

  it('内存与磁盘都空 → 放行', () => {
    expect(shouldBlockOverwrite(state(0, 0), JSON.stringify(state(0, 0)))).toBe(false);
  });
});

describe('readHealth：健康面板数字', () => {
  it('记录 / 历史 / 班级 / 键名 / 字节', () => {
    const h = readHealth(state(2, 3), 5);
    expect(h.records).toBe(2);
    expect(h.history).toBe(3);
    expect(h.classes).toBe(1);
    expect(h.key).toBe('xq.state.v3');
    expect(h.bytes).toBeGreaterThan(0);
    expect(h.snapshotCount).toBe(5);
  });
});
