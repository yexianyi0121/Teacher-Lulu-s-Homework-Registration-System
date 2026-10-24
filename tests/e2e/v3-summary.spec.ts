import { expect, test } from '@playwright/test';
import { closeJump, closeModal, pickTemplate, resetApp, typeCell, waitPoster } from './v3-fixtures';

/**
 * E2E-26 汇总三向切换（设计 06 §3.6 / INV-23 / FR-34）
 * 单条 ↔ 当日汇总 ↔ 本周汇总：标题、预览图、表选择器必须跟着目标走，
 * 且切换后不能出现「张冠李戴」的旧图（每次切换都重新生成）。
 */
test('E2E-26 汇总三向切换 + 单条换表重新生成', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await resetApp(page);
  await closeJump(page);

  // 当天两张表：常规作业（1、2 号 A）+ 听写（1 号全对）
  await pickTemplate(page, 'homework');
  await typeCell(page, 1, ['2']);
  await typeCell(page, 2, ['2']);
  await pickTemplate(page, 'dictation');
  await typeCell(page, 1, ['0']);
  await expect(page.locator('[data-no="1"]')).toContainText('全对');

  await test.step('单条海报：带表选择器，列出当天两张表', async () => {
    await page.getByRole('button', { name: /单条海报/ }).click();
    const dlg = page.getByRole('dialog', { name: '海报预览' });
    await expect(dlg).toBeVisible();
    const sel = dlg.getByLabel('选择登记表');
    await expect(sel.locator('option')).toHaveCount(2);
    await waitPoster(page, '学情海报预览');
  });

  await test.step('切到当日汇总：无表选择器', async () => {
    await page.getByRole('dialog').getByRole('button', { name: '当日汇总' }).click();
    await expect(page.getByRole('dialog', { name: '当日汇总预览' })).toBeVisible();
    await waitPoster(page, '当日汇总预览');
    await expect(page.getByRole('dialog').getByLabel('选择登记表')).toHaveCount(0);
  });

  await test.step('切到本周汇总', async () => {
    await page.getByRole('dialog').getByRole('button', { name: '本周汇总' }).click();
    await expect(page.getByRole('dialog', { name: '本周汇总预览' })).toBeVisible();
    await waitPoster(page, '本周汇总预览');
  });

  await test.step('回到单条：仍是同一张表，且换表后图片重新生成', async () => {
    await page.getByRole('dialog').getByRole('button', { name: '单条' }).click();
    await expect(page.getByRole('dialog', { name: '海报预览' })).toBeVisible();
    const dlg = page.getByRole('dialog');
    const sel = dlg.getByLabel('选择登记表');
    await waitPoster(page, '学情海报预览');

    const before = await page.locator('.poster-preview').getAttribute('src');
    const cur = await sel.inputValue();
    const other = (await sel.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value)))
      .find((v) => v !== cur) as string;
    expect(other).toBeTruthy();

    await sel.selectOption(other);
    await expect(page.getByRole('dialog', { name: '海报预览' })).toBeVisible();
    await waitPoster(page, '学情海报预览');
    const after = await page.locator('.poster-preview').getAttribute('src');
    expect(after).not.toBe(before);
  });

  await closeModal(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errs).toEqual([]);
});
