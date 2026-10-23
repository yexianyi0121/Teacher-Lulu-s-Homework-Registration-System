import { expect, test } from '@playwright/test';

test('persistence：录入 → 刷新 → 数据仍在', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('2');
  await page.waitForTimeout(500); // 超过 300ms 防抖窗口

  await page.reload();
  await expect(page.locator('[data-no="1"]')).toHaveText(/A(?![+-])/);
});

test('persistence：人数 50→40 隐藏数据，调回 50 恢复', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('[data-no="45"]').click();
  await page.keyboard.press('1');

  await page.getByTitle('设置').click();
  await page.getByLabel('学生人数（1–120）').fill('40');
  await page.getByLabel('学生人数（1–120）').blur();
  await page.getByRole('button', { name: '完成' }).click();

  await expect(page.locator('[data-no="45"]')).toHaveCount(0);

  await page.getByTitle('设置').click();
  await page.getByLabel('学生人数（1–120）').fill('50');
  await page.getByLabel('学生人数（1–120）').blur();
  await page.getByRole('button', { name: '完成' }).click();

  await expect(page.locator('[data-no="45"]')).toHaveText(/A\+/);
});

test('persistence：导出 → 清空 → 导入 完整恢复（A-17）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('1');
  await page.keyboard.press('2');

  await page.getByTitle('设置').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /导出备份/ }).click(),
  ]);
  const backup = 'test-results/backup.json';
  await download.saveAs(backup);

  await page.getByRole('button', { name: /清空全部数据/ }).click();
  await page.getByLabel('请输入「清空」以确认').fill('清空');
  await page.getByRole('button', { name: '清空全部数据', exact: true }).last().click();
  await expect(page.locator('[data-no="1"]')).toHaveText('1');

  await page.getByTitle('设置').click();
  await page.locator('input[type="file"]').setInputFiles(backup);
  await page.getByRole('button', { name: '覆盖导入' }).click();

  await expect(page.locator('[data-no="1"]')).toHaveText(/A\+/);
  await expect(page.locator('[data-no="2"]')).toHaveText(/A(?![+-])/);
});

test('persistence：清空当前记录可 Ctrl+Z 一次恢复', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('[data-no="1"]').click();
  for (let i = 0; i < 5; i++) await page.keyboard.press('1');

  await page.getByRole('button', { name: /清空/ }).click();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.locator('[data-no="1"]')).not.toHaveText(/A\+/);

  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-no="1"]')).toHaveText(/A\+/);
});
