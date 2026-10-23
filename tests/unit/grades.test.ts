import { describe, expect, it } from 'vitest';
import { GRADE_KEY_MAP, GRADE_LABEL, GRADE_TONE, classifyDictation, formatScore, normalizeScore } from '../../src/domain/grades';

describe('等级映射（设计 §6.2）', () => {
  it('键位与标签、色调', () => {
    expect(GRADE_KEY_MAP).toEqual({ '1': 'A+', '2': 'A', '3': 'A-', '4': 'CROSS', '5': 'CHECK' });
    expect(GRADE_LABEL.CHECK).toBe('√');
    expect(GRADE_LABEL.CROSS).toBe('×');
    expect(GRADE_TONE['A+']).toBe('green');
    expect(GRADE_TONE['A-']).toBe('amber');
    expect(GRADE_TONE.CHECK).toBe('blue');
    expect(GRADE_TONE.CROSS).toBe('gray');
  });
});

describe('normalizeScore', () => {
  it('夹取到 0–100 且保留 1 位小数', () => {
    expect(normalizeScore(1000)).toBe(100);
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore(87.65)).toBe(87.7);
    expect(normalizeScore(87.44)).toBe(87.4);
  });
});

describe('classifyDictation（PRD BR-05）', () => {
  it('缺交类', () => {
    for (const t of ['缺交', '未交', '未做', '无', '×']) {
      expect(classifyDictation(t)).toEqual({ kind: 'missing', errors: 0 });
    }
  });

  it('错 N', () => {
    expect(classifyDictation('错2')).toEqual({ kind: 'error', errors: 2 });
    expect(classifyDictation('错 3')).toEqual({ kind: 'error', errors: 3 });
    expect(classifyDictation('错了5个')).toEqual({ kind: 'other', errors: 0 });
    expect(classifyDictation('错0')).toEqual({ kind: 'perfect', errors: 0 });
  });

  it('全对类与其他', () => {
    expect(classifyDictation('全对')).toEqual({ kind: 'perfect', errors: 0 });
    expect(classifyDictation('√')).toEqual({ kind: 'perfect', errors: 0 });
    expect(classifyDictation('100')).toEqual({ kind: 'perfect', errors: 0 });
    expect(classifyDictation('字迹工整')).toEqual({ kind: 'other', errors: 0 });
  });
});

describe('formatScore', () => {
  it('整数不显示小数', () => {
    expect(formatScore(90)).toBe('90');
    expect(formatScore(90.5)).toBe('90.5');
    expect(formatScore(90.0)).toBe('90');
  });
});
