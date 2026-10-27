import { expect, test } from '@playwright/test';

test('flow-quality：混合方案下打分数与等级，统计按百分比', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');
  // v2.6.3 FR-73.4：作业内容是登记前提
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();

  // 自定义模板 = 混合方案（默认满分 100）
  await page.getByLabel('登记类型').selectOption('custom');
  await page.getByLabel('日期').fill('2026-03-13');
  await page.getByLabel('作业内容').fill('第3单元');
  await page.getByLabel('新建登记').click();
  await page.getByLabel('作业内容').blur();

  await page.getByLabel('秒跳开关').click(); // 先关秒跳，逐格录

  // V4 FR-46：混合表数字键默认是等级；要打分数先点 chip 切语义
  await page.locator('.digit-chip').click();
  await expect(page.locator('.digit-chip')).toContainText('数字＝分数');

  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('8');
  await page.keyboard.press('7');
  await page.keyboard.press('.');
  await page.keyboard.press('5');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-no="1"]')).toContainText('87.5');

  await page.locator('[data-no="2"]').click();
  await page.keyboard.press('a');
  await page.keyboard.press('+');
  await expect(page.locator('[data-no="2"]')).toContainText('A+');

  // 报表：质量监测/自定义 名称 + 班级行 + 名单口径
  await page.keyboard.press('Control+Enter');
  const report = page.getByTestId('report-text');
  await expect(report).toContainText('【🏷️ 自定义】');
  await expect(report).toContainText('🏫 班级：三年二班');
  await expect(report).toContainText('🏆 【光荣榜】');
  await expect(report).toContainText('2号');
});

test('flow-quality：满分 120 的表按百分比判定（73 分及格 / 71 分不及格）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');
  // v2.6.3 FR-73.4：作业内容是登记前提
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();

  await page.getByLabel('登记类型').selectOption('custom');
  await page.getByRole('button', { name: /本表设置/ }).click();
  await page.getByLabel('满分（1–200）').fill('120');
  await page.getByLabel('满分（1–200）').blur();
  await page.getByRole('button', { name: '完成' }).click();

  await page.getByLabel('秒跳开关').click();
  // V4 FR-46：先切到「数字＝分数」再录分数
  await page.locator('.digit-chip').click();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('7');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await page.locator('[data-no="2"]').click();
  await page.keyboard.press('7');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');

  await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-tone', 'amber');
  await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-tone', 'red');
});

test('flow-quality：质量监测模板出现统计条，且标签随阈值变化', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');
  // v2.6.3 FR-73.4：作业内容是登记前提
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();

  await page.getByLabel('登记类型').selectOption('quality');
  // V4 FR-49.6：统计条默认收起（高度预算），点一下展开全部 12 项
  await expect(page.locator('.stats--collapsed')).toContainText('本次统计');
  await page.locator('.stats--collapsed').click();
  await expect(page.locator('.stats')).toBeVisible();
  await expect(page.locator('.stats')).toContainText('优秀');
  await expect(page.locator('.stats')).toContainText('达标率');

  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('9');
  await page.keyboard.press('8');
  await page.keyboard.press('Enter');
  await expect(page.locator('.stats')).toContainText('98');
});
