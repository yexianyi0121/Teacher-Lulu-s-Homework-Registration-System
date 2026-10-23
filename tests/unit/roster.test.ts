import { describe, expect, it } from 'vitest';
import { classifyRoster } from '../../src/domain/roster';
import { makeScheme, sampleBEntries, e, score, g, text } from '../fixtures';

describe('roster：样例 B（等级制，PRD-V2 §2.3.1）', () => {
  const s = makeScheme('grade');
  const groups = classifyRoster(sampleBEntries(), s, 50, { honorIncludesA: false });

  it('光荣榜 25（A+ 21 + A 4）、需更正 24（A- 组）、暂未提交 [17]', () => {
    expect(groups.honor).toHaveLength(25);
    expect(groups.needsFix).toHaveLength(24);
    expect(groups.notSubmitted).toEqual([17]);
    expect(groups.honor).toContain(1);
    expect(groups.needsFix).toContain(3);
  });

  it('A 档 4 人进光荣榜（PRD-V2 §2.3.1：秩 ≥ A），但不进需更正', () => {
    for (const no of [7, 23, 26, 39]) {
      expect(groups.honor).toContain(no);
      expect(groups.needsFix).not.toContain(no);
    }
  });

  it('honorIncludesA 打开后 A- 进光荣榜，需更正清零（AC：含 A- 而非 B+）', () => {
    const on = classifyRoster(sampleBEntries(), s, 50, { honorIncludesA: true });
    expect(on.honor).toContain(3);
    expect(on.needsFix).not.toContain(3);
    expect(on.needsFix).toHaveLength(0);
    expect(on.honor).toHaveLength(49);
  });
});

describe('roster：口径分离（名单 ≠ 四档）', () => {
  const s = makeScheme('score', { maxScore: 100 });

  it('A- 在四档里算优秀，但名单进需更正（关键差异）', () => {
    const groups = classifyRoster({ '1': e(g('A-')) }, makeScheme('grade'), 1, { honorIncludesA: false });
    expect(groups.needsFix).toContain(1);
    expect(groups.honor).not.toContain(1);
  });

  it('72 分（及格档）三组皆无', () => {
    const groups = classifyRoster({ '1': e(score(72)) }, s, 1, { honorIncludesA: false });
    expect(groups.honor).toHaveLength(0);
    expect(groups.needsFix).toHaveLength(0);
    expect(groups.notSubmitted).toHaveLength(0);
  });

  it('43 分进需更正', () => {
    const groups = classifyRoster({ '1': e(score(43)) }, s, 1, { honorIncludesA: false });
    expect(groups.needsFix).toContain(1);
  });

  it('90 分进光荣榜', () => {
    const groups = classifyRoster({ '1': e(score(90)) }, s, 1, { honorIncludesA: false });
    expect(groups.honor).toContain(1);
  });
});

describe('roster：状态位与过关', () => {
  const s = makeScheme('check');

  it('请假只进 leave，不进未提交（AC-22.2）', () => {
    const groups = classifyRoster({ '1': e(null, { status: 'leave' }) }, s, 3, { honorIncludesA: false });
    expect(groups.leave).toEqual([1]);
    expect(groups.notSubmitted).not.toContain(1);
  });

  it('缺交且无补交 → 未提交；有补交 → madeUp', () => {
    const noMakeup = classifyRoster({ '1': e(null, { status: 'missing' }) }, s, 2, { honorIncludesA: false });
    expect(noMakeup.notSubmitted).toContain(1);

    const withMakeup = classifyRoster(
      { '1': e(null, { status: 'missing', makeup: { at: 1, note: '补' } }) },
      s,
      2,
      { honorIncludesA: false },
    );
    expect(withMakeup.madeUp).toEqual([1]);
    expect(withMakeup.notSubmitted).not.toContain(1);
  });

  it('过关 → passed；错3 → needsFix', () => {
    const groups = classifyRoster(
      { '1': e(null, { pass: true }), '2': e(text('错3')) },
      s,
      3,
      { honorIncludesA: false },
    );
    expect(groups.passed).toEqual([1]);
    expect(groups.needsFix).toEqual([2]);
  });

  it('已更正章是需更正的子集，不移出需更正（§16-16）', () => {
    const groups = classifyRoster(
      { '1': e(score(43), { stamp: 'corrected' }) },
      makeScheme('score'),
      2,
      { honorIncludesA: false },
    );
    expect(groups.needsFix).toContain(1);
    expect(groups.corrected).toEqual([1]);
  });

  it('A+ 且已盖章仍在光荣榜（盖章不剥夺荣誉）', () => {
    const groups = classifyRoster(
      { '1': e(g('A+'), { stamp: 'corrected' }) },
      makeScheme('grade'),
      2,
      { honorIncludesA: false },
    );
    expect(groups.honor).toEqual([1]);
  });

  it('补交但已达标 → madeUp 有、需更正没有（AC-23.2）', () => {
    const groups = classifyRoster(
      { '1': e(score(95), { makeup: { at: 1, note: '补交' } }) },
      makeScheme('score'),
      2,
      { honorIncludesA: false },
    );
    expect(groups.madeUp).toEqual([1]);
    expect(groups.needsFix).toHaveLength(0);
    expect(groups.honor).toEqual([1]);
  });
});
