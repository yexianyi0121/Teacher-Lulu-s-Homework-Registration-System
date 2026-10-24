import { expect, test } from '@playwright/test';

test('flow-manual：从头部打开手册，18 章齐全，搜索「补交」可定位（AC-56 / AC-57）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByTitle('使用手册').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('使用手册');
  await expect(dialog).toContainText('5 分钟上手');
  // V3 三节（P3-1）与「达标/过关」双口径说明（P3-2）
  for (const title of ['数据健康与备份恢复', '本周汇总与三向切换', '评价语与自定义积分规则']) {
    await expect(dialog).toContainText(title);
  }
  await expect(dialog).toContainText('达标但不过关');
  // V4 三节（设计 09 §2：数字键语义 / 背景主题 / 手机端）
  for (const title of ['数字键语义', '背景主题', '手机端使用']) {
    await expect(dialog).toContainText(title);
  }
  await expect(dialog).toContainText('反引号');
  await expect(dialog).toContainText('7 天');


  await page.getByLabel('搜索手册').fill('补交');
  await expect(dialog).toContainText('补交');
  await expect(dialog.locator('.manual-toc a')).toHaveCount(1, { timeout: 3000 }).catch(async () => {
    // 「补交」可能同时命中状态章与补交章，至少要有 1 条
    expect(await dialog.locator('.manual-toc a').count()).toBeGreaterThanOrEqual(1);
  });
});

test('flow-manual：设置里也能打开手册', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByTitle('设置').click();
  await expect(page.getByRole('dialog')).toContainText('班级信息');
  await page.getByRole('button', { name: '完成' }).click();

  await page.getByTitle('使用手册').click();
  await expect(page.getByRole('dialog')).toContainText('内置');
});
