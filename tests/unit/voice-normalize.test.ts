import { describe, expect, it } from 'vitest';
import { normalize, convertCNNumbers } from '../../src/domain/voice/normalize';

describe('voice/normalize：数字与同音（AC-30.1 / AC-30.2 / AC-30.3）', () => {
  it('全角与空白：１２ 号 → 12号', () => {
    expect(normalize('１２ 号')).toBe('12号');
  });

  it('中文数字：十二号 → 12号；二十三号 → 23号；两百 → 200', () => {
    expect(normalize('十二号')).toBe('12号');
    expect(normalize('二十三号')).toBe('23号');
    expect(normalize('两百')).toBe('200');
    expect(normalize('一百二十号')).toBe('120号');
  });

  it('特殊数字词：幺二 → 12、廿三 → 23', () => {
    expect(normalize('幺二')).toBe('12');
    expect(normalize('廿三')).toBe('23');
  });

  it('分数与小数：八十七点五 → 87.5；九十八分 → 98分', () => {
    expect(convertCNNumbers('八十七点五')).toBe('87.5');
    expect(normalize('九十八分')).toBe('98分');
  });

  it('同音纠正：全兑 → 全对、以更正 → 已更正、过官 → 过关、请驾 → 请假', () => {
    expect(normalize('全兑')).toBe('全对');
    expect(normalize('以更正')).toBe('已更正');
    expect(normalize('过官')).toBe('过关');
    expect(normalize('请驾')).toBe('请假');
  });

  it('「不交」按歧义表归一为缺交（默认解释）', () => {
    expect(normalize('不交')).toBe('缺交');
    expect(normalize('没交')).toBe('缺交');
  });

  it('等级词：a加 → A+、a减 → A-、b加 → B+', () => {
    expect(normalize('a加')).toBe('A+');
    expect(normalize('a减')).toBe('A-');
    expect(normalize('b加')).toBe('B+');
    expect(normalize('A佳')).toBe('A+');
  });

  it('合并重复「号」：一号号 → 1号', () => {
    expect(normalize('一号号')).toBe('1号');
  });

  it('去标点但保留号/分：12号，优秀。 → 12号优秀', () => {
    expect(normalize('12号，优秀。')).toBe('12号优秀');
  });
});
