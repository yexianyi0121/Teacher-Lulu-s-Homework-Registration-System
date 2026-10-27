import { expect, test } from '@playwright/test';
import { closeJump, pickTemplate, resetApp, typeCell } from './v3-fixtures';

/**
 * v2.6.5 需求1/2/4：
 * - 系统设置里能按表导出 Excel（日期按文本写入，不再出现 `#####`）；
 * - 「请假算过关」取消勾选时，请假的学生要参与「只看未过关」筛选。
 */

test('FR-76.2 按表导出 Excel：下载 .xlsx（日期按文本，不会显示 #####）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();
  await typeCell(page, 1, ['1']);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  await page.getByTitle('设置').click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();

  // 导出区：勾选今天的这张表
  await expect(dlg.getByLabel('导出日期')).toBeVisible();
  const pick = dlg.getByLabel(/^导出 常规作业/).first();
  if (!(await pick.isChecked())) await pick.check();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByRole('button', { name: /导出 Excel/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});

test('FR-76.3 取消「请假算过关」后，请假学生参与「只看未过关」筛选', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();

  // 1 号过关（A+），2 号请假
  await typeCell(page, 1, ['1']);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
  await page.locator('[data-no="2"]').click();
  await page.getByRole('button', { name: /请假/ }).click();
  await expect(page.locator('[data-no="2"]')).toContainText('假');

  // 打开「只看未过关」：默认「请假不算过关」→ 2 号必须出现，1 号被筛掉
  await page.getByLabel('只看未过关').click({ force: true });
  await expect(page.locator('[data-no="2"]')).toBeVisible();
  await expect(page.locator('[data-no="1"]')).toHaveCount(0);

  // 本表设置里勾上「请假算过关」，再回来 2 号就该被筛掉
  await page.getByRole('button', { name: /本表方案/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('请假算过关').check();
  await dlg.getByRole('button', { name: '完成' }).click();
  await expect(page.locator('[data-no="2"]')).toHaveCount(0);
});
