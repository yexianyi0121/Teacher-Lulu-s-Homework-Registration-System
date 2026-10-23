import { describe, expect, it } from 'vitest';
import { parseUtterance, toArabic } from '../../src/domain/voice-parse';

describe('toArabic（0–120）', () => {
  it('常见形态', () => {
    expect(toArabic('12')).toBe(12);
    expect(toArabic('十')).toBe(10);
    expect(toArabic('十二')).toBe(12);
    expect(toArabic('二十')).toBe(20);
    expect(toArabic('二十三')).toBe(23);
    expect(toArabic('一百')).toBe(100);
    expect(toArabic('一百二十')).toBe(120);
    expect(toArabic('一百零五')).toBe(105);
    expect(toArabic('两')).toBe(2);
  });

  it('非法输入返回 null', () => {
    expect(toArabic('abc')).toBeNull();
    expect(toArabic('零')).toBeNull();
  });
});

describe('parseUtterance（设计 §6.8.3）', () => {
  const n = 50;

  it('12号优秀 → 优秀章', () => {
    expect(parseUtterance('12号优秀', n)).toEqual([{ no: 12, action: { type: 'stamp', stamp: 'excellent' } }]);
  });

  it('十二号 → 中文数字', () => {
    expect(parseUtterance('十二号优秀', n)[0].no).toBe(12);
  });

  it('5号已更正', () => {
    expect(parseUtterance('5号已更正', n)).toEqual([{ no: 5, action: { type: 'stamp', stamp: 'corrected' } }]);
  });

  it('12号98分', () => {
    expect(parseUtterance('12号98分', n)).toEqual([{ no: 12, action: { type: 'score', score: 98 } }]);
  });

  it('12号九十八分', () => {
    expect(parseUtterance('12号九十八分', n)).toEqual([{ no: 12, action: { type: 'score', score: 98 } }]);
  });

  it('一句多号：1号2号3号优秀', () => {
    expect(parseUtterance('1号2号3号优秀', n)).toEqual([
      { no: 1, action: { type: 'stamp', stamp: 'excellent' } },
      { no: 2, action: { type: 'stamp', stamp: 'excellent' } },
      { no: 3, action: { type: 'stamp', stamp: 'excellent' } },
    ]);
  });

  it('越界学号被丢弃（一百二十号，班级 50 人）', () => {
    expect(parseUtterance('一百二十号优秀', n)).toEqual([]);
  });

  it('12号错两 → 文本 错2', () => {
    expect(parseUtterance('12号错两', n)).toEqual([{ no: 12, action: { type: 'text', text: '错2' } }]);
  });

  it('12号A加 / 12号A+ → A+', () => {
    expect(parseUtterance('12号A加', n)).toEqual([{ no: 12, action: { type: 'grade', grade: 'A+' } }]);
    expect(parseUtterance('12号A+', n)).toEqual([{ no: 12, action: { type: 'grade', grade: 'A+' } }]);
  });

  it('12号A减 → A-', () => {
    expect(parseUtterance('12号A减', n)).toEqual([{ no: 12, action: { type: 'grade', grade: 'A-' } }]);
  });

  it('取消12号 → clear', () => {
    expect(parseUtterance('取消12号', n)).toEqual([{ no: 12, action: { type: 'clear' } }]);
  });

  it('无学号或无动作返回空数组', () => {
    expect(parseUtterance('优秀', n)).toEqual([]);
    expect(parseUtterance('12号', n)).toEqual([]);
  });

  it('全角数字归一化', () => {
    expect(parseUtterance('１２号优秀', n)[0].no).toBe(12);
  });
});
