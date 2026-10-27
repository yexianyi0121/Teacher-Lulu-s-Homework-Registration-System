import { expect, test } from '@playwright/test';
import { closeJump, closeModal, ensureSheet, pickTemplate, resetApp, waitPoster } from './v3-fixtures';

/**
 * E2E-39 / E2E-40（V4 FR-50 / FR-51 / ADR-26）——手机端形态与数据安全。
 * 375×667 与 390×844 两个真实手机视口：无横向溢出、网格 5 列、底部操作条 4 项可点、
 * 点格子弹 MobileKeypad、安装提示可关闭并记住、7 天未导出提醒出现且导出后消失；
 * E2E-40 覆盖分享优先 / 下载回退（navigator.share mock）。
 */

const VIEWPORTS = [
  { name: '375×667', width: 375, height: 667 },
  { name: '390×844', width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`E2E-39 ${vp.name}：无横向溢出 / 5 列 / 底部条 4 项可点（A-94）`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await resetApp(page);

    await test.step('安装提示可见，关闭后刷新不再出现（FR-51.1）', async () => {
      const hint = page.getByTestId('install-hint');
      await expect(hint).toBeVisible();
      await expect(hint).toContainText('添加到主屏幕');
      await hint.getByRole('button', { name: '知道了' }).click();
      await expect(hint).toHaveCount(0);
      await page.reload();
      await page.waitForSelector('.cell');
      // 刷新后空表不会留在 records 里（没有登记内容就不落库），作业内容要重新填
      await ensureSheet(page);
      await expect(page.getByTestId('install-hint')).toHaveCount(0);
    });

    await test.step('无横向溢出（scrollWidth ≤ clientWidth）', async () => {
      const m = await page.evaluate(() => ({
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        bodyScroll: document.body.scrollWidth,
        bodyClient: document.body.clientWidth,
        innerScroll: document.querySelector('.app-inner')?.scrollWidth ?? 0,
        innerClient: document.querySelector('.app-inner')?.clientWidth ?? 0,
      }));
      expect(m.docScroll).toBeLessThanOrEqual(m.docClient);
      expect(m.bodyScroll).toBeLessThanOrEqual(m.bodyClient);
      expect(m.innerScroll).toBeLessThanOrEqual(m.innerClient);
    });

    await test.step('网格 5 列（FR-50.2）', async () => {
      const cols = await page
        .locator('.grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
      expect(cols).toBe(5);
    });

    await test.step('点格子 → 底部升起 MobileKeypad，大按钮可直接录入（FR-50.4）', async () => {
      await page.locator('[data-no="1"]').click();
      const kp = page.getByTestId('mobile-keypad');
      await expect(kp).toBeVisible();
      await expect(kp.locator('.mk-title')).toContainText('1 号');
      // 常规作业：数字＝等级，1 = A+
      await kp.getByRole('button', { name: '数字 1' }).click();
      await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-kind', 'grade');
      await expect(page.locator('[data-no="1"]')).toContainText('A+');
      // 点另一格，键盘板跟着走；录「缺交」
      await page.locator('[data-no="2"]').click();
      await expect(kp.locator('.mk-title')).toContainText('2 号');
      await kp.getByRole('button', { name: '缺交' }).click();
      await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-status', 'missing');
      await kp.getByRole('button', { name: '完成' }).click();
      await expect(page.getByTestId('mobile-keypad')).toHaveCount(0);
    });

    await test.step('有数据后出现 7 天未导出提醒，点导出后消失（FR-51.2）', async () => {
      const remind = page.getByTestId('export-remind');
      await expect(remind).toBeVisible();
      await expect(remind).toContainText('还没备份过');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        remind.getByRole('button', { name: '导出备份' }).click(),
      ]);
      expect(download.suggestedFilename()).toContain('学情备份');
      await expect(remind).toHaveCount(0);
    });

    await test.step('底部操作条真正固定贴底：初始即贴视口底，滚 400px 后仍贴底（FR-50.3）', async () => {
      const bar = page.locator('.output-bar');
      await expect(bar.locator('.pill')).toHaveCount(4);
      // 真断言：量 boundingBox 比对视口底边——验证「在不在用户眼前」，
      // 而不是「DOM 里有没有」。v2.3.0 的旧断言只数 .pill 个数（页面任何位置都命中），
      // 且 click() 会自动滚动到元素，属于「断言与要求不对应」的假绿。
      // 用 poll 而非单次：键盘板收起时条有 .18s 过渡动画，量早了会量到中间态。
      const gapToBottom = async () => {
        const b = await bar.boundingBox();
        return b ? Math.abs(b.y + b.height - vp.height) : 999;
      };
      await expect.poll(gapToBottom, { timeout: 3000 }).toBeLessThan(4);   // 初始即贴底（fixed 而非 sticky）
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(150);
      await expect.poll(gapToBottom, { timeout: 3000 }).toBeLessThan(4);   // 滚到学生 30+ 号仍贴底
    });

    await test.step('底部操作条 4 项可点（报表 / 单条海报 / 当日汇总 / 本周汇总）', async () => {
      const bar = page.locator('.output-bar');
      await bar.getByRole('button', { name: '报表生成' }).click();
      await expect(page.locator('.modal')).toBeVisible();
      await closeModal(page);

      await bar.getByRole('button', { name: '单条海报' }).click();
      await waitPoster(page, '学情海报预览');
      await closeModal(page);

      await bar.getByRole('button', { name: '当日汇总' }).click();
      await waitPoster(page, '当日汇总预览');
      await closeModal(page);

      await bar.getByRole('button', { name: '本周汇总' }).click();
      await waitPoster(page, '本周汇总预览');
      await closeModal(page);
    });

    await page.screenshot({ path: `docs/assets/v2.3.0/mobile-${vp.width}x${vp.height}.png`, fullPage: false });
  });
}

