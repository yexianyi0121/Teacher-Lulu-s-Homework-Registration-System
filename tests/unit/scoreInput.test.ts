import { describe, expect, it } from 'vitest';
import { checkScore, sanitizeScoreChar, sanitizeScoreInput } from '../../src/domain/scoreInput';

describe('checkScore：合法值', () => {
  it('整数、1 位小数、边界 0 与 max', () => {
    expect(checkScore('87', 100, 1)).toEqual({ ok: true, value: 87 });
    expect(checkScore('87.5', 100, 1)).toEqual({ ok: true, value: 87.5 });
    expect(checkScore('0', 100, 1)).toEqual({ ok: true, value: 0 });
    expect(checkScore('100', 100, 1)).toEqual({ ok: true, value: 100 });
  });
});

describe('checkScore：非法值（AC-39.1 / AC-77）', () => {
  it('负数 / 字母 / 双小数点 / 超满分 / 超小数位 / 空串', () => {
    expect(checkScore('-5', 100, 1)).toEqual({ ok: false, reason: 'NEGATIVE' });
    expect(checkScore('abc', 100, 1)).toMatchObject({ ok: false, reason: 'NAN' });
    expect(checkScore('1.2.3', 100, 1)).toMatchObject({ ok: false });
    expect(checkScore('101', 100, 1)).toEqual({ ok: false, reason: 'TOO_BIG' });
    expect(checkScore('12.5', 100, 0)).toEqual({ ok: false, reason: 'TOO_MANY_DECIMALS' });
    expect(checkScore('', 100, 1)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('全角数字按半角处理（８７．５ → 87.5）', () => {
    expect(checkScore('８７．５', 100, 1)).toEqual({ ok: true, value: 87.5 });
  });
});

describe('sanitizeScoreInput：粘贴清洗', () => {
  it('去空白、全角转半角', () => {
    expect(sanitizeScoreInput(' ８５ ', 100, 1)).toBe('85');
  });

  it('负号 / 字母 / 多小数点 → null（整条拒绝，不做删字符）', () => {
    expect(sanitizeScoreInput(' -5 ', 100, 1)).toBeNull();
    expect(sanitizeScoreInput('9a', 100, 1)).toBeNull();
    expect(sanitizeScoreInput('1.2.3', 100, 1)).toBeNull();
  });

  it('超满分 → null', () => {
    expect(sanitizeScoreInput('101', 100, 1)).toBeNull();
  });
});

describe('sanitizeScoreChar：键盘单字符', () => {
  it('小数位为 0 时拒绝小数点；负号不进缓冲区', () => {
    expect(sanitizeScoreChar('.', 100, 0)).toBeNull();
    expect(sanitizeScoreChar('.', 100, 1)).toBe('.');
    expect(sanitizeScoreChar('-', 100, 1)).toBeNull();
    expect(sanitizeScoreChar('８', 100, 1)).toBe('8');
  });
});
