import { expect, test } from '@playwright/test';

test('keyboard：`/` 定位学号并回车跳格（A-05）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.grid');

  await page.keyboard.press('/');
  await expect(page.getByLabel('搜学号')).toBeFocused();
  await page.keyboard.type('17');
  await page.keyboard.press('Enter');

  await expect(page.locator('[data-no="17"]')).toBeFocused();
});

test('keyboard：Modal 打开时 Ctrl+Z / Esc 仍生效（A-29）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.grid');

  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('1');
  await expect(page.locator('[data-no="1"]')).toHaveText(/A\+/);

  await page.getByRole('button', { name: /报表生成/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // 命令键挂在 document 上：焦点在弹窗内依然可用
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-no="1"]')).not.toHaveText(/A\+/);
});
