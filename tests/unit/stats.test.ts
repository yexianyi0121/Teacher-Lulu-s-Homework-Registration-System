import { describe, expect, it } from 'vitest';
import { computeStats, emptyStats } from '../../src/domain/stats';
import { makeScheme, sampleAEntries, sampleBEntries, sampleCEntries, SAMPLE_C_SCHEME, EXPECTED_C, e, score, g, text } from '../fixtures';

describe('stats：样例 A（V1 回归）', () => {
  const s = makeScheme('score');
  const m = computeStats(sampleAEntries(), s, 50, false);

  it('20 / 87.7 / 13-3-3-1 / 未提交 30', () => {
    expect(m.entered).toBe(20);
    expect(m.avgPercent).toBe(87.7);
    expect(m.avgScore).toBe(87.7);
    expect(m.excellent).toBe(13);
    expect(m.good).toBe(3);
    expect(m.pass).toBe(3);
    expect(m.fail).toBe(1);
    expect(m.notSubmitted).toBe(30);
  });

  it('四档之和 = entered（INV-3）', () => {
    expect(m.excellent + m.good + m.pass + m.fail).toBe(m.entered);
  });

  it('entered + leave + notSubmitted = N', () => {
    expect(m.entered + m.leave + m.notSubmitted).toBe(m.n);
  });
});

describe('stats：样例 C（PRD-V2 §8.1，逐位相等）', () => {
  const m = computeStats(sampleCEntries(), SAMPLE_C_SCHEME, 50, false);

  it('四档 + 三状态 + 两个均值 9 个数', () => {
    expect(m.n).toBe(EXPECTED_C.n);
    expect(m.entered).toBe(EXPECTED_C.entered);
    expect(m.excellent).toBe(EXPECTED_C.excellent);
    expect(m.good).toBe(EXPECTED_C.good);
    expect(m.pass).toBe(EXPECTED_C.pass);
    expect(m.fail).toBe(EXPECTED_C.fail);
    expect(m.missing).toBe(EXPECTED_C.missing);
    expect(m.madeUp).toBe(EXPECTED_C.madeUp);
    expect(m.leave).toBe(EXPECTED_C.leave);
    expect(m.notSubmitted).toBe(EXPECTED_C.notSubmitted);
    expect(m.avgPercent).toBe(EXPECTED_C.avgPercent);
    expect(m.avgScore).toBe(EXPECTED_C.avgScore);
    expect(m.excellentRate).toBe(EXPECTED_C.excellentRate);
    expect(m.qualifiedRate).toBe(EXPECTED_C.qualifiedRate);
  });

  it('三恒等式：可加、补齐、缺交 ≤ 未提交', () => {
    expect(m.excellent + m.good + m.pass + m.fail).toBe(m.entered);
    expect(m.entered + m.leave + m.notSubmitted).toBe(m.n);
    expect(m.missing).toBeLessThanOrEqual(m.notSubmitted);
  });
});

describe('stats：边界', () => {
  it('entered=0 时均值全为 null（不显示 0 / NaN）', () => {
    const m = computeStats({}, makeScheme('score'), 50, false);
    expect(m.entered).toBe(0);
    expect(m.avgPercent).toBeNull();
    expect(m.avgScore).toBeNull();
    expect(m.excellentRate).toBeNull();
    expect(m.qualifiedRate).toBeNull();
    expect(m.notSubmitted).toBe(50);
  });

  it('请假不计入分母、不进未提交（AC-22.1）', () => {
    const entries = { '1': e(null, { status: 'leave' }) };
    const m = computeStats(entries, makeScheme('score'), 50, false);
    expect(m.leave).toBe(1);
    expect(m.entered).toBe(0);
    expect(m.notSubmitted).toBe(49);
    expect(m.avgPercent).toBeNull();
  });

  it('缺交计入未提交但不进四档（BR-53）', () => {
    const entries = { '1': e(null, { status: 'missing' }) };
    const m = computeStats(entries, makeScheme('score'), 10, false);
    expect(m.missing).toBe(1);
    expect(m.notSubmitted).toBe(10);
    expect(m.entered).toBe(0);
  });

  it('过关（pass）计入 passCount，但不进四档（设计 §16-18）', () => {
    const entries = { '1': e(null, { pass: true }), '2': e(text('全对')) };
    const m = computeStats(entries, makeScheme('check'), 10, false);
    expect(m.passCount).toBe(1);
    expect(m.entered).toBe(0);
    expect(m.excellent + m.good + m.pass + m.fail).toBe(0);
  });

  it('听写「错2」不产生百分（只算文字标记）', () => {
    const m = computeStats({ '1': e(text('错2')) }, makeScheme('check'), 5, false);
    expect(m.entered).toBe(0);
    expect(m.avgPercent).toBeNull();
  });

  it('等级制的四档按百分算：A- = 90% 计入优秀', () => {
    const entries = { '1': e(g('A-')), '2': e(g('A+')), '3': e(g('D')) };
    const m = computeStats(entries, makeScheme('grade'), 10, false);
    expect(m.excellent).toBe(2);
    expect(m.fail).toBe(1);
    expect(m.entered).toBe(3);
  });

  it('BR-40：只统计 1..count，隐藏键不参与', () => {
    const entries = { '1': e(score(90)), '45': e(score(100)) };
    const m = computeStats(entries, makeScheme('score'), 40, false);
    expect(m.entered).toBe(1);
    expect(m.avgPercent).toBe(90);
  });

  it('emptyStats 字段齐全且未提交 = N', () => {
    const m = emptyStats(30);
    expect(Object.keys(m).length).toBeGreaterThan(15);
    expect(m.notSubmitted).toBe(30);
  });
});

describe('stats：样例 B（等级制回归）', () => {
  it('录入 49、四档按百分：A+/A/A- 都是优秀（24+4+21）、未提交 1', () => {
    const m = computeStats(sampleBEntries(), makeScheme('grade'), 50, false);
    expect(m.entered).toBe(49);
    // A+=100、A=95、A-=90 都 ≥ 优秀线 90% → 全部计入优秀（PRD-V2 §2.3.1 的口径差异）
    expect(m.excellent).toBe(49);
    expect(m.good).toBe(0);
    expect(m.fail).toBe(0);
    expect(m.leave).toBe(0);
    expect(m.notSubmitted).toBe(1);
    expect(m.avgPercent).not.toBeNull();
  });
});
