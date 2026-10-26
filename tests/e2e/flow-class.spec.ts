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

  // v2.3.1 P3-1：人数已从 select option 移到独立 .class-count（窄屏会裁班级名），
  // option 文本只放班级名；「· N人」由 select 右侧 span 展示（桌面/平板可见）
  await page.getByLabel('切换班级').selectOption({ label: '一年一班' });
  await expect(page.locator('[data-no="1"]')).not.toContainText('A+');

  await page.getByLabel('切换班级').selectOption({ label: '三年二班' });
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

  // v2.5.7：空表按 Ctrl+Enter 会被拦截（U-01/U-02，防止把「全员未提交」的报表发到群里），
  // 这里必须先录一个值，否则测的就不是「报表带班级名」而是空表拦截。
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('1');

  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('report-text')).toContainText('🏫 班级：一年一班');
});
