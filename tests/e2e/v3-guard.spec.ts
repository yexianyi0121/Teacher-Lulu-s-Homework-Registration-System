import { expect, test } from '@playwright/test';
import { closeJump, pickTemplate, resetApp, typeCell } from './v3-fixtures';

const DENY = '只有缺交或请假可以补交';

/**
 * E2E-27 补交门禁四态（FR-33 / INV-18）
 * 有值 / 空白 → 拒绝；缺交 / 请假 → 可补交。
 * 额外覆盖：已补交可改说明、全选混录只带候选人进入弹窗。
 */
test('E2E-27 补交门禁：有值与空白拒绝，缺交与请假可补交', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  const makeupBtn = page.getByRole('button', { name: /📥 补交/ });

  await test.step('已录等级的学生 → 拒绝并给提示，不弹窗', async () => {
    await typeCell(page, 1, ['2']); // A
    await page.locator('[data-no="1"]').click();
    await makeupBtn.click();
    await expect(page.getByText(DENY)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  await test.step('空白学生 → 同样拒绝', async () => {
    await page.locator('[data-no="5"]').click();
    await makeupBtn.click();
    await expect(page.getByText(DENY)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  await test.step('缺交 → 弹窗只列候选人，默认勾住焦点格，补交写进角标', async () => {
    await typeCell(page, 2, ['x']);
    await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-status', 'missing');
    await page.locator('[data-no="2"]').click();
    await makeupBtn.click();
    const dlg = page.getByRole('dialog', { name: '标记补交' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('checkbox')).toHaveCount(1);
    await expect(dlg.getByRole('checkbox', { name: /2号/ })).toBeChecked();
    await expect(dlg).toContainText('当前有 1 人缺交或请假');

    await dlg.getByLabel('补交说明（≤30 字）').fill('课后补交');
    await dlg.getByRole('button', { name: /确认补交/ }).click();
    await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-badge', 'madeup');
    await expect(page.locator('[data-no="2"] .cell-badge')).toHaveText('补');
    await expect(page.locator('[data-no="2"]')).toContainText('补交');
  });

  await test.step('已补交的缺交仍可再补（改说明，不叠加成新状态）', async () => {
    await page.locator('[data-no="2"]').click();
    await makeupBtn.click();
    const dlg = page.getByRole('dialog', { name: '标记补交' });
    await expect(dlg).toBeVisible();
    await dlg.getByLabel('补交说明（≤30 字）').fill('10/24 课后补交');
    await dlg.getByRole('button', { name: /确认补交/ }).click();
    await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-badge', 'madeup');
  });

  await test.step('请假 → 可补交，候选人标「假」', async () => {
    await typeCell(page, 3, ['l']);
    await expect(page.locator('[data-no="3"]')).toHaveAttribute('data-status', 'leave');
    await page.locator('[data-no="3"]').click();
    await makeupBtn.click();
    const dlg = page.getByRole('dialog', { name: '标记补交' });
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.makeup-tag[data-tag="假"]')).toHaveCount(1);
    await expect(dlg.getByRole('checkbox', { name: /3号/ })).toBeChecked();
    await dlg.getByRole('button', { name: /确认补交/ }).click();
    await expect(page.locator('[data-no="3"]')).toHaveAttribute('data-badge', 'madeup');
  });

  await test.step('全选混录 → 候选人只含缺交/请假，有值的不出现', async () => {
    await typeCell(page, 4, ['x']);
    await page.getByRole('button', { name: /全选/ }).click();
    await makeupBtn.click();
    const dlg = page.getByRole('dialog', { name: '标记补交' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('checkbox')).toHaveCount(3); // 2、3、4 号
    await expect(dlg.getByRole('checkbox', { name: /1号/ })).toHaveCount(0);
    await dlg.getByRole('button', { name: '取消' }).click();
  });
});
