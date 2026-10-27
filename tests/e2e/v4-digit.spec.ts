import { expect, test } from '@playwright/test';
import { closeJump, pickTemplate, resetApp, typeCell } from './v3-fixtures';

/**
 * E2E-34 / E2E-35（V4 FR-46 / ADR-22）：mixed 表数字键语义显式切换。
 * 真实 UI 驱动：敲键 → 断言格子内容；点 chip / 按反引号 → 断言语义与提示同步。
 */

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'custom');
  await expect(page.locator('.digit-chip')).toBeVisible();
});

test('E2E-34 混合表：敲 1 = A+；chip 切分数后 85 = 85 分；切回 2 = A', async ({ page }) => {
  await test.step('默认语义是「数字＝等级」', async () => {
    await expect(page.locator('.digit-chip')).toContainText('数字＝等级');
    await expect(page.locator('.digit-chip')).toHaveAttribute('data-meaning', 'grade');
    // 提示条与语义一致：键位以左侧色块呈现（v2.6.7：文字不再重复列一遍），文字只说明可切分数
    await expect(page.locator('.hint .hint-grade')).toHaveCount(8);
    await expect(page.locator('.hint-grade').first()).toContainText('A+');
    await expect(page.locator('.hint')).toContainText('按 ` 切「数字＝分数」');
  });

  await test.step('敲 1 → A+（V3 这里是「1 分」，本轮修复）', async () => {
    await typeCell(page, 1, ['1']);
    await expect(page.locator('[data-no="1"]')).toContainText('A+');
    await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-kind', 'grade');
  });

  await test.step('点 chip 切到「数字＝分数」→ 85 + Enter = 85 分', async () => {
    await page.locator('.digit-chip').click();
    await expect(page.locator('.digit-chip')).toContainText('数字＝分数');
    await expect(page.locator('.digit-chip')).toHaveAttribute('data-meaning', 'score');
    // 提示条同步改成分数语义，不再列等级键位
    await expect(page.locator('.hint')).toContainText('数字＝分数，Enter 提交');
    await expect(page.locator('.hint .hint-grade')).toHaveCount(0);

    await typeCell(page, 2, ['8', '5', 'Enter']);
    await expect(page.locator('[data-no="2"]')).toContainText('85');
    await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-kind', 'score');
  });

  await test.step('再点一次回到自动（mixed 自动＝等级）→ 敲 2 = A', async () => {
    await page.locator('.digit-chip').click();
    await expect(page.locator('.digit-chip')).toContainText('数字＝等级');
    await typeCell(page, 3, ['2']);
    await expect(page.locator('[data-no="3"]')).toContainText('A');
    // 第 1 格的 A+ 不受影响
    await expect(page.locator('[data-no="1"]')).toContainText('A+');
  });
});

test('E2E-35 混合表等级模式下敲 9：有 Toast、不静默吞键、格子无变化（R-10）', async ({ page }) => {
  await test.step('9 不在等级键位 → Toast 提示且不写值', async () => {
    await typeCell(page, 1, ['9']);
    await expect(page.locator('.toast')).toContainText('本表没有该等级键');
    await expect(page.locator('[data-no="1"]')).not.toHaveAttribute('data-kind', 'grade');
    await expect(page.locator('[data-no="1"]')).not.toHaveAttribute('data-kind', 'score');
    await expect(page.locator('[data-no="1"] .cell-value')).toHaveCount(0);
    await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-kind', 'empty');
  });

  await test.step('反引号快捷键切到分数 → 同一个 9 变成 9 分', async () => {
    await page.locator('[data-no="1"]').click();
    await page.keyboard.press('`');
    await expect(page.locator('.toast')).toContainText('数字键已切到');
    await expect(page.locator('.digit-chip')).toContainText('数字＝分数');
    await typeCell(page, 1, ['9', 'Enter']);
    await expect(page.locator('[data-no="1"]')).toContainText('9');
    await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-kind', 'score');
  });
});

test('E2E-34b 分数表（质量监测）不显示 chip，数字始终是分数（AC-87）', async ({ page }) => {
  await pickTemplate(page, 'quality');
  await expect(page.locator('.digit-chip')).toHaveCount(0);
  await typeCell(page, 1, ['8', '5', 'Enter']);
  await expect(page.locator('[data-no="1"]')).toContainText('85');
  // 按反引号也不会冒出 chip（没有歧义的方案保持安静）
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('`');
  await expect(page.locator('.digit-chip')).toHaveCount(0);
});
