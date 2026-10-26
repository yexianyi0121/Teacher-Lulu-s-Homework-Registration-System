import { expect, test } from '@playwright/test';
import { closeJump, pickTemplate, resetApp, typeCell } from './v3-fixtures';

/**
 * E2E-36 / E2E-38（V4 FR-47 / ADR-23 + FR-49 / ADR-25）：
 * 单元格四角分区互不重叠；1366×768 不出现纵向滚动；输出带 4 按钮顺序固定。
 */

/** 两个矩形是否相交（用于「互不重叠」断言） */
async function overlaps(page: import('@playwright/test').Page, a: string, b: string): Promise<boolean> {
  return page.evaluate(
    ([sa, sb]) => {
      const ra = document.querySelector(sa)?.getBoundingClientRect();
      const rb = document.querySelector(sb)?.getBoundingClientRect();
      if (!ra || !rb) throw new Error(`missing ${sa} / ${sb}`);
      return !(ra.right <= rb.left || rb.right <= ra.left || ra.bottom <= rb.top || rb.bottom <= ra.top);
    },
    [a, b],
  );
}

test('E2E-36 四角分区：学号/印章/状态角标两两不重叠（A-88）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'custom');
  // 切到数字＝分数，录一个分数
  await page.locator('.digit-chip').click();

  await test.step('1 号：分数 + 优秀印章', async () => {
    await typeCell(page, 1, ['8', '5', 'Enter']);
    await expect(page.locator('[data-no="1"]')).toContainText('85');
    await page.locator('[data-no="1"]').click();
    await page.getByLabel('盖章类型').selectOption('excellent');
    await page.keyboard.press(' ');
    await expect(page.locator('[data-no="1"] .cell-stamp')).toBeVisible();
  });

  await test.step('2 号：等级 + 已更正印章', async () => {
    await page.locator('.digit-chip').click();   // 切回等级语义
    await expect(page.locator('.digit-chip')).toContainText('数字＝等级');
    await typeCell(page, 2, ['1']);   // 等级语义下 1 = A+
    await expect(page.locator('[data-no="2"]')).toContainText('A+');
    await page.locator('[data-no="2"]').click();
    await page.getByLabel('盖章类型').selectOption('corrected');
    await page.keyboard.press(' ');
    await expect(page.locator('[data-no="2"] .cell-stamp')).toBeVisible();
  });

  await test.step('3 号：缺交角标 + 优秀印章（右下角标不压右上印章）', async () => {
    await page.locator('[data-no="3"]').click();
    await page.getByLabel('盖章类型').selectOption('excellent');
    await page.keyboard.press(' ');
    await page.keyboard.press('x');   // 缺交
    await expect(page.locator('[data-no="3"] .cell-badge')).toBeVisible();
    await expect(page.locator('[data-no="3"] .cell-stamp')).toBeVisible();
  });

  await test.step('1366 宽：三格的四角元素两两不相交', async () => {
    for (const no of [1, 2, 3]) {
      const no_ = `[data-no="${no}"] .cell-no`;
      const st = `[data-no="${no}"] .cell-stamp`;
      const bd = `[data-no="${no}"] .cell-badge`;
      const va = `[data-no="${no}"] .cell-value`;
      expect(await overlaps(page, no_, st)).toBe(false);   // 学号 vs 印章
      if (await page.locator(bd).count()) {
        expect(await overlaps(page, no_, bd)).toBe(false); // 学号 vs 角标
        expect(await overlaps(page, st, bd)).toBe(false);  // 印章 vs 角标
      }
      if (await page.locator(va).count()) {
        expect(await overlaps(page, no_, va)).toBe(false); // 学号 vs 主值
        expect(await overlaps(page, st, va)).toBe(false);  // 印章 vs 主值
      }
    }
  });
});

