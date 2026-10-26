import { describe, expect, it } from 'vitest';
import { MANUAL, searchManual } from '../../src/domain/manual';

describe('manual：20 章与检索（AC-29.1 / AC-29.2）', () => {
  it('共 20 章', () => {
    expect(MANUAL).toHaveLength(20);
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

  it('V3 三节齐全：数据健康 / 本周汇总 / 评价语与自定义规则（P3-1）', () => {
    const ids = MANUAL.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['data-safety', 'week-summary', 'comment-rules']));
    for (const id of ['data-safety', 'week-summary', 'comment-rules']) {
      const sec = MANUAL.find((s) => s.id === id)!;
      expect(sec.title.length).toBeGreaterThan(0);
      expect(sec.steps?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('v2.5.3 新增「导入学生名单」章节（FR-55）', () => {
    const sec = MANUAL.find((s) => s.id === 'roster')!;
    expect(sec).toBeTruthy();
    expect(sec.title).toContain('名单');
    expect(sec.steps?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect((sec.tips ?? []).join('')).toContain('工作表');
  });

  it('V4 三节齐全：数字键语义 / 背景主题 / 手机端（设计 09 §2 手册要求）', () => {
    const ids = MANUAL.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['digit-key', 'theme', 'mobile']));
    for (const id of ['digit-key', 'theme', 'mobile']) {
      const sec = MANUAL.find((s) => s.id === id)!;
      expect(sec.title.length).toBeGreaterThan(0);
      expect(sec.steps?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('数字键语义章写清混合表切换方式（chip 与反引号）', () => {
    const sec = MANUAL.find((s) => s.id === 'digit-key')!;
    const hay = [sec.intro ?? '', ...(sec.steps ?? []), ...(sec.tips ?? [])].join('\n');
    expect(hay).toContain('反引号');
    expect(hay).toContain('数字＝分数');
  });

  it('v2.4.0 新增「关于本系统」章：写清入口与版本号（FR-52）', () => {
    const sec = MANUAL.find((s) => s.id === 'about')!;
    const hay = [sec.intro ?? '', ...(sec.steps ?? []), ...(sec.tips ?? [])].join('\n');
    expect(hay).toContain('设置');
    expect(hay).toContain('版本');
    expect(hay).toContain('邮箱');
  });

  it('手机端章写清键盘板 / 安装提示 / 7 天导出提醒 / 分享', () => {
    const sec = MANUAL.find((s) => s.id === 'mobile')!;
    const hay = [sec.intro ?? '', ...(sec.steps ?? []), ...(sec.tips ?? [])].join('\n');
    expect(hay).toContain('数字键盘');
    expect(hay).toContain('主屏幕');
    expect(hay).toContain('7 天');
    expect(hay).toContain('分享');
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
    expect(searchManual('')).toHaveLength(20);
    expect(searchManual('不存在的关键词xyz')).toHaveLength(0);
  });

  it('第 3 章含快捷键表（键盘录入）', () => {
    const kb = MANUAL.find((s) => s.id === 'keyboard')!;
    expect(kb.keys?.length ?? 0).toBeGreaterThan(5);
  });
});
