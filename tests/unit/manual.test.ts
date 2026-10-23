import { describe, expect, it } from 'vitest';
import { MANUAL, searchManual } from '../../src/domain/manual';

describe('manual：12 章与检索（AC-29.1 / AC-29.2）', () => {
  it('共 12 章', () => {
    expect(MANUAL).toHaveLength(12);
  });

  it('每章都有标题与至少 2 条步骤', () => {
    for (const sec of MANUAL) {
      expect(sec.title.length).toBeGreaterThan(0);
      expect(sec.id.length).toBeGreaterThan(0);
      expect(sec.steps?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('章 id 唯一', () => {
    expect(new Set(MANUAL.map((s) => s.id)).size).toBe(MANUAL.length);
  });

  it('搜索「补交」能定位到补交章', () => {
    const hits = searchManual('补交');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((h) => h.id)).toContain('makeup');
  });

  it('搜索「积分」命中山积分章', () => {
    expect(searchManual('积分').map((s) => s.id)).toContain('points');
  });

  it('空搜索返回全部，无匹配返回空数组', () => {
    expect(searchManual('')).toHaveLength(12);
    expect(searchManual('不存在的关键词xyz')).toHaveLength(0);
  });

  it('第 3 章含快捷键表（键盘录入）', () => {
    const kb = MANUAL.find((s) => s.id === 'keyboard')!;
    expect(kb.keys?.length ?? 0).toBeGreaterThan(5);
  });
});
