import { expect, test } from '@playwright/test';

test('flow-homework：等级录入 + 空格盖章 + X 缺交（V1 行为回归）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');
  // v2.6.3 FR-73.4：作业内容是登记前提
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();

  // 秒跳关掉，便于逐格断言
  await page.getByLabel('秒跳开关').click();

  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('1');
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  await page.locator('[data-no="2"]').click();
  await page.keyboard.press('a');
  await page.keyboard.press('-');
  await expect(page.locator('[data-no="2"]')).toContainText('A-');

  // 空格盖章：已更正 → 再按取消
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press(' ');
  await expect(page.locator('[data-no="1"] .cell-stamp[data-stamp="corrected"]')).toHaveCount(1);
  await page.keyboard.press(' ');
  await expect(page.locator('[data-no="1"] .cell-stamp')).toHaveCount(0);

  // X 缺交
  await page.locator('[data-no="3"]').click();
  await page.keyboard.press('x');
  await expect(page.locator('[data-no="3"]')).toContainText('×');
  await expect(page.locator('[data-no="3"]')).toHaveAttribute('data-status', 'missing');
});

test('flow-homework：/ 定位学号并跳转，输入框聚焦时不污染网格', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');
  // v2.6.3 FR-73.4：作业内容是登记前提
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();

  await page.keyboard.press('/');
  await expect(page.getByLabel('搜学号')).toBeFocused();
  await page.keyboard.type('17');
  await page.keyboard.press('Enter');

  await page.getByLabel('作业内容').fill('测试');

  await page.getByLabel('新建登记').click();
  await page.getByLabel('作业内容').focus();
  await page.keyboard.type('9');
  await expect(page.locator('[data-no="1"]')).not.toContainText('A+');

  await page.getByLabel('作业内容').blur();
  await expect(page.locator('[data-no="17"]')).toBeVisible();
});
