import { describe, expect, it } from 'vitest';
import { readHealth, shouldBlockOverwrite } from '../../src/infra/storageHealth';
import { DEFAULT_SETTINGS } from '../../src/domain/constants';
import type { PersistedStateV4 } from '../../src/domain/types';
import { studentsOf } from '../fixtures';

function state(records = 0, history = 0): PersistedStateV4 {
  return {
    version: 4,
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

  // v2.5.7 事故回归：老师打开一个「当天还没开始登记」的空表，磁盘上有别的日子的成绩，
  // 旧判据（records/history 是否为空）会判成「内存空 + 磁盘非空」→ 永久只读，
  // 连「清空并重来」都救不回来（清空后还是空）。名单还在就不是数据丢失。
  it('内存是正常空当天（名单还在）+ 磁盘有成绩 → 放行，不许拦', () => {
    expect(shouldBlockOverwrite(state(0, 0), JSON.stringify(state(2, 1)))).toBe(false);
  });

  it('清空并重来（名单还在、记录清零）→ 放行，不能又把老师锁回只读', () => {
    expect(shouldBlockOverwrite(state(0, 0), JSON.stringify(state(5, 9)))).toBe(false);
  });

  it('内存连名单都没有了（真丢数据）+ 磁盘有成绩 → 拦截', () => {
    const wiped = { ...state(0, 0), classes: [] } as unknown as PersistedStateV4;
    expect(shouldBlockOverwrite(wiped, JSON.stringify(state(2, 1)))).toBe(true);
  });

  it('内存非空 → 放行（改数据不拦）', () => {
    expect(shouldBlockOverwrite(state(1, 0), JSON.stringify(state(2, 1)))).toBe(false);
  });

  it('磁盘只有空当天、没有成绩 → 放行（没东西可保护）', () => {
    const wiped = { ...state(0, 0), classes: [] } as unknown as PersistedStateV4;
    expect(shouldBlockOverwrite(wiped, JSON.stringify(state(0, 0)))).toBe(false);
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
    expect(h.key).toBe('xq.state.v4');
    expect(h.bytes).toBeGreaterThan(0);
    expect(h.snapshotCount).toBe(5);
  });
});
