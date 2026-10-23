import { describe, expect, it } from 'vitest';
import { pyOf, simChar, simWord } from '../../src/domain/voice/phonetics';

describe('voice/phonetics：相似度阈值（设计 §8.4）', () => {
  it('同字相似度 1', () => {
    expect(simChar('全', '全')).toBe(1);
  });

  it('全同音（全/兑 与 对）→ 词相似度 ≥ 0.6', () => {
    expect(simWord('全对', '全兑')).toBeGreaterThanOrEqual(0.6);
    expect(simWord('过关', '过官')).toBeGreaterThanOrEqual(0.6);
  });

  it('完全不同的词 → 相似度 < 0.4（宁可不猜）', () => {
    expect(simWord('全对', '清空')).toBeLessThan(0.4);
  });

  it('单字：同声母不同韵母 = 0.5', () => {
    expect(simChar('全', '清')).toBe(0.5);
  });

  it('表内字有拼音，表外字返回 null', () => {
    expect(pyOf('对')).toEqual({ sm: 'd', ym: 'ui' });
    expect(pyOf('龘')).toBeNull();
  });

  it('空串相似度为 0', () => {
    expect(simWord('', '全对')).toBe(0);
  });
});
