import { describe, expect, it } from 'vitest';
import { charWidth, displayWidth, wrapTokens } from '../../src/domain/wrap';

const tokens = (nos: number[]) => nos.map((n) => `${n}号、`);

describe('charWidth / displayWidth', () => {
  it('CJK 与全角标点为 2，数字字母为 1', () => {
    expect(charWidth('号')).toBe(2);
    expect(charWidth('、')).toBe(2);
    expect(charWidth('1')).toBe(1);
    expect(displayWidth('1号、')).toBe(5);
    expect(displayWidth('12号、')).toBe(6);
  });
});

describe('wrapTokens（设计 §8.2）', () => {
  it('70 单位下 13 个混编学号单行（PRD §7.1.3 光荣榜）', () => {
    const lines = wrapTokens(tokens([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16]), 70, '、');
    expect(lines).toHaveLength(1);
    // 行尾已去掉顿号，故显示宽度为 68；含分隔符时为 70
    expect(displayWidth(lines[0])).toBe(68);
    expect(displayWidth(`${lines[0]}、`)).toBe(70);
  });

  it('30 个双数学号折为 11/11/8', () => {
    const nos = Array.from({ length: 30 }, (_, i) => i + 21);
    const lines = wrapTokens(tokens(nos), 70, '、');
    expect(lines).toHaveLength(3);
    expect(lines[0].split('、')).toHaveLength(11);
    expect(lines[1].split('、')).toHaveLength(11);
    expect(lines[2].split('、')).toHaveLength(8);
  });

  it('行尾无顿号、行间不加空行', () => {
    const lines = wrapTokens(tokens(Array.from({ length: 30 }, (_, i) => i + 21)), 70, '、');
    for (const line of lines) {
      expect(line.endsWith('、')).toBe(false);
      expect(line).not.toContain('\n');
    }
  });

  it('空数组返回空串', () => {
    expect(wrapTokens([], 70, '、').join('\n')).toBe('');
  });

  it('maxWidth=66 时 13 个混编学号折成两行（防回归）', () => {
    const lines = wrapTokens(tokens([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16]), 66, '、');
    expect(lines).toHaveLength(2);
  });
});
