import { expect, test } from '@playwright/test';
import { resetApp } from './v3-fixtures';

/**
 * E2E-37（V4 FR-48 / ADR-24）：6 套主题循环切换，--bg-gradient 与 --brand 真实变化，
 * 刷新后保持，卡片/网格不变形；海报不跟随主题（默认）。
 */

const THEMES = ['pink', 'mint', 'sky', 'sand', 'night', 'plain'] as const;

test('E2E-37 6 套主题：切换生效、刷新保持、备份含 theme（A-92 / A-93）', async ({ page }) => {
  await resetApp(page);

  const readTheme = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const cell = document.querySelector('.cell') as HTMLElement | null;
      return {
        attr: document.documentElement.dataset.theme ?? '',
        gradient: cs.getPropertyValue('--bg-gradient').trim(),
        brand: cs.getPropertyValue('--brand').trim(),
        cellBg: cell ? getComputedStyle(cell).backgroundColor : '',
        cellH: cell ? Math.round(cell.getBoundingClientRect().height) : 0,
      };
    });

  const seen = new Map<string, { gradient: string; brand: string }>();

  for (const key of THEMES) {
    await test.step(`切到 ${key}`, async () => {
      await page.getByRole('button', { name: /设置/ }).first().click();
      const dlg = page.getByRole('dialog');
      await dlg.locator(`.theme-card[data-theme-key="${key}"]`).click();
      await expect(dlg.locator(`.theme-card[data-theme-key="${key}"]`)).toHaveAttribute('aria-checked', 'true');
      await page.locator('.modal-foot').getByRole('button', { name: '完成' }).click();
      await expect(page.locator('.modal')).toHaveCount(0);
      const t = await readTheme();
      expect(t.attr).toBe(key);
      seen.set(key, { gradient: t.gradient, brand: t.brand });
    });
  }

  await test.step('6 套的背景与主色互不相同', async () => {
    const grads = new Set([...seen.values()].map((v) => v.gradient));
    const brands = new Set([...seen.values()].map((v) => v.brand));
    // plain 是纯白无渐变，与其余 5 套渐变不同；渐变值 5 种 + plain 的 #FFFFFF
    expect(grads.size).toBe(6);
    // v2.3.1：plain 主色已中性化为石墨灰 #4A4A57（不再沿用粉色），6 套主色全不同
    expect(brands.size).toBe(6);
  });

  await test.step('night 下卡片仍白底、网格高度不变', async () => {
    await page.getByRole('button', { name: /设置/ }).first().click();
    await page.locator('.theme-card[data-theme-key="night"]').click();
    await page.locator('.modal-foot').getByRole('button', { name: '完成' }).click();
    const t = await readTheme();
    expect(t.cellBg).toBe('rgb(255, 255, 255)');   // 卡片/格子保持白底（FR-48.4）
    expect(t.cellH).toBeGreaterThan(60);           // 网格没被主题挤变形
  });

  await test.step('刷新后主题保持（A-93）', async () => {
    await page.reload();
    await page.waitForSelector('.cell');
    const t = await readTheme();
    expect(t.attr).toBe('night');
  });

  await test.step('导出的备份 JSON 含 theme 字段（A-93）', async () => {
    const state = await page.evaluate(() => {
      const raw = localStorage.getItem('xq.state.v4');
      return raw ? JSON.parse(raw) : null;
    });
    expect(state?.settings?.theme).toBe('night');
    expect(state?.version).toBe(4);
  });
});

/**
 * E2E-37c（v2.3.1 P2-2 / FR-48.6-b）：night 主题下压在页面渐变背景上的文字
 * （品牌名 / 参数标签 / 提示条 / 保存状态）对比度 ≥ 4.5:1。
 * v2.3.0 只断言了「卡片白底」，漏了页面级文字——品牌名实测只有 1.20:1。
 * 背景取夜渐变最亮端 #3A2F52：浅字对最亮端对比最低，是最严格口径。
 */
test('E2E-37c night 页面级文字对比度 ≥4.5:1（FR-48.6-b）', async ({ page }) => {
  await resetApp(page);
  await page.getByRole('button', { name: /设置/ }).first().click();
  await page.locator('.theme-card[data-theme-key="night"]').click();
  await page.locator('.modal-foot').getByRole('button', { name: '完成' }).click();
  await expect(page.locator('[data-theme="night"]')).toBeAttached();

  const ratios = await page.evaluate(() => {
    const lum = (rgb: string) => {
      const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bgLum = lum('rgb(58, 47, 82)');   // night 渐变最亮端
    const out: Record<string, number> = {};
    for (const sel of ['.brand-text', '.field-label', '.hint', '.save-indicator--btn']) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      const fgLum = lum(getComputedStyle(el).color);
      out[sel] = Number(((Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05)).toFixed(2));
    }
    return out;
  });

  expect(Object.keys(ratios)).toHaveLength(4);   // 四个元素都真实存在，没白测
  for (const [sel, r] of Object.entries(ratios)) {
    expect(r, `${sel} 对比度 ${r}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

test('E2E-37b 海报默认不跟随主题：night 下海报仍是白卡品牌粉（FR-48.3）', async ({ page }) => {
  await resetApp(page);

  // 先造一点当天数据，否则汇总按钮只弹 Toast
  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('2');
  await expect(page.locator('[data-no="1"]')).toContainText('A');

  // 切到 night
  await page.getByRole('button', { name: /设置/ }).first().click();
  await page.locator('.theme-card[data-theme-key="night"]').click();
  await page.locator('.modal-foot').getByRole('button', { name: '完成' }).click();
  await expect(page.locator('[data-theme="night"]')).toBeAttached();

  // 打开当日汇总：海报节点固定 data-theme="pink"（栅格化期间存在，用完即卸载，
  // 因此用 MutationObserver 在插入的同一微任务里记录，而不是事后查询）
  await page.evaluate(() => {
    const w = window as unknown as { __posterThemes: Array<string | null> };
    w.__posterThemes = [];
    const obs = new MutationObserver(() => {
      const el = document.querySelector('.poster-stage');
      if (el) w.__posterThemes.push(el.getAttribute('data-theme'));
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: /当日汇总/ }).click();
  await expect(page.getByRole('dialog', { name: '当日汇总预览' })).toBeVisible({ timeout: 20_000 });
  const themes = await page.evaluate(() => (window as unknown as { __posterThemes: Array<string | null> }).__posterThemes);
  expect(themes.length).toBeGreaterThan(0);
  expect(themes.every((t) => t === 'pink')).toBe(true);   // 页面是 night，海报不是
  expect(themes).not.toContain('night');
});
