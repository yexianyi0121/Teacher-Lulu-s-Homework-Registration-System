import { describe, expect, it } from 'vitest';
import { buildHint } from '../../src/domain/hint';
import { makeScheme } from '../fixtures';

describe('buildHint：三种模板的默认提示', () => {
  it('听写：0=全对，并说明 G 手打过关（FR-32.4 / FR-40）', () => {
    const hint = buildHint('dictation', makeScheme('check'));
    expect(hint).toBe('💡 错几：输入 0–9（0=全对）· 空格 盖章 · X 缺交 · L 请假 · G 手打过关');
    expect(hint).not.toContain('全对」');
  });

  it('常规作业：按 6 档默认等级生成键位', () => {
    const hint = buildHint('homework', makeScheme('grade', { grades: ['A+', 'A', 'A-', 'B', 'C', 'D'] }));
    expect(hint).toBe('💡 1 A+ 2 A 3 A- 4 B 5 C 6 D · 空格 盖章 · X 缺交 · L 请假');
  });

  it('质量监测：分数 + F2', () => {
    const hint = buildHint('quality', makeScheme('score'));
    expect(hint).toContain('输入分数后按【Enter】跳下一格');
    expect(hint).toContain('F2 自定义文字');
  });
});

describe('buildHint：随方案联动（AC-42.1）', () => {
  it('勾选 B+ 后提示出现 4 B+', () => {
    const hint = buildHint('homework', makeScheme('grade', { grades: ['A+', 'A', 'A-', 'B+'] }));
    expect(hint).toContain('4 B+');
  });

  it('混合方案默认提示等级键位，并说明可切到分数（V4 ADR-22）', () => {
    const hint = buildHint('custom', makeScheme('mixed'));
    expect(hint).toContain('1 A+');
    expect(hint).toContain('按 ` 切「数字＝分数」');
  });

  it('混合方案切到「数字＝分数」后提示语随之改变', () => {
    const hint = buildHint('custom', makeScheme('mixed'), undefined, 'score');
    expect(hint).toContain('数字＝分数，Enter 提交');
    expect(hint).not.toContain('1 A+');
  });
});

describe('v2.6.7：提示条已有键位色块时，文字不再重复列一遍', () => {
  it('色块场景（keysInChips=true）：常规作业只写「数字＝等级」', () => {
    const hint = buildHint('homework', makeScheme('grade', { grades: ['A+', 'A', 'A-', 'B', 'C', 'D'] }), undefined, 'grade', true);
    expect(hint).toBe('💡 数字＝等级 · 空格 盖章 · X 缺交 · L 请假');
    expect(hint).not.toContain('1 A+');
  });

  it('色块场景（keysInChips=true）：混合表同样只写「数字＝等级」', () => {
    const hint = buildHint('custom', makeScheme('mixed'), undefined, 'grade', true);
    expect(hint).toContain('数字＝等级');
    expect(hint).toContain('按 ` 切「数字＝分数」');
    expect(hint).not.toContain('1 A+');
  });

  it('没有色块时（默认 false）仍逐档列出，供纯文字场景使用', () => {
    const hint = buildHint('homework', makeScheme('grade', { grades: ['A+', 'A', 'A-', 'B', 'C', 'D'] }));
    expect(hint).toContain('1 A+');
  });
});
