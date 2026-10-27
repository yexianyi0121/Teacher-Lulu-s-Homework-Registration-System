import { describe, expect, it } from 'vitest';
import { isPassed } from '../../src/domain/passRule';
import { GRADE_LETTERS, applyGradeModifier, gradeAllowed } from '../../src/domain/grading';
import { GRADE_ORDER } from '../../src/domain/constants';
import { makeScheme } from '../fixtures';
import type { Entry, GradeLetter, ScoringScheme } from '../../src/domain/types';

/**
 * v2.6.1 / v2.6.3 回归（FR-70 + FR-72）：
 * - FR-70.1：mixed 曾经「等级值达到及格线也算过关」（docs/05 FR-32 规则 2 的并集口径），
 *   结果老师把及格% 调成个位数后，除 D 外全班过关。v2.6.3 起改为：**等级值只看本表勾选的白名单**，
 *   分数线只作用于分数值——这条测试钉死新口径，防止回退。
 * - FR-70.2：及格% 的下限防线（低于 5% 不入库）在 SchemeModal 里，这里守住「低及格线的放大效应」这个事实。
 * - FR-70.3：GRADE_LETTERS 必须与 GRADE_ORDER 一致（v2.5.9 加 B- 时漏过）。
 * - FR-70.4/70.5：录入侧 gradeAllowed 对 8 档全放行。
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

describe('FR-70.1（v2.6.3 新口径）：等级值只看白名单，不再被及格线兜底', () => {
  it('只勾 A+/A：A-（90%）不过关 —— 老师报的「除 D 外全过关」已修掉', () => {
    expect(isPassed(e('A-'), highPass)).toBe(false);
    expect(isPassed(e('A-'), { ...highPass, gradePass: ['A+', 'A', 'A-'] })).toBe(true);
  });

  it('勾了 C 没勾 D：C 过关、D 不过关（老师数据里的真实配置）', () => {
    const s: ScoringScheme = { ...grade, gradePass: ['A+', 'A', 'B+', 'B', 'C'] };
    expect(isPassed(e('C'), s)).toBe(true);
    expect(isPassed(e('D'), s)).toBe(false);
  });

  it('及格线被压到 7% 时等级值也不会翻盘', () => {
    expect(isPassed(e('D'), lowPass)).toBe(false);
    expect(isPassed(e('C'), lowPass)).toBe(false);
  });
});

describe('FR-70.2：及格% 被误设成 7% 时对分数值的放大效应（防线为何必要）', () => {
  it('passRate=0.07 时 7 分以上的分数全部过关', () => {
    for (const v of [47, 22, 7]) expect(isPassed(sc(v), lowPass)).toBe(true);
    expect(isPassed(sc(6), lowPass)).toBe(false);
  });

  it('及格线回到 60% 后同样的分数不再过关', () => {
    expect(isPassed(sc(47), highPass)).toBe(false);
  });

  it('分数制可选「良好% / 优秀% 才算过关」', () => {
    expect(isPassed(sc(70), { ...lowPass, scorePassTier: 'good' })).toBe(false);
    expect(isPassed(sc(92), { ...lowPass, scorePassTier: 'excellent' })).toBe(true);
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
