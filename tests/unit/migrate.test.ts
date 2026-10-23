import { describe, expect, it } from 'vitest';
import { migrate, isV1State, isV2State, UnknownStateError, V1_CLASS_ID } from '../../src/domain/migrate';
import { percentOf } from '../../src/domain/scoring';
import { classifyRoster } from '../../src/domain/roster';
import { computeStats } from '../../src/domain/stats';
import type { PersistedStateV1, PersistedStateV2 } from '../../src/domain/types';

/** 构造一份最小的 V1 存档 */
function v1State(): PersistedStateV1 {
  const entries = {
    '1': { value: { kind: 'grade', grade: 'A+' }, stamp: 'none' as const, updatedAt: 1 },
    '2': { value: { kind: 'grade', grade: 'CHECK' }, stamp: 'none' as const, updatedAt: 1 },
    '3': { value: { kind: 'grade', grade: 'CROSS' }, stamp: 'none' as const, updatedAt: 1 },
    '4': { value: { kind: 'score', score: 98 }, stamp: 'none' as const, updatedAt: 1 },
    '5': { value: { kind: 'text', text: '错2' }, stamp: 'none' as const, updatedAt: 1 },
  };
  return {
    version: 1,
    classInfo: {
      name: '三年二班', school: '某某中学', teacher: '刘露', subject: '语文',
      students: [
        { no: 1 }, { no: 2 }, { no: 3 }, { no: 4 }, { no: 5 },
      ],
      count: 5,
    },
    drafts: {
      'k1': {
        id: 'k1', date: '2026-03-13', content: '语文本', mode: 'quiz',
        entries, createdAt: 1, updatedAt: 1,
      },
    },
    activeKey: 'k1',
    history: [
      {
        id: 'h1', date: '2026-03-12', content: '语文本', mode: 'quiz',
        createdAt: 1, updatedAt: 1,
        entries,
        metrics: {
          entered: 4, avg: 87.7, excellent: 13, good: 3, pass: 3, fail: 1,
          excellentRate: 65, corrected: 0, notSubmitted: 30, max: 98, min: 43,
        },
        savedAt: 1,
      },
    ],
    settings: { count: 5, secondsJump: true, showName: false, excellentLine: 90, passLine: 60 },
  };
}

