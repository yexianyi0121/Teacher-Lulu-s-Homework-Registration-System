import { describe, expect, it } from 'vitest';
import { classifyRoster } from '../../src/domain/roster';
import { makeSettings, sampleAEntries, sampleBEntries } from '../fixtures';
import type { Entries } from '../../src/domain/types';

const entry = (value: Entries[string]['value'], stamp: Entries[string]['stamp'] = 'none'): Entries[string] => ({
  value,
  stamp,
  updatedAt: 0,
});

describe('classifyRoster（PRD §7.2 样例 B）', () => {
  const groups = classifyRoster('homework', sampleBEntries(), makeSettings({ count: 50 }));

  it('光荣榜 21 / 未提交 1 / 需更正 24 / 已更正 0', () => {
    expect(groups.honor).toHaveLength(21);
    expect(groups.notSubmitted).toEqual([17]);
    expect(groups.needsFix).toHaveLength(24);
    expect(groups.fixed).toEqual([]);
  });

  it('名单互斥且按学号升序', () => {
    const all = [...groups.honor, ...groups.notSubmitted, ...groups.needsFix, ...groups.fixed];
    expect(new Set(all).size).toBe(all.length);
    for (const list of [groups.honor, groups.notSubmitted, groups.needsFix]) {
      expect([...list].sort((a, b) => a - b)).toEqual(list);
    }
    expect(groups.honor).toEqual([1, 2, 5, 6, 9, 10, 12, 14, 22, 24, 28, 32, 33, 34, 36, 37, 40, 41, 44, 49, 50]);
    expect(groups.needsFix).toEqual([3, 4, 8, 11, 13, 15, 16, 18, 19, 20, 21, 25, 27, 29, 30, 31, 35, 38, 42, 43, 45, 46, 47, 48]);
  });

  it('光荣榜含 A 时含 7/23/26/39', () => {
    const g = classifyRoster('homework', sampleBEntries(), makeSettings({ count: 50, honorIncludesA: true }));
    expect(g.honor).toContain(7);
    expect(g.honor).toHaveLength(25);
  });
});

describe('盖章改变名单归类（PRD §6.6）', () => {
  it('给 A- 学号盖「已更正」后从需更正移入已更正，且二者互斥穷尽', () => {
    const entries = sampleBEntries();
    entries['3'] = { ...entries['3'], stamp: 'corrected' };
    const g = classifyRoster('homework', entries, makeSettings({ count: 50 }));
    expect(g.needsFix).toHaveLength(23);
    expect(g.needsFix).not.toContain(3);
    expect(g.fixed).toEqual([3]);
    expect(g.needsFix.length + g.fixed.length).toBe(24);
  });

  it('单元测试：给不及格学号盖章后 needsFix 清空、fixed=[17]', () => {
    const entries = sampleAEntries();
    entries['17'] = { ...entries['17'], stamp: 'corrected' };
    const g = classifyRoster('quiz', entries, makeSettings({ count: 50 }));
    expect(g.needsFix).toEqual([]);
    expect(g.fixed).toEqual([17]);
    expect(g.notSubmitted).toHaveLength(30);
  });
});

describe('样例 A 单元测试名单', () => {
  it('光荣榜 13 / 未提交 30 / 需更正 [17]', () => {
    const g = classifyRoster('quiz', sampleAEntries(), makeSettings({ count: 50 }));
    expect(g.honor).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16]);
    expect(g.notSubmitted).toHaveLength(30);
    expect(g.needsFix).toEqual([17]);
    expect(g.fixed).toEqual([]);
  });

  it('良好/及格档不入任何名单', () => {
    const g = classifyRoster('quiz', sampleAEntries(), makeSettings({ count: 50 }));
    const all = new Set([...g.honor, ...g.notSubmitted, ...g.needsFix, ...g.fixed]);
    for (const no of [4, 14, 15, 18, 19, 20]) expect(all.has(no)).toBe(false);
  });
});

describe('听写默写分拣', () => {
  it('全对/有错/缺交/其他', () => {
    const entries: Entries = {
      '1': entry({ kind: 'text', text: '全对' }),
      '2': entry({ kind: 'text', text: '错2' }),
      '3': entry({ kind: 'text', text: '缺交' }),
      '4': entry({ kind: 'text', text: '字迹工整' }),
      '5': entry({ kind: 'text', text: '错0' }),
    };
    const g = classifyRoster('dictation', entries, makeSettings({ count: 6 }));
    expect(g.honor).toEqual([1, 5]);
    expect(g.needsFix).toEqual([2]);
    expect(g.notSubmitted).toEqual([3, 6]);
    expect(g.fixed).toEqual([]);
  });

  it('空单元格盖章但无值仍计入暂未提交', () => {
    const entries: Entries = { '1': entry(null, 'corrected') };
    const g = classifyRoster('homework', entries, makeSettings({ count: 2 }));
    expect(g.notSubmitted).toEqual([1, 2]);
    expect(g.fixed).toEqual([]);
  });
});
