import { expect, test } from '@playwright/test';
import { capturePosterText, closeJump, closeModal, pickTemplate, resetApp, typeCell, waitPoster } from './v3-fixtures';

/**
 * E2E-29 过关规则联动（FR-32 / AC-32.2 / 唯一入口 isPassed）
 * 改规则只重算「✅ 角标 / 只看未过关 / 海报统计」，不动任何已录入的值。
 */
test('E2E-29 过关规则：白名单改动重算 ✅ 与筛选，已录值不变', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework'); // 等级制，键位 1=A+ 2=A 3=A- 4=B 5=B- 6=C 7=D（v2.5.9 B- 加入默认档）

  await test.step('录入 A / A- / C / D', async () => {
    await typeCell(page, 1, ['2']); // A
    await typeCell(page, 2, ['3']); // A-
    await typeCell(page, 3, ['6']); // C（键位 6，B- 占用 5）
    await typeCell(page, 4, ['7']); // D（键位 7）
    await expect(page.locator('[data-no="1"]')).toContainText('A');
    await expect(page.locator('[data-no="2"]')).toContainText('A-');
    await expect(page.locator('[data-no="3"]')).toContainText('C');
    await expect(page.locator('[data-no="4"]')).toContainText('D');
  });

  await test.step('v2.6.3 新口径：等级制只看本表白名单（默认 A+/A）→ 只有 A 过关', async () => {
    await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-badge', 'passed');
    await expect(page.locator('[data-no="2"]')).not.toHaveAttribute('data-badge', 'passed');
    await expect(page.locator('[data-no="3"]')).not.toHaveAttribute('data-badge', 'passed');
    await expect(page.locator('[data-no="4"]')).not.toHaveAttribute('data-badge', 'passed');

    await page.getByLabel('只看未过关').click();
    await expect(page.locator('.cell')).toHaveCount(49); // 50 - 1 过关
    await page.getByLabel('只看未过关').click();
  });

  await test.step('在本表设置里把 A- 也勾进白名单 → 重算 ✅ 与筛选', async () => {
    await page.getByRole('button', { name: /本表设置/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('等级过关 A-').click();
    await dlg.getByRole('button', { name: '完成' }).click();

    await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-badge', 'passed');
    await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-badge', 'passed');
    await expect(page.locator('[data-no="3"]')).not.toHaveAttribute('data-badge', 'passed');
    await expect(page.locator('[data-no="4"]')).not.toHaveAttribute('data-badge', 'passed');

    await page.getByLabel('只看未过关').click();
    await expect(page.locator('.cell')).toHaveCount(48); // 50 - 2 过关
    await page.getByLabel('只看未过关').click();

    // 已录值一个都没动
    await expect(page.locator('[data-no="1"]')).toContainText('A');
    await expect(page.locator('[data-no="2"]')).toContainText('A-');
    await expect(page.locator('[data-no="3"]')).toContainText('C');
  });
});

test('E2E-29b 听写「全对自动过关」开关联动 ✅ / 筛选 / 汇总图统计行', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'dictation');

  await typeCell(page, 1, ['0']); // 全对
  await typeCell(page, 2, ['3']); // 错3
  await expect(page.locator('[data-no="1"]')).toContainText('全对');
  await expect(page.locator('[data-no="2"]')).toContainText('错3');

  const shot = async () => {
    const text = await capturePosterText(page, async () => {
      await page.getByRole('button', { name: /当日汇总/ }).click();
      await waitPoster(page, '当日汇总预览');
    });
    await closeModal(page);
    return text;
  };

  await test.step('默认：全对算过关 → 通关 1 人', async () => {
    await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-badge', 'passed');
    await expect(page.locator('[data-no="2"]')).not.toHaveAttribute('data-badge', 'passed');
    const text = await shot();
    expect(text).toContain('过关 1 · 未过关 1');
  });

  await test.step('关掉自动过关 → 全对也算未过关，汇总图同步', async () => {
    await page.getByRole('button', { name: /本表设置/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('听写/默写全对自动算过关').click();
    await dlg.getByRole('button', { name: '完成' }).click();

    await expect(page.locator('[data-no="1"]')).not.toHaveAttribute('data-badge', 'passed');
    await page.getByLabel('只看未过关').click();
    await expect(page.locator('.cell')).toHaveCount(50);
    await page.getByLabel('只看未过关').click();

    const text = await shot();
    expect(text).toContain('过关 0 · 未过关 2');
    // 录入值不受规则影响
    await expect(page.locator('[data-no="1"]')).toContainText('全对');
  });
});
