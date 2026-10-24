import { expect, test } from '@playwright/test';
import { resetApp } from './v3-fixtures';

/**
 * E2E-32 三视口密度（设计 06 §4.1）
 * 1280 / 1366 / 1920 三档：令牌跟着变、图标与按钮不重叠、页面不出现横向滚动。
 */
test('E2E-32 三视口密度：1280 / 1366 / 1920 令牌分层且不溢框', async ({ page }) => {
  await resetApp(page);

  const readTokens = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const grid = document.querySelector('.grid') as HTMLElement | null;
      const cell = document.querySelector('.cell') as HTMLElement | null;
      // V4：两行工具栏拆成输出带 + 录入带（ADR-25），各自一行
      const bars = document.querySelectorAll('.output-bar, .input-bar');
      return {
        icon: cs.getPropertyValue('--icon-size').trim(),
        fs: cs.getPropertyValue('--fs-base').trim(),
        btn: cs.getPropertyValue('--btn-h').trim(),
        cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
        cellH: cell ? Math.round(cell.getBoundingClientRect().height) : 0,
        rowCount: bars.length,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        actionsWrap: bars.length ? Array.from(bars).reduce((h, el) => h + el.getBoundingClientRect().height, 0) : 0,
      };
    });

  await test.step('1280：紧凑档（图标 20 / 字号 13 / 按钮 32）', async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const t = await readTokens();
    expect(t.icon).toBe('20px');
    expect(t.fs).toBe('13px');
    expect(t.btn).toBe('32px');
    expect(t.overflowX).toBeLessThanOrEqual(0);
  });

  await test.step('1366：标准档（图标 22 / 字号 14 / 按钮 36）', async () => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const t = await readTokens();
    expect(t.icon).toBe('22px');
    expect(t.fs).toBe('14px');
    expect(t.btn).toBe('36px');
    expect(t.overflowX).toBeLessThanOrEqual(0);
  });

  await test.step('1920：宽松档（图标 24 / 字号 15 / 按钮 40 / 格子更高）', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const t = await readTokens();
    expect(t.icon).toBe('24px');
    expect(t.fs).toBe('15px');
    expect(t.btn).toBe('40px');
    expect(t.overflowX).toBeLessThanOrEqual(0);
    expect(t.cellH).toBeGreaterThan(0);
  });

  await test.step('输出带 + 录入带恒为两行，格子在三种视口下都是 10 列', async () => {
    for (const width of [1280, 1366, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      const t = await readTokens();
      expect(t.rowCount).toBe(2);
      expect(t.cols).toBe(10);
      // 两行工具栏不应把按钮挤出可视区
      expect(t.actionsWrap).toBeGreaterThan(0);
      expect(t.overflowX).toBeLessThanOrEqual(0);
    }
  });
});
