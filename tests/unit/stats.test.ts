import { describe, expect, it } from 'vitest';
import { computeStats } from '../../src/domain/stats';
import { makeSettings, sampleAEntries, sampleBEntries } from '../fixtures';

describe('computeStats（PRD §7.1 样例 A）', () => {
  const settings = makeSettings({ count: 50 });

  it('20 / 87.7 / 13 / 3 / 3 / 1，未提交 30', () => {
    const m = computeStats('quiz', sampleAEntries(), settings);
    expect(m.entered).toBe(20);
    expect(m.avg).toBe(87.7);
    expect(m.excellent).toBe(13);
    expect(m.good).toBe(3);
    expect(m.pass).toBe(3);
    expect(m.fail).toBe(1);
    expect(m.notSubmitted).toBe(30);
    expect(m.max).toBe(98);
    expect(m.min).toBe(43);
    expect(m.corrected).toBe(0);
  });

  it('四档之和恒等于录入人数', () => {
    const m = computeStats('quiz', sampleAEntries(), settings);
    expect(m.excellent + m.good + m.pass + m.fail).toBe(m.entered);
  });

  it('空数据：avg 为 null，未提交 = N', () => {
    const m = computeStats('quiz', {}, settings);
    expect(m.entered).toBe(0);
    expect(m.avg).toBeNull();
    expect(m.excellentRate).toBeNull();
    expect(m.max).toBeNull();
    expect(m.min).toBeNull();
    expect(m.notSubmitted).toBe(50);
  });

  it('优秀线改 85 后区间自动重排', () => {
    const m = computeStats('quiz', sampleAEntries(), makeSettings({ count: 50, excellentLine: 85 }));
    expect(m.excellent).toBe(16);
    expect(m.good).toBe(0);
    expect(m.pass).toBe(3);
    expect(m.fail).toBe(1);
    expect(m.entered).toBe(20);
  });

  it('及格线改 55 后 43 分仍不及格、73 分成及格', () => {
    const m = computeStats('quiz', sampleAEntries(), makeSettings({ count: 50, passLine: 55 }));
    expect(m.fail).toBe(1);
    expect(m.pass).toBe(3);
  });
});

describe('computeStats（常规作业样例 B）', () => {
  it('录入 49 / A+ 21 / A 4 / A- 24 / 未提交 1', () => {
    const m = computeStats('homework', sampleBEntries(), makeSettings({ count: 50 }));
    expect(m.entered).toBe(49);
    expect(m.excellent).toBe(21);
    expect(m.good).toBe(4);
    expect(m.fail).toBe(24);
    expect(m.pass).toBe(0);
    expect(m.notSubmitted).toBe(1);
    expect(m.avg).toBeNull();
  });

  it('光荣榜含 A 时 excellent = 25、good = 0', () => {
    const m = computeStats('homework', sampleBEntries(), makeSettings({ count: 50, honorIncludesA: true }));
    expect(m.excellent).toBe(25);
    expect(m.good).toBe(0);
    expect(m.entered).toBe(49);
  });

  it('已更正计数独立于录入人数', () => {
    const entries = sampleBEntries();
    entries['3'] = { ...entries['3'], stamp: 'corrected' };
    const m = computeStats('homework', entries, makeSettings({ count: 50 }));
    expect(m.corrected).toBe(1);
    expect(m.entered).toBe(49);
  });
});

describe('computeStats（听写默写）', () => {
  it('缺交不计入录入人数，其他文本计入', () => {
    const entries = {
      '1': { value: { kind: 'text' as const, text: '全对' }, stamp: 'none' as const, updatedAt: 0 },
      '2': { value: { kind: 'text' as const, text: '错2' }, stamp: 'none' as const, updatedAt: 0 },
      '3': { value: { kind: 'text' as const, text: '缺交' }, stamp: 'none' as const, updatedAt: 0 },
      '4': { value: { kind: 'text' as const, text: '字迹工整' }, stamp: 'none' as const, updatedAt: 0 },
    };
    const m = computeStats('dictation', entries, makeSettings({ count: 5 }));
    expect(m.entered).toBe(3);
    expect(m.excellent).toBe(1);
    expect(m.good).toBe(1);
    expect(m.notSubmitted).toBe(2);
  });
});

describe('BR-40：人数调小后不参与计算', () => {
  it('count=40 时 41–50 号的值被忽略', () => {
    const entries = sampleBEntries();
    entries['45'] = { value: { kind: 'grade', grade: 'A+' }, stamp: 'none', updatedAt: 0 };
    const m = computeStats('homework', entries, makeSettings({ count: 40 }));
    expect(m.entered).toBe(39);
    expect(m.notSubmitted).toBe(1);
    expect(m.excellent).toBe(17);
  });
});
