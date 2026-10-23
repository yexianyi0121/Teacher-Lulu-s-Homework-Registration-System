import { expect, test } from '@playwright/test';

test('flow-points：连续 3 次听写过关 → 账本 +5 且只加一次（AC-26.1 / AC-26.2）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('登记类型').selectOption('dictation');
  await page.getByLabel('秒跳开关').click(); // 关秒跳，便于固定 1 号

  for (const day of ['11', '12', '13']) {
    await page.getByLabel('日期').fill(`2026-03-${day}`);
    await page.getByLabel('作业内容').fill('第3单元字词');
    await page.getByLabel('作业内容').blur();
    await page.locator('[data-no="1"]').click();
    await page.keyboard.press('Enter');   // 过关
    await page.keyboard.press('Control+s'); // 固化到历史
    await page.waitForTimeout(150);
  }

  // 再保存一次，不应重复加分
  await page.keyboard.press('Control+s');

  await page.getByRole('button', { name: /积分/ }).click();
  await page.getByRole('tab', { name: '账本' }).click();
  await expect(page.getByRole('dialog')).toContainText('连续3次听写全对');
  await expect(page.getByRole('dialog')).toContainText('+5');

  // 账本里 +5 只出现一次（用条目计数）
  const rows = page.locator('.history-list li', { hasText: '连续3次听写全对' });
  await expect(rows).toHaveCount(1);
});

test('flow-points：月度表显示本人积分与名次', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('登记类型').selectOption('dictation');
  await page.getByLabel('秒跳开关').click();
  await page.getByLabel('日期').fill('2026-03-13');
  await page.getByLabel('作业内容').fill('第3单元');
  await page.getByLabel('作业内容').blur();
  await page.locator('[data-no="4"]').click();
  await page.keyboard.press('x');           // 缺交 → −3
  await page.keyboard.press('Control+s');

  await page.getByRole('button', { name: /积分/ }).click();
  await page.getByRole('tab', { name: '月度统计' }).click();
  await page.getByLabel('选择月份').selectOption('2026-03');

  await expect(page.getByRole('dialog')).toContainText('4');
  await expect(page.getByRole('dialog')).toContainText('-3');
});
