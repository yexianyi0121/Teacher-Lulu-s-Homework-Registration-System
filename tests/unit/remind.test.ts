import { describe, expect, it } from 'vitest';
import { EXPORT_REMIND_DAYS, daysSinceExport, shouldRemindExport } from '../../src/domain/remind';

const NOW = new Date('2026-03-20T09:00:00.000Z');
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('shouldRemindExport（FR-51.2 / A-96 可注入时钟）', () => {
  it('从未导出 → 提醒', () => {
    expect(shouldRemindExport(null, NOW)).toBe(true);
  });

  it('导出时间坏值按未导出处理', () => {
    expect(shouldRemindExport('not-a-date', NOW)).toBe(true);
    expect(shouldRemindExport('', NOW)).toBe(true);
  });

  it('刚好 7 天 → 提醒（含边界）', () => {
    expect(shouldRemindExport(iso(daysAgo(7)), NOW)).toBe(true);
  });

  it('6 天 23 小时 59 分 → 不提醒', () => {
    const almost = new Date(NOW.getTime() - (7 * 24 * 60 * 60 * 1000 - 60 * 1000));
    expect(shouldRemindExport(iso(almost), NOW)).toBe(false);
  });

  it('8 天前导出 → 提醒；1 天前导出 → 不提醒', () => {
    expect(shouldRemindExport(iso(daysAgo(8)), NOW)).toBe(true);
    expect(shouldRemindExport(iso(daysAgo(1)), NOW)).toBe(false);
  });

  it('天数参数可注入（3 天周期下 4 天前就提醒）', () => {
    expect(shouldRemindExport(iso(daysAgo(4)), NOW, 3)).toBe(true);
    expect(shouldRemindExport(iso(daysAgo(2)), NOW, 3)).toBe(false);
  });

  it('days <= 0 表示关闭提醒', () => {
    expect(shouldRemindExport(null, NOW, 0)).toBe(false);
  });

  it('未来时间（时钟偏移）不提醒', () => {
    expect(shouldRemindExport(iso(new Date(NOW.getTime() + 86400000)), NOW)).toBe(false);
  });

  it('daysSinceExport 返回小数天数', () => {
    expect(daysSinceExport(iso(daysAgo(7)), NOW)).toBeCloseTo(7, 6);
    expect(daysSinceExport(iso(daysAgo(0.5)), NOW)).toBeCloseTo(0.5, 6);
    expect(daysSinceExport(null, NOW)).toBeNull();
    expect(daysSinceExport('bad', NOW)).toBeNull();
  });

  it('默认周期常量为 7', () => {
    expect(EXPORT_REMIND_DAYS).toBe(7);
  });
});
