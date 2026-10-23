import { describe, expect, it } from 'vitest';
import { percentOf, tierOf, isQualified, tierOfPercent } from '../../src/domain/scoring';
import { makeScheme, e, score, g, text } from '../fixtures';

describe('scoring：percentOf（设计 §6.1）', () => {
  const s = makeScheme('mixed', { maxScore: 120 });

  it('分数按满分折算：118/120 = 98.33%', () => {
    expect(percentOf(e(score(118)), s)).toBeCloseTo(98.333, 3);
  });

  it('等级走 GRADE_PERCENT：A+ = 100、A- = 90、D = 55', () => {
    expect(percentOf(e(g('A+')), s)).toBe(100);
    expect(percentOf(e(g('A-')), s)).toBe(90);
    expect(percentOf(e(g('D')), s)).toBe(55);
  });

  it('文本与纯过关不可折算 → null', () => {
    expect(percentOf(e(text('半对')), s)).toBeNull();
    expect(percentOf(e({ kind: 'pass' }), s)).toBeNull();
  });

  it('请假 / 缺交 / 空 → null', () => {
    expect(percentOf(e(score(90), { status: 'leave' }), s)).toBeNull();
    expect(percentOf(e(null, { status: 'missing' }), s)).toBeNull();
    expect(percentOf(e(null), s)).toBeNull();
  });

  it('maxScore 缺失时按 100 兜底（INV-21，绝不全灰）', () => {
    expect(percentOf(e(score(90)), makeScheme('score', { maxScore: null }))).toBe(90);
  });
});

describe('scoring：tierOf 边界（恰好命中）', () => {
  const s = makeScheme('score', { maxScore: 100, excellentRate: 0.9, goodRate: 0.8, passRate: 0.6 });

  it('90 → 优秀、89.9 → 良好、80 → 良好、79.9 → 及格、60 → 及格、59.9 → 不及格', () => {
    expect(tierOf(e(score(90)), s)).toBe('excellent');
    expect(tierOf(e(score(89.9)), s)).toBe('good');
    expect(tierOf(e(score(80)), s)).toBe('good');
    expect(tierOf(e(score(79.9)), s)).toBe('pass');
    expect(tierOf(e(score(60)), s)).toBe('pass');
    expect(tierOf(e(score(59.9)), s)).toBe('fail');
  });

  it('A-（90%）不被浮点误判成良好（设计 §8.1 铁律）', () => {
    expect(tierOfPercent(90, s)).toBe('excellent');
    expect(90 * 10 + 1e-9 >= Math.round(0.9 * 1000)).toBe(true);
  });

  it('B+（85%）在默认阈值下是良好，不是优秀', () => {
    expect(tierOf(e(g('B+')), s)).toBe('good');
  });

  it('D（55%）恒为不及格', () => {
    expect(tierOf(e(g('D')), s)).toBe('fail');
  });

  it('满分 120：72 分恰 60% → 及格，71 分 59.17% → 不及格（AC-18.1）', () => {
    const s120 = makeScheme('score', { maxScore: 120 });
    expect(tierOf(e(score(72)), s120)).toBe('pass');
    expect(tierOf(e(score(73)), s120)).toBe('pass');
    expect(tierOf(e(score(71)), s120)).toBe('fail');
  });

  it('阈值改成 85/75/50 后同一分数换档', () => {
    const s2 = makeScheme('score', { excellentRate: 0.85, goodRate: 0.75, passRate: 0.5 });
    expect(tierOf(e(score(86)), s2)).toBe('excellent');
    expect(tierOf(e(score(84)), s2)).toBe('good');
    expect(tierOf(e(score(74)), s2)).toBe('pass');
    expect(tierOf(e(score(49)), s2)).toBe('fail');
  });

  it('isQualified：及格及以上为真', () => {
    expect(isQualified(e(score(60)), s)).toBe(true);
    expect(isQualified(e(score(59)), s)).toBe(false);
    expect(isQualified(e(text('半对')), s)).toBe(false);
  });

  it('无值时 tierOf 为 null（空态显示 —，不是 0 分）', () => {
    expect(tierOf(e(null), s)).toBeNull();
  });
});
