import { expect, test } from '@playwright/test';
import { closeJump, pickTemplate, resetApp, typeCell } from './v3-fixtures';

/**
 * FR-78（v2.6.8）：听写表数字键自动按听写语义记「错几」。
 * 提示条写着「0–9（0=全对）」，那么敲下去就必须真的按听写语义记，
 * 两位数字 22 要在窗口期内拼成「错22」。
 */
test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'dictation');
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();
});

test('FR-78.1 听写表敲 2 = 错2（不会提示「本表不接受分数」）', async ({ page }) => {
  await typeCell(page, 1, ['2']);
  await expect(page.locator('[data-no="1"]')).toContainText('错2');
  await expect(
    page.locator('.toast, [role="status"]').filter({ hasText: '本表不接受分数' }),
  ).toHaveCount(0);
});

test('FR-78.2 听写表 900ms 内连敲 2、2 = 错22，并延时自动跳下一格', async ({ page }) => {
  // 自动跳格依赖「秒跳」开关，本用例先确保它是开的（beforeEach 里的 closeJump 会关掉）
  const toggle = page.getByLabel('秒跳开关');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('2');
  await page.waitForTimeout(120);
  await page.keyboard.press('2');
  // 焦点必须仍停在 1 号格：窗口期内不能抢焦点，否则第二位数字会打到下一格
  await expect(page.locator('[data-no="1"][data-focus="1"]')).toHaveCount(1);

  await expect(page.locator('[data-no="1"]')).toContainText('错22');
  // 窗口过后才跳到下一格
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-no="2"][data-focus="1"]')).toHaveCount(1);
  await expect(page.locator('[data-no="1"][data-focus="1"]')).toHaveCount(0);
});

test('FR-78.3 手打 G 过关后，格子仍显示原来的错题数', async ({ page }) => {
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('2');
  await page.waitForTimeout(120);
  await page.keyboard.press('2');
  await expect(page.locator('[data-no="1"]')).toContainText('错22');

  await page.keyboard.press('g');
  const cell = page.locator('[data-no="1"]');
  await expect(cell).toContainText('✓');
  // 主值变成 ✓ 之后，原来登记的错题数仍要在格子里看得见
  await expect(cell).toContainText('错22');
});