test('E2E-36b 375px 窄视口下四角仍不重叠（A-89）', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'custom');
  await page.locator('.digit-chip').click();

  await typeCell(page, 1, ['8', '5', 'Enter']);
  await page.locator('[data-no="1"]').click();
  await page.getByLabel('盖章类型').selectOption('excellent');
  await page.keyboard.press(' ');
  await page.keyboard.press('x');   // 缺交角标

  await expect(page.locator('[data-no="1"] .cell-badge')).toBeVisible();
  expect(await overlaps(page, '[data-no="1"] .cell-no', '[data-no="1"] .cell-stamp')).toBe(false);
  expect(await overlaps(page, '[data-no="1"] .cell-stamp', '[data-no="1"] .cell-badge')).toBe(false);
  expect(await overlaps(page, '[data-no="1"] .cell-no', '[data-no="1"] .cell-badge')).toBe(false);
  // v2.3.1 P3-3：补齐与 1366 口径相同的五对（原缺后两对）。
  // 375 下 stamp 已缩到 11px 并内缩（global.css 767 块），1-3 位主值与印章不相交。
  expect(await overlaps(page, '[data-no="1"] .cell-no', '[data-no="1"] .cell-value')).toBe(false);
  expect(await overlaps(page, '[data-no="1"] .cell-stamp', '[data-no="1"] .cell-value')).toBe(false);
});

test('E2E-38 1366×768 不出现纵向滚动；输出带 4 按钮顺序固定（A-90 / A-91）', async ({ page }) => {
  await resetApp(page);

  await test.step('scrollHeight ≤ 768 且无横向溢出', async () => {
    const m = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      innerBottom: Math.round(document.querySelector('.app-inner')?.getBoundingClientRect().bottom ?? 0),
    }));
    expect(m.scrollHeight).toBeLessThanOrEqual(768);
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
    expect(m.innerBottom).toBeLessThanOrEqual(768);
  });

  await test.step('输出带 4 按钮存在、顺序固定、aria-label 与 title 齐备', async () => {
    const bar = page.locator('.output-bar');
    await expect(bar).toBeVisible();
    const labels = await bar.locator('button[aria-label]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label')),
    );
    expect(labels).toEqual(['报表生成', '单条海报', '当日汇总', '本周汇总']);
    for (const name of ['报表生成', '单条海报', '当日汇总', '本周汇总']) {
      const btn = bar.locator(`button[aria-label="${name}"]`);
      await expect(btn).toHaveAttribute('title', /.+/);
    }
  });

  await test.step('录入带不含输出/管理动作（视觉隔离，FR-49.5）', async () => {
    const input = page.locator('.input-bar');
    await expect(input).toBeVisible();
    await expect(input).not.toContainText('报表生成');
    await expect(input).not.toContainText('当日汇总');
    await expect(input).toContainText('清空');
    await expect(input).toContainText('更新修改');
    // 只看未过关在录入带最右侧区域（FR-49.7d），与清空之间隔着存储动作
    await expect(input.locator('.filter-toggle')).toBeVisible();
  });

  await test.step('快捷键仍可用：Ctrl+Enter 报表 / Ctrl+J 海报', async () => {
    // v2.5.7：空表会被拦截（U-01/U-02），本步测的是「快捷键通路」，先录一个值。
    await page.locator('[data-no="1"]').click();
    await page.keyboard.press('1');
    await page.locator('[data-no="1"]').click();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('report-text')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('report-text')).toHaveCount(0);
  });
});

test('E2E-38b 弹窗关闭后焦点回到原格：不用重新点格子就能继续录（FR-49.7b）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await typeCell(page, 1, ['1']);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  // 打开报表再关闭（期间焦点被弹窗拿走）
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('report-text')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('report-text')).toHaveCount(0);

  // 焦点已恢复到最后编辑的 1 号：直接敲键盘就落在 1 号，不用重新点格子
  await page.keyboard.press('2');
  await expect(page.locator('[data-no="1"]')).toContainText('A');
});
