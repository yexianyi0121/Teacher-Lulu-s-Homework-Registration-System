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

  it('混合方案同时提示等级键位与分数', () => {
    const hint = buildHint('custom', makeScheme('mixed'));
    expect(hint).toContain('1 A+');
    expect(hint).toContain('也可输分数');
  });
});
