import { describe, expect, it } from 'vitest';
import { canMakeup, assertCanMakeup, MakeupNotAllowedError } from '../../src/domain/makeup';
import { e, score } from '../fixtures';

describe('canMakeup：门禁矩阵（INV-18）', () => {
  it('缺交 / 请假 → 可补交', () => {
    expect(canMakeup(e(null, { status: 'missing' }))).toBe(true);
    expect(canMakeup(e(null, { status: 'leave' }))).toBe(true);
  });

  it('有值 / 已过关 / 空 / undefined → 不可补交', () => {
    expect(canMakeup(e(score(90)))).toBe(false);
    expect(canMakeup(e(null, { pass: true }))).toBe(false);
    expect(canMakeup(e(null))).toBe(false);
    expect(canMakeup(undefined)).toBe(false);
  });

  it('已有补交的缺交仍可再次补交（改说明）', () => {
    expect(canMakeup(e(null, { status: 'missing', makeup: { at: 1, note: 'x' } }))).toBe(true);
  });
});

describe('assertCanMakeup：契约违规要暴露', () => {
  it('不符合条件时抛 MAKEUP_NOT_ALLOWED', () => {
    expect(() => assertCanMakeup(e(score(90)))).toThrow(MakeupNotAllowedError);
    expect(() => assertCanMakeup(undefined)).toThrow('MAKEUP_NOT_ALLOWED');
  });

  it('符合条件不抛', () => {
    expect(() => assertCanMakeup(e(null, { status: 'missing' }))).not.toThrow();
  });
});
