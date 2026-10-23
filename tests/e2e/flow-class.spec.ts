import { expect, test } from '@playwright/test';

test('flow-class：新建班级后数据互不污染（AC-25.1 / AC-46）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('1');
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  await page.getByTitle('设置').click();
  await page.getByLabel('新班级名').fill('一年一班');
  await page.getByRole('button', { name: /新建班级/ }).click();
  await page.getByRole('button', { name: '完成' }).click();

  await page.getByLabel('切换班级').selectOption({ label: '一年一班 · 50人' });
  await expect(page.locator('[data-no="1"]')).not.toContainText('A+');

  await page.getByLabel('切换班级').selectOption({ label: '三年二班 · 50人' });
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
});

test('flow-class：报表带当前班级名（AC-47）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByTitle('设置').click();
  await page.getByLabel('班级名', { exact: true }).fill('一年一班');
  await page.getByLabel('班级名', { exact: true }).blur();
  await page.getByRole('button', { name: '完成' }).click();

  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('report-text')).toContainText('🏫 班级：一年一班');
});
