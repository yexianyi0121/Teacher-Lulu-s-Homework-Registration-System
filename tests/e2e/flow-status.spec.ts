import { expect, test } from '@playwright/test';

test('flow-status：过关 / 请假 / 缺交 / 只看未过关（FR-21 / FR-22 / FR-23）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('登记类型').selectOption('dictation');
  await page.getByLabel('秒跳开关').click();
  await page.getByLabel('作业内容').fill('第3单元字词');
  await page.getByLabel('作业内容').blur();

  // 1–3 号过关
  for (const no of [1, 2, 3]) {
    await page.locator(`[data-no="${no}"]`).click();
    await page.keyboard.press('Enter');
    await expect(page.locator(`[data-no="${no}"]`)).toContainText('√');
  }

  // 4 号请假、5 号缺交
  await page.locator('[data-no="4"]').click();
  await page.keyboard.press('l');
  await expect(page.locator('[data-no="4"]')).toContainText('假');
  await page.locator('[data-no="5"]').click();
  await page.keyboard.press('x');
  await expect(page.locator('[data-no="5"]')).toContainText('×');

  // 只看未过关：应只剩 4、5 与空白学生（4 请假被排除）
  await page.getByLabel('只看未过关').click();
  await expect(page.locator('.cell')).toHaveCount(46);
  await page.getByLabel('只看未过关').click();

  // 报表：已过关 / 暂未提交 / 请假 三段
  await page.keyboard.press('Control+Enter');
  const report = page.getByTestId('report-text');
  await expect(report).toContainText('✅ 【已过关】：1号、2号、3号');
  await expect(report).toContainText('❌ 【暂未提交】：');
  await expect(report).toContainText('5号');
  await expect(report).toContainText('🏖️ 【请假】：4号');
});

test('flow-status：补交带说明后从暂未提交移入已补交（AC-23.1）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('登记类型').selectOption('homework');
  await page.getByLabel('秒跳开关').click();

  await page.locator('[data-no="3"]').click();
  await page.keyboard.press('x');
  await expect(page.locator('[data-no="3"]')).toHaveAttribute('data-status', 'missing');

  await page.locator('[data-no="3"]').click();
  await page.keyboard.press('m');
  await page.getByLabel('补交说明（≤30 字）').fill('课后补交');
  await page.getByRole('dialog').getByRole('button', { name: '确认' }).click();

  await expect(page.locator('[data-no="3"] [data-stamp="makeup"]')).toHaveCount(1);

  await page.keyboard.press('Control+Enter');
  const report = page.getByTestId('report-text');
  await expect(report).toContainText('📥 【已补交】：3号（课后补交）');
  await expect(report).not.toContainText('❌ 【暂未提交】：3号');
});

test('flow-status：自定义文字（F2）不并入名单（AC-20.1）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('登记类型').selectOption('dictation');
  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="2"]').click();
  await page.keyboard.press('F2');
  await page.getByLabel('2号 自定义文字').fill('半对');
  await page.getByLabel('2号 自定义文字').press('Enter');

  await expect(page.locator('[data-no="2"]')).toContainText('半对');

  await page.keyboard.press('Control+Enter');
  const report = page.getByTestId('report-text');
  await expect(report).toContainText('⚠️ 【需更正】：');
  await expect(report).toContainText('2号');
});
