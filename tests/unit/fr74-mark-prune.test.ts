import { describe, expect, it } from 'vitest';
import { pruneEntries } from '../../src/domain/scheme';
import type { Entries, ScoringScheme } from '../../src/domain/types';

const base: ScoringScheme = {
  kind: 'grade', maxScore: null,
  grades: ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D'],
  allowCheck: true, allowText: true, decimals: 0,
  excellentRate: 0.9, goodRate: 0.8, passRate: 0.6,
  gradePass: ['A+', 'A'],
};

function entries(mark: boolean): Entries {
  return {
    '1': { value: { kind: 'grade', grade: 'A' }, stamp: 'none', status: 'normal', pass: mark, makeup: null, updatedAt: 0 },
    '2': { value: { kind: 'grade', grade: 'C' }, stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 0 },
  };
}

describe('pruneEntries：取消「允许 ✓ 过关标记」要把已打的手工过关一起清（v2.6.4 BUG1）', () => {
  it('取消允许过关标记 → 已打的 G 标记被清掉，值本身保留', () => {
    const { entries: out, cleared } = pruneEntries(entries(true), { ...base, allowCheck: false }, base);
    expect(cleared).toBe(1);
    expect(out['1'].pass).toBe(false);
    expect(out['1'].value).toEqual({ kind: 'grade', grade: 'A' });
  });

  it('只有标记、没有值的格子也要清（老师报的就是这一格）', () => {
    // 键 G 会把值顶掉，格子里只剩 pass=true、value=null —— 早期实现把这种格子当空格子跳过，于是永远不提示
    const only = {
      '1': { value: null, stamp: 'none' as const, status: 'normal' as const, pass: true, makeup: null, updatedAt: 0 },
    };
    const { entries: out, cleared } = pruneEntries(only, { ...base, allowCheck: false }, base);
    expect(cleared).toBe(1);
    expect(out['1'].pass).toBe(false);
  });

  it('没打过标记时不影响任何格子', () => {
    const { cleared } = pruneEntries(entries(false), { ...base, allowCheck: false }, base);
    expect(cleared).toBe(0);
  });

  it('还允许过关标记时不提示、不清空', () => {
    const { cleared } = pruneEntries(entries(true), { ...base }, base);
    expect(cleared).toBe(0);
  });

  it('check 制表本身按 ✓ 过关，即使 allowCheck 关掉也不清标记', () => {
    const { entries: out } = pruneEntries(entries(true), { ...base, kind: 'check', allowCheck: false }, base);
    // 等级值在 check 制下不再适用（值被清），但「手打过关」这个标记属于 check 制本身，必须留着
    expect(out['1'].pass).toBe(true);
    expect(out['1'].value).toBeNull();
  });
});