describe('migrate：v1 → v2（设计 §4.6.4 M-1 ~ M-8）', () => {
  const raw = v1State();
  const snapshot = JSON.stringify(raw);
  const { state, migrated } = migrate(raw);

  it('识别 v1 并返回 migrated=true', () => {
    expect(isV1State(raw)).toBe(true);
    expect(migrated).toBe(true);
    expect(isV2State(state)).toBe(true);
  });

  it('M-1：A+ 原样保留，percentOf = 100', () => {
    const e = state.records[0].entries['1'];
    expect(e.value).toEqual({ kind: 'grade', grade: 'A+' });
    expect(percentOf(e, state.records[0].scheme)).toBe(100);
  });

  it('M-2：√ → pass=true 且不在光荣榜', () => {
    const e = state.records[0].entries['2'];
    expect(e.value).toBeNull();
    expect(e.pass).toBe(true);
    const groups = classifyRoster(state.records[0].entries, state.records[0].scheme, 5, { honorIncludesA: false });
    expect(groups.honor).not.toContain(2);
    expect(groups.passed).toContain(2);
  });

  it('M-3：× → status=missing 且进暂未提交', () => {
    const e = state.records[0].entries['3'];
    expect(e.status).toBe('missing');
    const groups = classifyRoster(state.records[0].entries, state.records[0].scheme, 5, { honorIncludesA: false });
    expect(groups.notSubmitted).toContain(3);
  });

  it('M-4：旧历史 metrics 保留原值，metricsVersion=1，excellentRate 折成 0-1', () => {
    const h = state.history[0];
    expect(h.metricsVersion).toBe(1);
    expect(h.metrics.avgPercent).toBe(87.7);
    expect(h.metrics.excellent).toBe(13);
    expect(h.metrics.excellentRate).toBeCloseTo(0.65, 5);
  });

  it('M-5：不含 √ 的记录，迁移前后有值人数一致', () => {
    const onlyScores: PersistedStateV1 = {
      ...raw,
      drafts: {
        k: {
          id: 'k', date: '2026-03-13', content: 'x', mode: 'quiz',
          entries: { '1': { value: { kind: 'score', score: 90 }, stamp: 'none', updatedAt: 1 } },
          createdAt: 1, updatedAt: 1,
        },
      },
      history: [],
    };
    const out = migrate(onlyScores).state;
    const before = Object.values(onlyScores.drafts.k.entries).filter((e) => e.value !== null).length;
    const after = computeStats(out.records[0].entries, out.records[0].scheme, 5, false).entered;
    expect(after).toBe(before);
  });

  it('M-6：class.count === students.length，且 id 为 cls_default', () => {
    expect(state.classes[0].count).toBe(state.classes[0].students.length);
    expect(state.classes[0].id).toBe(V1_CLASS_ID);
    expect(state.activeClassId).toBe(V1_CLASS_ID);
  });

  it('activeClassId/records 键含 classId，sheetId 按模板推导', () => {
    const r = state.records[0];
    expect(r.key.startsWith(`${V1_CLASS_ID}|`)).toBe(true);
    expect(r.templateId).toBe('quality');       // quiz → quality（FR-19）
    expect(r.sheetId).toBe('sheet_default_quality');
    expect(r.scheme.kind).toBe('score');
  });

  it('homework → grade 方案、dictation → check 方案', () => {
    const s: PersistedStateV1 = {
      ...raw,
      drafts: {
        a: { id: 'a', date: '2026-03-13', content: 'x', mode: 'homework', entries: {}, createdAt: 1, updatedAt: 1 },
        b: { id: 'b', date: '2026-03-13', content: 'y', mode: 'dictation', entries: {}, createdAt: 1, updatedAt: 2 },
      },
      history: [],
    };
    const out = migrate(s).state;
    const hw = out.records.find((r) => r.templateId === 'homework')!;
    const dict = out.records.find((r) => r.templateId === 'dictation')!;
    expect(hw.scheme.kind).toBe('grade');
    expect(hw.scheme.grades).toEqual(['A+', 'A', 'A-', 'B', 'C', 'D']);
    expect(dict.scheme.kind).toBe('check');
  });

  it('v1 的绝对分数线转成比例（90/60 → .90/.60）', () => {
    expect(state.records[0].scheme.excellentRate).toBe(0.9);
    expect(state.records[0].scheme.passRate).toBe(0.6);
  });

  it('新根字段：pointRules 8 条、pointLedger 空、settings 迁移', () => {
    expect(state.pointRules).toHaveLength(8);
    expect(state.pointLedger).toEqual([]);
    expect(state.settings.secondsJump).toBe(true);
    expect(state.settings.voiceEnabled).toBe(true);
    expect(state.version).toBe(2);
  });

  it('M-7：对 v2 输入重复调用返回同一对象、migrated=false', () => {
    const again = migrate(state);
    expect(again.migrated).toBe(false);
    expect(again.state).toBe(state);
  });

  it('M-8：未知结构抛 UNKNOWN_STATE 且不修改入参', () => {
    const bad = { hello: 'world' };
    expect(() => migrate(bad)).toThrow(UnknownStateError);
    expect(bad).toEqual({ hello: 'world' });
  });

  it('迁移不可变：原始对象未被改写', () => {
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it('迁移结果可直接持久化（无 undefined / NaN）', () => {
    const json = JSON.stringify(state as PersistedStateV2);
    expect(json).not.toContain('undefined');
    expect(json).not.toContain('NaN');
  });
});
