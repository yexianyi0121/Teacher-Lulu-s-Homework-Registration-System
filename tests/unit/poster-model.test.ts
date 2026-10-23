import { describe, expect, it } from 'vitest';
import { buildPosterModel, posterFooter } from '../../src/domain/poster-model';
import { makeSettings, sampleBEntries } from '../fixtures';

const modelB = () =>
  buildPosterModel({
    subject: '语文',
    teacher: '刘露',
    school: '某某中学',
    date: '2026-03-13',
    content: '语文本',
    mode: 'homework',
    entries: sampleBEntries(),
    n: 50,
    settings: makeSettings({ count: 50 }),
  });

describe('buildPosterModel（PRD §6.3 / 样例 C）', () => {
  it('标题使用学科名', () => {
    expect(modelB().title).toBe('🌸 语文作业反馈 🌸');
  });

  it('三个徽章', () => {
    const m = modelB();
    expect(m.badges.mode).toBe('📝 常规作业');
    expect(m.badges.date).toBe('📅 3月13日');
    expect(m.badges.content).toBe('📖 语文本');
  });

  it('作业内容为空则不输出该徽章', () => {
    const m = buildPosterModel({
      subject: '语文', teacher: '刘露', school: '', date: '2026-03-13', content: '  ',
      mode: 'homework', entries: {}, n: 10, settings: makeSettings({ count: 10 }),
    });
    expect(m.badges.content).toBeNull();
  });

  it('10 列、50 格、5 行', () => {
    const m = modelB();
    expect(m.columns).toBe(10);
    expect(m.cells).toHaveLength(50);
    expect(m.rows).toBe(5);
  });

  it('17 号为灰底虚线态且显示 ×', () => {
    const cell = modelB().cells.find((c) => c.no === 17);
    expect(cell?.tone).toBe('gray');
    expect(cell?.text).toBe('×');
  });

  it('不输出姓名（Cell 无 name 字段）', () => {
    expect(modelB().cells.every((c) => !('name' in c))).toBe(true);
  });

  it('取值域只到 n（BR-40）', () => {
    const m = buildPosterModel({
      subject: '语文', teacher: '刘露', school: '', date: '2026-03-13', content: '语文本',
      mode: 'homework', entries: sampleBEntries(), n: 40, settings: makeSettings({ count: 40 }),
    });
    expect(m.cells).toHaveLength(40);
    expect(m.rows).toBe(4);
  });
});

describe('posterFooter（BR-21）', () => {
  it('四种拼接', () => {
    expect(posterFooter('刘露', '某某中学')).toBe('© Designed by 刘露 | 某某中学');
    expect(posterFooter('刘露', '')).toBe('© Designed by 刘露');
    expect(posterFooter('', '某某中学')).toBe('© 某某中学');
    expect(posterFooter('', '')).toBe('© Designed by 一位老师');
  });
});
