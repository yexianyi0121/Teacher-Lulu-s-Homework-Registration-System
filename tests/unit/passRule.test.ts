import { describe, expect, it } from 'vitest';
import { isPassed, isManualPass, DEFAULT_PASS_RULE } from '../../src/domain/passRule';
import type { PassRule } from '../../src/domain/types';
import { e, g, makeScheme, score, text } from '../fixtures';

const check = makeScheme('check');
const grade = makeScheme('grade');
const scoreScheme = makeScheme('score');

const gradeRule = (gradePass: PassRule['gradePass']): PassRule => ({ ...DEFAULT_PASS_RULE, kind: 'grade', gradePass });
const percentRule: PassRule = { ...DEFAULT_PASS_RULE, kind: 'percent' };

describe('isPassed：唯一入口的状态矩阵', () => {
  it('空白 / 缺交 / 请假 一律不过关', () => {
    expect(isPassed(undefined, check, DEFAULT_PASS_RULE)).toBe(false);
    expect(isPassed(e(null, { status: 'missing' }), check, DEFAULT_PASS_RULE)).toBe(false);
    expect(isPassed(e(null, { status: 'leave' }), check, DEFAULT_PASS_RULE)).toBe(false);
  });

  it('手工 √ 永远过关（不受规则影响）', () => {
    expect(isPassed(e(null, { pass: true }), check, percentRule)).toBe(true);
    expect(isPassed(e({ kind: 'pass' }), check, gradeRule(['D']))).toBe(true);
    expect(isManualPass(e(null, { pass: true }))).toBe(true);
  });

  it('分数按及格线：85 过关、50 不过关（三种规则一致）', () => {
    for (const rule of [DEFAULT_PASS_RULE, percentRule, gradeRule(['A+'])]) {
      expect(isPassed(e(score(85)), scoreScheme, rule)).toBe(true);
      expect(isPassed(e(score(50)), scoreScheme, rule)).toBe(false);
    }
  });
});

describe('isPassed：等级白名单（AC-32.2）', () => {
  it('percent 规则：A-（90%）过关', () => {
    expect(isPassed(e(g('A-')), grade, percentRule)).toBe(true);
  });

  it('grade 规则 + 只认 A/A+：A- 不过关', () => {
    expect(isPassed(e(g('A-')), grade, gradeRule(['A+', 'A']))).toBe(false);
  });

  it('grade 规则 + 勾上 A-：A- 过关', () => {
    expect(isPassed(e(g('A-')), grade, gradeRule(['A+', 'A', 'A-']))).toBe(true);
  });

  it('mixed 规则：A- 因百分达标而过关（默认口径，保证样例 C 不变）', () => {
    expect(isPassed(e(g('A-')), grade, DEFAULT_PASS_RULE)).toBe(true);
  });

  it('D（55%）任何规则都不过关', () => {
    for (const rule of [DEFAULT_PASS_RULE, percentRule, gradeRule(['A+', 'A'])]) {
      expect(isPassed(e(g('D')), grade, rule)).toBe(false);
    }
  });
});

describe('isPassed：听写文本', () => {
  it('全对：dictationAutoPass=true 过关，false 不过关', () => {
    expect(isPassed(e(text('全对')), check, DEFAULT_PASS_RULE)).toBe(true);
    expect(isPassed(e(text('全对')), check, { ...DEFAULT_PASS_RULE, dictationAutoPass: false })).toBe(false);
  });

  it('错N 永不过关', () => {
    expect(isPassed(e(text('错1')), check, DEFAULT_PASS_RULE)).toBe(false);
  });
});
