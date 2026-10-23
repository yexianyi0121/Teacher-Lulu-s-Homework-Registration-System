import { expect, test } from '@playwright/test';

test('persistence：录入 → 刷新 → 数据仍在（V1 回归）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('2');
  await page.waitForTimeout(600);

  await page.reload();
  await expect(page.locator('[data-no="1"]')).toContainText('A');
});

test('persistence：人数 50→40→50 不丢隐藏数据（INV-8）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('秒跳开关').click();
  await page.locator('[data-no="45"]').click();
  await page.keyboard.press('1');

  await page.getByTitle('设置').click();
  await page.getByLabel('学生人数（1–120）').fill('40');
  await page.getByLabel('学生人数（1–120）').blur();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.locator('[data-no="45"]')).toHaveCount(0);

  await page.getByTitle('设置').click();
  await page.getByLabel('学生人数（1–120）').fill('50');
  await page.getByLabel('学生人数（1–120）').blur();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.locator('[data-no="45"]')).toContainText('A+');
});

test('persistence：v1 数据自动迁移后可继续使用（AC-60 / M-1~M-3）', async ({ page }) => {
  const v1 = {
    version: 1,
    classInfo: { name: '三年二班', school: '某某中学', teacher: '刘露', subject: '语文', students: [], count: 3 },
    drafts: {
      k1: {
        id: 'k1', date: '2026-03-13', content: '语文本', mode: 'homework',
        entries: {
          '1': { value: { kind: 'grade', grade: 'A+' }, stamp: 'none', updatedAt: 1 },
          '2': { value: { kind: 'grade', grade: 'CHECK' }, stamp: 'none', updatedAt: 1 },
          '3': { value: { kind: 'grade', grade: 'CROSS' }, stamp: 'none', updatedAt: 1 },
        },
        createdAt: 1, updatedAt: 1,
      },
    },
    activeKey: 'k1',
    history: [],
    settings: { count: 3, secondsJump: false, showName: false, excellentLine: 90, passLine: 60 },
  };
  // 必须在应用脚本执行前种入：先 goto 再 evaluate 的话，首屏的自动保存
  // 可能把空白的 v2 写进 localStorage，reload 后 v2 优先于 v1，迁移用例偶发失败。
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('xq.e2e.seeded')) return;
    sessionStorage.setItem('xq.e2e.seeded', '1');
    localStorage.clear();
    localStorage.setItem('xq.state.v1', JSON.stringify(seed));
  }, v1);
  await page.goto('/');
  await page.waitForSelector('.cell');

  // A+ 原样保留；√ → 过关；× → 缺交
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
  await expect(page.locator('[data-no="2"]')).toContainText('√');
  await expect(page.locator('[data-no="3"]')).toHaveAttribute('data-status', 'missing');
  await expect(page.locator('.cell')).toHaveCount(3);

  // 迁移后可继续录入并持久化
  await page.locator('[data-no="2"]').click();
  await page.keyboard.press(' ');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
});

test('persistence：清空当前记录可 Ctrl+Z 一次恢复', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByLabel('秒跳开关').click();
  for (const no of [1, 2, 3]) {
    await page.locator(`[data-no="${no}"]`).click();
    await page.keyboard.press('1');
  }
  await page.getByRole('button', { name: /清空/ }).click();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.locator('[data-no="1"]')).not.toContainText('A+');

  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
});
