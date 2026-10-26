import { expect, test } from '@playwright/test';
import { capturePosterText, closeJump, closeModal, pickTemplate, resetApp, setDate, typeCell, waitPoster } from './v3-fixtures';

/**
 * 取「本周」内的 count 天（与系统同口径：周一为一周之始）。
 * 从本周一往后取，保证这 count 天一定落在同一周里；
 * 这样「7 - count 天无登记」的断言在任何一天都成立。
 */
function currentWeekDays(count: number): string[] {
  const now = new Date();
  const dow = now.getDay() || 7;            // 周日 = 0 → 视作 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow - 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return out;
}

/**
 * E2E-31 本周汇总（FR-43 / 设计 06 §3.7）
 * 按日拼接、无登记的日期显式写「当日无登记」、文件名单号含周区间。
 * 说明：分卷阈值 16000px 在教室真实数据量（≤120 人 × 4 表 × 7 天 ≈ 12.8k）下触达不到，
 * 分卷逻辑由 tests/unit/posterWeek.test.ts 断言；这里断言「单页时不得出现分卷角标」。
 */
test('E2E-31 本周汇总：三天数据按日拼接，空日写「当日无登记」，文件名带周区间', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  // 断言「7 天里 4 天没登记 → 4 个当日无登记」的前提是：这三天必须同属一周。
  // 直接取 iso(0)/iso(-1)/iso(-2) 的话，每逢周一（或周二）这三天会跨周，
  // 本周汇总里就只剩 1~2 张登记、空日变 5~6 个，用例必然红。
  // 正确做法是锚定到「本周」内的三天：本周一之后的连续三天（跨周则退回到本周内可取的三天）。
  const days = currentWeekDays(3);
  for (const date of days) {
    await setDate(page, date);
    for (const no of [1, 2, 3]) await typeCell(page, no, ['2']);
  }

  await setDate(page, days[0]);

  let posterText = '';
  posterText = await capturePosterText(page, async () => {
    await page.getByRole('button', { name: /本周汇总/ }).click();
    await waitPoster(page, '本周汇总预览');
  });

  await test.step('标题/统计与按日拼接', async () => {
    expect(posterText).toContain('周汇总');
    expect(posterText).toContain('共 3 张登记');
    // 7 天里 4 天没登记 → 4 个「当日无登记」
    expect((posterText.match(/当日无登记/g) ?? []).length).toBe(4);
    // 三天的日期标题都在
    for (const date of days) {
      const [, m, d] = date.split('-');
      expect(posterText).toContain(`${Number(m)}月${Number(d)}日`);
    }
    // 单页：不得出现「第 x / y 张」
    expect(posterText).not.toMatch(/第 \d+ \/ \d+ 张/);
  });

  await test.step('下载文件名 = 学情周汇总-周一起_周日止.png', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('dialog').getByRole('button', { name: /下载 PNG/ }).click(),
    ]);
    const name = download.suggestedFilename();
    expect(name).toMatch(/^学情周汇总-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.png$/);
  });

  await closeModal(page);

  await test.step('没有登记的周 → 提示不生成', async () => {
    await setDate(page, '2020-01-01');
    await page.getByRole('button', { name: /本周汇总/ }).click();
    await expect(page.locator('.toast')).toContainText('本周暂无登记');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
