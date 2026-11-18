import { expect, test } from '@playwright/test';
import { createSheet, setDate, typeCell } from './v3-fixtures';

test('空态：新建前不显示学生网格，只有醒目的「新建登记」', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.empty-cta');

  await expect(page.locator('.cell')).toHaveCount(0);
  await expect(page.getByLabel('作业内容')).toHaveValue('');
  await expect(page.getByLabel('作业内容')).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('修改表名')).toHaveCount(0);

  await page.locator('.empty-cta-btn').click();
  await page.getByLabel('登记表名称').fill('第一次登记');
  await page.getByRole('button', { name: '创建登记表' }).click();

  await expect(page.locator('.cell')).toHaveCount(50);
  await expect(page.getByLabel('作业内容')).toHaveValue('第一次登记');
  await expect(page.getByRole('button', { name: '修改表名' })).toBeVisible();
});

test('修改表名：保留已录数据；同名被拒绝', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.empty-cta');

  await createSheet(page, '原始名称');
  await typeCell(page, 1, ['1']);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  // 改名：数据保留
  await page.getByLabel('修改表名').click();
  await page.getByLabel('登记表名称').fill('改名后');
  await page.getByRole('button', { name: '保存表名' }).click();
  await expect(page.getByLabel('作业内容')).toHaveValue('改名后');
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  // 再建一张，然后尝试改成同名 → 拒绝
  await createSheet(page, '另一张');
  await page.getByLabel('修改表名').click();
  await page.getByLabel('登记表名称').fill('改名后');
  await page.getByRole('button', { name: '保存表名' }).click();
  await expect(page.locator('.field-error')).toContainText('同名');
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByLabel('作业内容')).toHaveValue('另一张');
});

test('历史日期该类型没有表时，同样显示新建按钮', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.empty-cta');

  await setDate(page, '2020-01-02');
  await expect(page.locator('.empty-cta')).toBeVisible();
  await expect(page.locator('.cell')).toHaveCount(0);
  await expect(page.getByLabel('作业内容')).toHaveValue('');
});
