import { describe, expect, it } from 'vitest';
import { classifyRoster, valueFitsScheme } from '../../src/domain/roster';
import type { Entries, ScoringScheme } from '../../src/domain/types';

const scoreScheme: ScoringScheme = {
  kind: 'score',
  maxScore: 100,
  grades: ['A+', 'A', 'A-', 'B+', 'B', 'C', 'D'],
  allowCheck: false,
  allowText: false,
  decimals: 0,
  excellentRate: 0.9,
  goodRate: 0.8,
  passRate: 0.6,
};

describe('FR-59 值的口径与当前方案不匹配（U-03）', () => {
  it('纯分数制下，等级值不参与名单判定', () => {
    expect(valueFitsScheme({ kind: 'grade', grade: 'A+' }, scoreScheme)).toBe(false);
    expect(valueFitsScheme({ kind: 'score', score: 92 }, scoreScheme)).toBe(true);
  });

  it('切成纯分数制后，存量 A+ 不再进光荣榜', () => {
    const entries = {
      '1': { value: { kind: 'grade', grade: 'A+' }, stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1 },
      '2': { value: { kind: 'score', score: 95 }, stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1 },
    } as unknown as Entries;
    const g = classifyRoster(entries, scoreScheme, 3, { honorIncludesA: false });
    expect(g.honor).toEqual([2]);          // 只有分数 95
    expect(g.needsFix).toEqual([]);        // A+ 不可被判为需更正
    expect(g.notSubmitted).toEqual([3]);
  });
});
