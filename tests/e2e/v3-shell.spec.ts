import { expect, test } from '@playwright/test';
import { resetApp } from './v3-fixtures';

const TITLE = '刘露老师的学情登记本';

/**
 * E2E-33 外观与可双击运行（FR-45 / 设计 06 §4.7）
 * 1) 网址打开：标题、favicon、apple-touch-icon、manifest 全部到位；
 * 2) 双击 dist/index.html（file://）：同样能起、标题正确、50 格。
 */
test('E2E-33 标题/图标/manifest 在网址下全部生效', async ({ page, request }) => {
  await resetApp(page);

  await expect(page).toHaveTitle(TITLE);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F6EFFB');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', './favicon.svg');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', './icon-192.png');
  await expect(page.locator('link[rel="manifest"]').first()).toHaveAttribute('href', './manifest.webmanifest');

  const favicon = await request.get('/favicon.svg');
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()['content-type']).toContain('svg');

  const manifestRes = await request.get('/manifest.webmanifest');
  expect(manifestRes.status()).toBe(200);
  const manifest = await manifestRes.json();
  expect(manifest.name).toBe(TITLE);
  expect(manifest.short_name).toBe('学情登记');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./学情登记系统.html');
  const iconSrcs = (manifest.icons as Array<{ src: string; purpose?: string }>).map((i) => i.src);
  expect(iconSrcs).toContain('icon-192.png');
  expect(iconSrcs).toContain('icon-512.png');
  expect((manifest.icons as Array<{ purpose?: string }>).some((i) => i.purpose === 'maskable')).toBe(true);

  // 图标文件真实存在（不是空链接）
  for (const src of iconSrcs) {
    const res = await request.get(`/${src}`);
    expect(res.status()).toBe(200);
    expect(Number(res.headers()['content-length'] ?? 0)).toBeGreaterThan(1000);
  }

  // 标题也出现在页面头部（老师看到的品牌位）
  await expect(page.locator('.header .brand')).toContainText('学情登记分析系统');
});

test('E2E-33 双击 dist/学情登记系统.html（file://）也能起：标题正确、50 格、无脚本错误', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));

  const url = new URL('../../dist/学情登记系统.html', import.meta.url).href;
  await page.goto(url);
  await page.waitForSelector('.cell');

  await expect(page).toHaveTitle(TITLE);
  await expect(page.locator('.cell')).toHaveCount(50);
  await expect(page.locator('[data-no="1"]')).toBeVisible();
  // 内联后的资源不应再回源请求（file:// 下拿不到 assets/*.js）
  expect(errs).toEqual([]);
});