test('E2E-39b 手机键盘等级行按方案档数全出：8 档混合表下 D 也有按钮（v2.3.1 P3-2 / v2.5.9 B-）', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await resetApp(page);
  await page.getByTestId('install-hint').getByRole('button', { name: '知道了' }).click();
  await closeJump(page);
  await pickTemplate(page, 'custom');   // 自定义 = mixed + 8 档 grades（v2.5.9）

  await page.locator('[data-no="1"]').click();
  const kp = page.getByTestId('mobile-keypad');
  await expect(kp).toBeVisible();
  const gradeKeys = kp.locator('.mk-key--grade');
  await expect(gradeKeys).toHaveCount(8);          // 8 档全出（旧代码 slice(0,6) 会吞掉 D）
  await expect(gradeKeys.last()).toHaveText('D');
  await kp.getByRole('button', { name: '等级 D' }).click();
  await expect(page.locator('[data-no="1"]')).toContainText('D');
});

test('E2E-40 分享优先、下载回退：navigator.share 存在→调用；不存在→下载（A-95）', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetApp(page);
  await closeJump(page);
  await page.getByTestId('install-hint').getByRole('button', { name: '知道了' }).click();

  // 造一条数据，保证海报有内容
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('1');
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
  // 手机端点格子会弹键盘板（盖住底部操作条）——真实用户先「完成」收键盘再出图
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByTestId('mobile-keypad')).toHaveCount(0);

  await page.locator('.output-bar').getByRole('button', { name: '单条海报' }).click();
  await waitPoster(page, '学情海报预览');

  await test.step('navigator.share 存在 → 调用它（mock 断言）', async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __shareCalls: Array<{ files?: File[]; title?: string; text?: string }> };
      w.__shareCalls = [];
      Object.defineProperty(navigator, 'share', {
        value: async (data: { files?: File[]; title?: string; text?: string }) => {
          w.__shareCalls.push(data);
        },
        configurable: true,
      });
    });
    await page.getByRole('button', { name: '分享图片' }).click();
    await expect(page.locator('.toast')).toContainText('已调起系统分享');
    // File 不能跨 Playwright 序列化边界，先在页面内取出需要断言的字段
    const calls = await page.evaluate(
      () =>
        (window as unknown as { __shareCalls: Array<{ files?: File[]; title?: string; text?: string }> }).__shareCalls.map(
          (c) => ({
            fileCount: c.files?.length ?? 0,
            name: c.files?.[0]?.name,
            type: c.files?.[0]?.type,
            size: c.files?.[0]?.size ?? 0,
            title: c.title,
            text: c.text,
          }),
        ),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].fileCount).toBe(1);
    expect(calls[0].type).toBe('image/png');
    expect(calls[0].name).toContain('学情海报');
    expect(calls[0].size).toBeGreaterThan(1000);
    expect(calls[0].title).toBe('海报预览');
  });

  await test.step('navigator.share 不存在 → 回退下载 PNG', async () => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '分享图片' }).click(),
    ]);
    expect(download.suggestedFilename()).toContain('学情海报');
    expect(download.suggestedFilename().endsWith('.png')).toBe(true);
    await expect(page.locator('.toast')).toContainText('当前环境不支持系统分享，已下载 PNG');
  });
});
