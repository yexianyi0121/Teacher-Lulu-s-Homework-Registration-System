import { describe, expect, it } from 'vitest';
import { round1, toTenthInt } from '../../src/domain/round';

describe('round1（设计 §8.1）', () => {
  it('half-up 处理浮点陷阱', () => {
    expect(round1(87.65)).toBe(87.7);
    expect(round1(87.675)).toBe(87.7);
    expect(round1(87.05)).toBe(87.1);
    expect(round1(1753.5 / 20)).toBe(87.7);
  });

  it('整数与 0 边界', () => {
    expect(round1(90)).toBe(90);
    expect(round1(0)).toBe(0);
    expect(round1(0.05)).toBe(0.1);
  });

  it('十分位整数换算', () => {
    expect(toTenthInt(90.5)).toBe(905);
    expect(toTenthInt(90)).toBe(900);
    expect(toTenthInt(87.675)).toBe(877);
  });
});
