import { expect, test } from '@playwright/test';
import { closeJump, pickTemplate, resetApp, typeCell } from './v3-fixtures';

/**
 * v2.6.3（FR-72 / FR-73 / 改进1）：
 *  - 过关规则搬到「本表设置」，口径随方案类型走
 *  - 改方案点「完成」→ 二次确认 → 按新方案清空不兼容的已登记值
 *  - 顶栏当前时间 + 学期、页脚版本号、默认纯白主题
 */

const openScheme = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: /本表设置/ }).click();
  return page.getByRole('dialog');
};

test('FR-72.1 分数制：过关档位可选「优秀% / 良好% / 及格%」，不是只看及格线', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'quality');

  // 100 分制、及格 60 / 良好 80 / 优秀 90（每格打完按回车提交）
  for (const [no, digits] of [[1, ['9', '5']], [2, ['8', '5']], [3, ['6', '5']]] as const) {
    await typeCell(page, no, [...digits]);
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('[data-no="1"]')).toContainText('95');
  await expect(page.locator('[data-no="2"]')).toContainText('85');
  await expect(page.locator('[data-no="3"]')).toContainText('65');

  // 默认「达到及格% 才过关」
  await expect(page.locator('[data-no="3"]')).toHaveAttribute('data-badge', 'passed');

  const dlg = await openScheme(page);
  const tier = dlg.locator('#scheme-pass-tier');
  await expect(tier).toBeVisible();
  await tier.selectOption('good');
  await dlg.getByRole('button', { name: '完成' }).click();

  // 85 分达到良好 → 过关；65 分只到及格 → 不过关
  await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-badge', 'passed');
  await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-badge', 'passed');
  await expect(page.locator('[data-no="3"]')).not.toHaveAttribute('data-badge', 'passed');
  await expect(page.locator('[data-no="3"]')).toContainText('65');
});

test('FR-73.1 改方案点「完成」先二次确认，确认后清空不兼容的已登记值（等级 → 分数）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');
  await typeCell(page, 1, ['1']);        // A+
  await typeCell(page, 2, ['3']);        // A-
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  const dlg = await openScheme(page);
  await dlg.locator('#scheme-kind').selectOption('score');
  await dlg.getByRole('button', { name: '完成' }).click();

  const confirm = page.getByRole('dialog', { name: /确认修改本表方案/ });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('将被清空');
  await confirm.getByRole('button', { name: '确认修改' }).click();

  // 等级值被清空，格子回到空
  await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-kind', 'empty');
  await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-kind', 'empty');
});

test('FR-73.2 取消二次确认 → 方案回滚，已登记值一个都不动', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');
  await typeCell(page, 1, ['1']);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  const dlg = await openScheme(page);
  await dlg.locator('#scheme-kind').selectOption('score');
  await dlg.getByRole('button', { name: '完成' }).click();
  await page.getByRole('dialog', { name: /确认修改本表方案/ }).getByRole('button', { name: '取消' }).click();

  await expect(page.locator('[data-no="1"]')).toContainText('A+');
  // 方案也回滚成等级制
  const again = await openScheme(page);
  await expect(again.locator('#scheme-kind')).toHaveValue('grade');
  await again.getByRole('button', { name: '完成' }).click();
});

test('改进1 顶栏显示当前时间与学期，页脚显示版本号，默认主题为纯白', async ({ page }) => {
  await resetApp(page);

  const clock = page.getByLabel('当前时间');
  await expect(clock).toBeVisible();
  await expect(clock).toContainText('学年');
  await expect(clock).toContainText('学期');

  const footer = page.getByLabel('版本信息');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText('学情登记分析系统');
  await expect(footer).toContainText(/v\d+\.\d+\.\d+/);

  const theme = await page.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    image: getComputedStyle(document.body).backgroundImage,
    color: getComputedStyle(document.body).backgroundColor,
  }));
  expect(theme.attr).toBe('plain');
  expect(theme.color.replace(/\s/g, '')).toBe('rgb(255,255,255)');
});

test('E2E-31 v2.6.4：参数行常驻本表方案提示，点一下进本表设置', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  const chip = page.getByLabel('本表方案');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('等级制');
  await expect(chip).toContainText('过关');

  await chip.click();
  await expect(page.getByRole('dialog')).toContainText('本表评分方案');
  await page.getByRole('button', { name: '完成' }).click();
});

test('E2E-32 v2.6.4 BUG1：取消「允许 ✓ 过关标记」→ 提示清空 → 已打的 G 标记消失', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await typeCell(page, 1, ['2']); // A
  await page.waitForTimeout(800); // 等 700ms 的等级提交定时器落地，焦点还在这一格
  await page.keyboard.press('g'); // 手打过关标记（值会被标记顶掉，格子显示 ✓）
  await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-pass', '1');

  await page.getByRole('button', { name: /本表设置/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('允许过关标记').click();
  await dlg.getByRole('button', { name: '完成' }).click();

  const confirmDlg = page.getByRole('dialog', { name: /确认修改本表方案/ });
  await expect(confirmDlg).toBeVisible();
  await expect(confirmDlg).toContainText('个格子将被清空');
  await confirmDlg.getByRole('button', { name: '确认修改' }).click();

  // 标记被清掉，不再挂着 ✓；v2.6.8 起手打过关会保留原值，所以格子回到等级「A」并自动算过关（✓ 角标）
  const cell = page.locator('[data-no="1"]');
  await expect(cell).not.toHaveAttribute('data-pass', '1');
  await expect(cell).toHaveAttribute('data-kind', 'grade');
  await expect(cell).toContainText('A');
});

test('E2E-33 v2.6.4 BUG2：「听写/默写全对自动算过关」只在听写表的本表设置里出现', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);

  await pickTemplate(page, 'homework');
  await page.getByRole('button', { name: /本表设置/ }).click();
  let dlg = page.getByRole('dialog');
  await expect(dlg.getByLabel('听写/默写全对自动算过关')).toHaveCount(0);
  await dlg.getByRole('button', { name: '完成' }).click();

  await pickTemplate(page, 'dictation');
  await page.getByRole('button', { name: /本表设置/ }).click();
  dlg = page.getByRole('dialog');
  await expect(dlg.getByLabel('听写/默写全对自动算过关')).toHaveCount(1);
  await dlg.getByRole('button', { name: '完成' }).click();
});

test('E2E-34 v2.6.4 需求1：设置里按登记表导出表格（CSV 下载）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');
  await typeCell(page, 1, ['2']);
  await page.keyboard.press('Enter');

  await page.getByRole('button', { name: /设置/ }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('导出表格（按登记表）');
  // 先清空勾选再勾第一张
  await dlg.getByRole('button', { name: '清空勾选' }).click();
  const first = dlg.locator('.sheet-pick-row input[type="checkbox"]').first();
  await first.check();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByRole('button', { name: /导出 CSV/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/登记表.*\.csv$/);
});
