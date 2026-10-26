import { describe, expect, it } from 'vitest';
import { isPassed, DEFAULT_PASS_RULE } from '../../src/domain/passRule';
import { GRADE_LETTERS, applyGradeModifier, gradeAllowed } from '../../src/domain/grading';
import { GRADE_ORDER } from '../../src/domain/constants';
import { makeScheme } from '../fixtures';
import type { Entry, GradeLetter, PassRule, ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.1 回归（FR-70）：
 * - FR-70.1：mixed（默认）下「等级值达到及格线也算过关」是 docs/05 FR-32 规则 2 的原文
 *   语义（百分或等级取并集），不得改写成白名单优先；这里把它钉死，防止后人误「修」。
 * - FR-70.2：及格% 的防线。真正把老师坑到的是 passRate 被误设成 0.07，
 *   而阈值输入框没有下限；这里守住「低于 5% 不入库」的判定常量与语义。
 * - FR-70.3：GRADE_LETTERS 必须与 GRADE_ORDER 完全一致（v2.5.9 加 B- 时漏了这里）。
 * - FR-70.4/70.5：录入侧 gradeAllowed 对 8 档全部放行，提示条才有 B- 可显示。
 */

const grade = makeScheme('grade');
const lowPass: ScoringScheme = { ...grade, passRate: 0.07 };
const highPass: ScoringScheme = { ...grade, passRate: 0.6 };

const e = (g: GradeLetter): Entry => ({
  value: { kind: 'grade', grade: g },
  stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1,
});

const sc = (v: number): Entry => ({
  value: { kind: 'score', score: v },
  stamp: 'none', status: 'normal', pass: false, makeup: null, updatedAt: 1,
});

const mixed = (gradePass: PassRule['gradePass']): PassRule => ({ ...DEFAULT_PASS_RULE, kind: 'mixed', gradePass });
const gradeRule = (gradePass: PassRule['gradePass']): PassRule => ({ ...DEFAULT_PASS_RULE, kind: 'grade', gradePass });

describe('FR-70.1：mixed 的并集语义是规格原文，不得改成白名单优先', () => {
  it('mixed + 只勾 A/A+：A-（90%）仍因达到 60% 及格线而过关', () => {
    expect(isPassed(e('A-'), highPass, mixed(['A+', 'A']))).toBe(true);
  });

  it('grade 规则 + 只勾 A/A+：A- 不过关（AC-32.2）', () => {
    expect(isPassed(e('A-'), highPass, gradeRule(['A+', 'A']))).toBe(false);
  });

  it('mixed + 勾了 C 没勾 D：C 过关、D 不过关（老师数据里的真实配置）', () => {
    const rule = mixed(['A+', 'A', 'B+', 'B', 'C']);
    expect(isPassed(e('C'), highPass, rule)).toBe(true);
    expect(isPassed(e('D'), highPass, rule)).toBe(false);
  });

  // D 的百分是 55：只有把及格线压到 55% 及以下才会被 percent 兜底翻盘（这正是老师
  // 把及格% 误设成个位数时的效果），所以这里只断言「及格线高于 55% 时 D 不过关」。
  it('D（55%）在及格线高于 55% 的任何规则下都不过关', () => {
    for (const rate of [0.6, 0.56]) {
      const s: ScoringScheme = { ...grade, passRate: rate };
      expect(isPassed(e('D'), s, DEFAULT_PASS_RULE)).toBe(false);
      expect(isPassed(e('D'), s, gradeRule(['A+', 'A']))).toBe(false);
    }
  });
});

describe('FR-70.2：及格% 被误设成 7% 时的放大效应（防线为何必要）', () => {
  it('passRate=0.07 时 7 分以上的分数全部过关', () => {
    for (const v of [47, 22, 7]) {
      expect(isPassed(sc(v), lowPass, DEFAULT_PASS_RULE)).toBe(true);
    }
    expect(isPassed(sc(6), lowPass, DEFAULT_PASS_RULE)).toBe(false);
  });

  it('及格线回到 60% 后同样的分数不再过关', () => {
    expect(isPassed(sc(47), highPass, DEFAULT_PASS_RULE)).toBe(false);
  });
});

describe('FR-70.3：GRADE_LETTERS 与 GRADE_ORDER 一致（含 B-）', () => {
  it('两个列表完全相等', () => {
    expect([...GRADE_LETTERS]).toEqual([...GRADE_ORDER]);
  });

  it('B- 能被修饰符拼出来（v2.5.9 漏的就是这里）', () => {
    expect(applyGradeModifier('B', '-')).toBe('B-');
    expect(applyGradeModifier('C', '+')).toBeNull();
    expect(applyGradeModifier('D', '-')).toBeNull();
  });
});

describe('FR-70.4/70.5：8 档录入全部放行，提示条才有 B- 可显示', () => {
  it('gradeAllowed 对 8 档全部为真', () => {
    for (const g of GRADE_ORDER) expect(gradeAllowed(g, grade)).toBe(true);
  });

  it('未勾选的等级仍然拦得住', () => {
    const five: ScoringScheme = { ...grade, grades: ['A+', 'A', 'B+', 'B', 'C'] };
    expect(gradeAllowed('D', five)).toBe(false);
    expect(gradeAllowed('A+', five)).toBe(true);
  });
});
