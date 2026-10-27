import { describe, expect, it } from 'vitest';
import { isPassed, isManualPass, passConfigOf } from '../../src/domain/passRule';
import type { ScoringScheme } from '../../src/domain/types';
import { e, g, makeScheme, score, text } from '../fixtures';

/**
 * v2.6.3 FR-72：过关规则不再是一份全局配置，而是每张表的方案自己带。
 * 这里钉死「唯一入口」isPassed 的口径：
 * - 等级值只看本表勾选的等级白名单（不再被及格线兜底翻盘）；
 * - 分数值只看本表选的那条线（及格% / 良好% / 优秀%）；
 * - 缺交 / 请假 / 听写全对分别由本表开关决定；
 * - 手工过关（盖章 / √）永远算过关。
 */

const gradeScheme = makeScheme('grade');
const scoreScheme = makeScheme('score');
const mixedScheme = makeScheme('mixed');
const checkScheme = makeScheme('check');

describe('isPassed：空白 / 缺交 / 请假', () => {
  it('空白一律不过关', () => {
    expect(isPassed(undefined, checkScheme)).toBe(false);
    expect(isPassed(e(null), checkScheme)).toBe(false);
  });

  it('缺交、请假默认不过关（本表开关默认关）', () => {
    expect(isPassed(e(null, { status: 'missing' }), gradeScheme)).toBe(false);
    expect(isPassed(e(null, { status: 'leave' }), gradeScheme)).toBe(false);
  });

  it('本表打开「缺交算过关」「请假算过关」后按开关判', () => {
    const on: ScoringScheme = { ...gradeScheme, missingPass: true, leavePass: true };
    expect(isPassed(e(null, { status: 'missing' }), on)).toBe(true);
    expect(isPassed(e(null, { status: 'leave' }), on)).toBe(true);
    const half: ScoringScheme = { ...gradeScheme, missingPass: true };
    expect(isPassed(e(null, { status: 'missing' }), half)).toBe(true);
    expect(isPassed(e(null, { status: 'leave' }), half)).toBe(false);
  });
});

describe('isPassed：手工过关永远算过关', () => {
  it('盖章（pass=true）与 √（kind=pass）都不受规则影响', () => {
    expect(isPassed(e(null, { pass: true }), checkScheme)).toBe(true);
    expect(isPassed(e({ kind: 'pass' }), gradeScheme)).toBe(true);
    expect(isManualPass(e(null, { pass: true }))).toBe(true);
    expect(isManualPass(e(g('D')))).toBe(false);
  });
});

describe('isPassed：等级制（grade）只认等级白名单', () => {
  it('默认白名单 A+/A：A- 不过关（旧版被 90% 的及格线兜底翻盘，v2.6.3 修掉）', () => {
    expect(passConfigOf(gradeScheme).gradePass).toEqual(['A+', 'A']);
    expect(isPassed(e(g('A-')), gradeScheme)).toBe(false);
    expect(isPassed(e(g('B')), gradeScheme)).toBe(false);
  });

  it('勾上 A- 后 A- 过关，B 仍不过关', () => {
    const s: ScoringScheme = { ...gradeScheme, gradePass: ['A+', 'A', 'A-'] };
    expect(isPassed(e(g('A-')), s)).toBe(true);
    expect(isPassed(e(g('B')), s)).toBe(false);
  });

  it('A+ 永远在白名单默认里', () => {
    expect(isPassed(e(g('A+')), gradeScheme)).toBe(true);
  });
});

describe('isPassed：分数制（score）按本表选的那条线', () => {
  it('默认「达到及格%」：85 过关、50 不过关（及格线 60%）', () => {
    expect(isPassed(e(score(85)), scoreScheme)).toBe(true);
    expect(isPassed(e(score(60)), scoreScheme)).toBe(true);
    expect(isPassed(e(score(50)), scoreScheme)).toBe(false);
  });

  it('选「达到良好%」后 70 不算过关了', () => {
    const s: ScoringScheme = { ...scoreScheme, scorePassTier: 'good' };
    expect(isPassed(e(score(85)), s)).toBe(true);
    expect(isPassed(e(score(70)), s)).toBe(false);
  });

  it('选「达到优秀%」后只有 90 以上过关', () => {
    const s: ScoringScheme = { ...scoreScheme, scorePassTier: 'excellent' };
    expect(isPassed(e(score(92)), s)).toBe(true);
    expect(isPassed(e(score(85)), s)).toBe(false);
  });
});

describe('isPassed：混合制（mixed）等级看白名单、分数看线', () => {
  it('等级值走白名单：A- 不过关（这正是老师报的「除 D 外全过关」）', () => {
    for (const letter of ['A-', 'B+', 'B', 'B-', 'C', 'D'] as const) {
      expect(isPassed(e(g(letter)), mixedScheme)).toBe(false);
    }
    expect(isPassed(e(g('A+')), mixedScheme)).toBe(true);
    expect(isPassed(e(g('A')), mixedScheme)).toBe(true);
  });

  it('把最低及格线压到 7% 也不会让等级值翻盘（旧版 47 分、22 分、7 分全过关）', () => {
    const s: ScoringScheme = { ...mixedScheme, passRate: 0.07 };
    expect(isPassed(e(g('D')), s)).toBe(false);
    expect(isPassed(e(g('C')), s)).toBe(false);
  });

  it('分数值仍按分数线判', () => {
    const s: ScoringScheme = { ...mixedScheme, passRate: 0.07 };
    expect(isPassed(e(score(47)), s)).toBe(true);
    expect(isPassed(e(score(6)), s)).toBe(false);
  });
});

describe('isPassed：听写文本', () => {
  it('全对：本表开关开则过关，关则不过关', () => {
    expect(isPassed(e(text('全对')), checkScheme)).toBe(true);
    expect(isPassed(e(text('全对')), { ...checkScheme, dictationAutoPass: false })).toBe(false);
  });

  it('错N 永不过关', () => {
    expect(isPassed(e(text('错1')), checkScheme)).toBe(false);
  });
});
