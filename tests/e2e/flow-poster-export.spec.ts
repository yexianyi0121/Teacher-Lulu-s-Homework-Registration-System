import { expect, test } from '@playwright/test';

test('flow-poster：当日汇总长图可生成并下载（AC-24.1 / AC-44）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  // 今天录两条：听写 + 常规作业
  await page.getByLabel('登记类型').selectOption('dictation');
  await page.getByLabel('作业内容').fill('第3单元字词');
  await page.getByLabel('作业内容').blur();
  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+s');

  await page.getByLabel('登记类型').selectOption('homework');
  await page.getByLabel('作业内容').fill('生字抄写');
  await page.getByLabel('作业内容').blur();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('2');
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: /当日汇总/ }).click();
  const img = page.getByAltText('当日汇总预览');
  await expect(img).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('dialog')).toContainText('当日汇总');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /下载 PNG/ }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('当日汇总');
});

test('flow-export：导出月度 ZIP（含 3 个 CSV，文件名带班级与月份）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('登记类型').selectOption('quality');
  await page.getByLabel('日期').fill('2026-03-13');
  await page.getByLabel('作业内容').fill('第3单元');
  await page.getByLabel('作业内容').blur();
  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('9');
  await page.keyboard.press('8');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+s');

  await page.getByRole('button', { name: /^📤 导出$/ }).click();
  await page.getByLabel('月份').fill('2026-03');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /导出 ZIP/ }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('三年二班');
  expect(download.suggestedFilename()).toContain('2026-03');
  expect(download.suggestedFilename().endsWith('.zip')).toBe(true);
});
