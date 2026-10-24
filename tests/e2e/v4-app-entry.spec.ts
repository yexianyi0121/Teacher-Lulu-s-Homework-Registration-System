/**
 * E2E-43 入口 App 化（v2.5.0 / FR-53 / 设计 12 §入口）
 *
 * a) 网址根路径（/）直接就是完整应用（index.html 是中文入口的同内容镜像，
 *    不用 meta-refresh：0 秒跳转会摧毁 goto 后的执行上下文，且 SW 的
 *    navigateFallback 返回跳转页会无限循环）；
 * b) file:// 直开「学情登记系统.html」（用户真实双击路径）：
 *    50 格、标题、favicon 引用、无脚本错误；
 * c) file:// 直开 index.html 镜像：同样直接起应用（旧书签/服务器兼容）。
 */
import { expect, test } from '@playwright/test';

const TITLE = '刘露老师的学情登记本';

test('E2E-43a 网址根路径直接是完整应用（镜像，无跳转）', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(TITLE);
  await expect(page.locator('.cell')).toHaveCount(50);
});

test('E2E-43b 双击 dist/学情登记系统.html（file://）：50 格、favicon 引用、无脚本错误', async ({
  page,
}) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));

  const url = new URL('../../dist/学情登记系统.html', import.meta.url).href;
  await page.goto(url);
  await page.waitForSelector('.cell');

  await expect(page).toHaveTitle(TITLE);
  await expect(page.locator('.cell')).toHaveCount(50);
  await expect(page.locator('[data-no="1"]')).toBeVisible();

  // favicon 引用存活（文件存在性由单测 app-entry.test.ts 的 existsSync 守护；
  // Playwright request 上下文不支持 file: 协议，无法在此发请求）
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    './favicon.svg',
  );

  // iOS 全屏 meta（添加到主屏幕后无浏览器 UI）
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );

  expect(errs).toEqual([]);
});

test('E2E-43c 双击 dist/index.html（file:// 镜像）：同样直接起应用', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto(new URL('../../dist/index.html', import.meta.url).href);
  await page.waitForSelector('.cell');

  await expect(page).toHaveTitle(TITLE);
  await expect(page.locator('.cell')).toHaveCount(50);
  expect(errs).toEqual([]);
});
