import { expect, test } from '@playwright/test';

const SCORES: Array<[number, number]> = [
  [1, 98], [2, 95], [3, 94], [4, 89], [5, 92],
  [6, 91], [7, 95], [8, 98], [9, 98], [10, 94],
  [11, 92], [12, 90.5], [13, 94], [14, 88], [15, 72],
  [16, 94], [17, 43], [18, 88], [19, 73], [20, 75],
];

const EXPECTED_REPORT = `🌸 3月13日 【💯 单元测试】综合反馈 🌸
📖 作业内容：语文本
-------------------------
🏆 【光荣榜】本次表现优异/全对的同学：
1号、2号、3号、5号、6号、7号、8号、9号、10号、11号、12号、13号、16号

❌ 【暂未提交】：
21号、22号、23号、24号、25号、26号、27号、28号、29号、30号、31号
32号、33号、34号、35号、36号、37号、38号、39号、40号、41号、42号
43号、44号、45号、46号、47号、48号、49号、50号

⚠️ 【需更正】：
17号
（请核对后及时找老师更正）`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('flow-quiz：样例 A 统计条 → 报表逐字 → 复制 → 海报预览', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // 切换模式 + 日期 + 作业内容
  await page.getByLabel('录入模式').selectOption('quiz');
  await page.getByLabel('日期').fill('2026-03-13');
  await page.getByLabel('作业内容').fill('语文本');
  await page.getByLabel('作业内容').blur();
  await page.locator('[data-no="1"]').click();

  for (const [, score] of SCORES) {
    for (const ch of String(score)) {
      await page.keyboard.press(ch === '.' ? '.' : ch);
    }
    await page.keyboard.press('Enter');
  }

  const stats = page.locator('.stats');
  await expect(stats).toContainText('录入人数20');
  await expect(stats).toContainText('平均分87.7');
  await expect(stats).toContainText('优秀(90+)13');
  await expect(stats).toContainText('良好(80+)3');
  await expect(stats).toContainText('及格(60+)3');
  await expect(stats).toContainText('不及格1');

  // 环形图四段占比
  const donut = page.locator('figure[role="img"]').first();
  await expect(donut).toContainText('90分+ · 65%');

  // 报表
  await page.getByRole('button', { name: /报表生成/ }).click();
  const report = page.getByTestId('report-text');
  await expect(report).toHaveText(EXPECTED_REPORT);

  await page.getByRole('button', { name: /复制文案/ }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  // Windows 剪贴板会把 \n 规范化为 \r\n，比较前统一换行符
  expect(clip.replace(/\r\n/g, '\n')).toBe(EXPECTED_REPORT);

  // 海报
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).last().click();
  await page.getByRole('button', { name: /截图发群/ }).click();
  await expect(page.getByAltText('学情海报预览')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('dialog')).toContainText('海报预览');
});
