import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIGIT_KEY,
  describeDigitMeaning,
  digitKeyAmbiguous,
  nextDigitKeyMode,
  nextDigitKeyModeFor,
  resolveDigitMeaning,
  type DigitKeyMode,
} from '../../src/domain/digitKey';
import { makeScheme } from '../fixtures';
import { SHEET_TEMPLATES } from '../../src/domain/constants';

const SCHEMES = {
  grade: makeScheme('grade'),
  score: makeScheme('score'),
  check: makeScheme('check'),
  mixed: makeScheme('mixed'),
} as const;

/** 4 种方案 × 3 种 mode 的真值表（设计 09 §3.1：12 组合全覆盖） */
describe('resolveDigitMeaning：4 方案 × 3 mode 真值表', () => {
  const table: Array<[keyof typeof SCHEMES, DigitKeyMode, string]> = [
    // grade：纯等级，auto 与 grade 同解；显式 score 时尊重用户选择（由内核再拒绝）
    ['grade', 'auto', 'grade'],
    ['grade', 'grade', 'grade'],
    ['grade', 'score', 'score'],
    // score：纯分数，没有歧义
    ['score', 'auto', 'score'],
    ['score', 'grade', 'grade'],
    ['score', 'score', 'score'],
    // check：听写
    ['check', 'auto', 'dictation'],
    ['check', 'grade', 'grade'],
    ['check', 'score', 'score'],
    // mixed：auto 解析为 grade（V3 的「先分数」正是本轮缺陷根因）
    ['mixed', 'auto', 'grade'],
    ['mixed', 'grade', 'grade'],
    ['mixed', 'score', 'score'],
  ];

  for (const [kind, mode, expected] of table) {
    it(`${kind} + ${mode} → ${expected}`, () => {
      expect(resolveDigitMeaning(mode, SCHEMES[kind], 'custom')).toBe(expected);
    });
  }
});

describe('resolveDigitMeaning：健壮性', () => {
  it('mode 缺省 / 非法值时按 auto 解析（旧数据没有该字段）', () => {
    expect(resolveDigitMeaning(undefined, SCHEMES.mixed, 'custom')).toBe('grade');
    // @ts-expect-error 非法值必须回落而不是抛错
    expect(resolveDigitMeaning('nope', SCHEMES.score, 'quality')).toBe('score');
  });

  it('纯文本方案（无等级无分数）回落 score，由内核提示不接受', () => {
    expect(resolveDigitMeaning('auto', makeScheme('text'), 'custom')).toBe('score');
  });

  it('模板参数不影响语义（预留）', () => {
    expect(resolveDigitMeaning('auto', SCHEMES.check, 'homework')).toBe('dictation');
  });
});

describe('chip 循环与文案', () => {
  it('auto → grade → score → auto（mode 原值循环，供设置面板显示用）', () => {
    expect(nextDigitKeyMode('auto')).toBe('grade');
    expect(nextDigitKeyMode('grade')).toBe('score');
    expect(nextDigitKeyMode('score')).toBe('auto');
  });

  it('chip 实际按生效语义推进：每次点击都有可见变化（FR-46.3）', () => {
    const mixed = SCHEMES.mixed;
    // auto 在 mixed 下已生效 grade：点一次必须去 score，否则视觉无变化（像坏了）
    expect(nextDigitKeyModeFor('auto', mixed, 'custom')).toBe('score');
    expect(nextDigitKeyModeFor('grade', mixed, 'custom')).toBe('score');
    // 生效分数时回到 auto
    expect(nextDigitKeyModeFor('score', mixed, 'custom')).toBe('auto');
    // score 表本就不显示 chip，但仍给出合理下一步
    expect(nextDigitKeyModeFor('auto', SCHEMES.score, 'quality')).toBe('auto');
  });

  it('默认 mode 是 auto', () => {
    expect(DEFAULT_DIGIT_KEY).toBe('auto');
  });

  it('文案按生效语义显示（auto 在 mixed 下显示「数字＝等级」）', () => {
    expect(describeDigitMeaning('grade')).toBe('数字＝等级');
    expect(describeDigitMeaning('score')).toBe('数字＝分数');
    expect(describeDigitMeaning('dictation')).toBe('数字＝等级');
  });
});

describe('digitKeyAmbiguous：只有 mixed 显示 chip（FR-46.6 / AC-87）', () => {
  it('mixed → true', () => {
    expect(digitKeyAmbiguous(SCHEMES.mixed)).toBe(true);
  });

  for (const kind of ['grade', 'score', 'check', 'text'] as const) {
    it(`${kind} → false（无歧义，不渲染 chip）`, () => {
      expect(digitKeyAmbiguous(makeScheme(kind))).toBe(false);
    });
  }
});

describe('与模板默认方案的联动', () => {
  it('自定义模板默认 mixed：敲 1 的期望是 A+（FR-46.2 / AC-86 的单测侧证）', () => {
    const custom = SHEET_TEMPLATES.custom;
    expect(custom.defaultScheme).toBe('mixed');
    expect(resolveDigitMeaning('auto', makeScheme(custom.defaultScheme), custom.id)).toBe('grade');
  });

  it('质量监测模板默认 score：不显示 chip，数字始终是分数（AC-87）', () => {
    const quality = SHEET_TEMPLATES.quality;
    const scheme = makeScheme(quality.defaultScheme);
    expect(digitKeyAmbiguous(scheme)).toBe(false);
    expect(resolveDigitMeaning('auto', scheme, quality.id)).toBe('score');
  });
});
