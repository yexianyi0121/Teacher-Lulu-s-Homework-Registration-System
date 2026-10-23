import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('flow-homework：50 人秒跳盲打 + 空格盖章 + 17 号 ×', async ({ page }) => {
  await page.locator('[data-no="1"]').click();

  // 1–16 号 A+，17 号 ×，18–50 号 A-
  for (let i = 1; i <= 16; i++) await page.keyboard.press('1');
  await page.keyboard.press('4');
  for (let i = 18; i <= 50; i++) await page.keyboard.press('3');

  await expect(page.locator('[data-no="17"]')).toHaveText(/×/);
  await expect(page.locator('[data-no="50"]')).toHaveText(/A-/);

  // 给 18 号（A-）盖「已更正」
  await page.locator('[data-no="18"]').click();
  await page.keyboard.press(' ');
  await expect(page.locator('[data-no="18"] .stamp-badge')).toHaveCount(1);

  // 常规作业不渲染统计条
  await expect(page.locator('.stats')).toHaveCount(0);

  // 报表：17 号进暂未提交，18 号进已更正
  await page.getByRole('button', { name: /报表生成/ }).click();
  const report = page.getByTestId('report-text');
  await expect(report).toContainText('❌ 【暂未提交】：\n17号');
  await expect(report).toContainText('✅ 【已更正】：\n18号');
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).last().click();

  // 海报
  await page.getByRole('button', { name: /截图发群/ }).click();
  await expect(page.getByAltText('学情海报预览')).toBeVisible({ timeout: 20_000 });
});

test('按 87.5 可完整输入（数字键不提前跳格）', async ({ page }) => {
  await page.getByLabel('录入模式').selectOption('quiz');
  await page.locator('[data-no="1"]').click();
  for (const ch of '87.5') await page.keyboard.press(ch);
  await expect(page.locator('[data-no="1"]')).toHaveText(/87\.5/);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-no="2"]')).toBeFocused();
});
