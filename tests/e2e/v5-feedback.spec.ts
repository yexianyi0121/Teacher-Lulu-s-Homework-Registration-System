import { expect, test } from '@playwright/test';
import { capturePosterText, closeJump, closeModal, pickTemplate, resetApp, typeCell } from './v3-fixtures';

/**
 * FR-66.1 / FR-67.1 / FR-69.1（v2.5.10）：
 * 同一天同一类型的多张表要在主屏就能切换；汇总里每张表各写各的评价语；
 * 表情不再压在等级上，汇总格也显示表情；宽屏内容跟随视口而不是锁在 1440。
 */

/** 当日汇总弹窗里每张表的分节头（`.sheet-comment-name`） */
async function sheetCommentNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator('.sheet-comment-name').evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
}

test('FR-66.1 同类型多张表：主屏「选择登记表」可切换，切过去数据还在（A-143）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  // 第一张表：内容「默写」录 1 号
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();
  await typeCell(page, 1, ['1']);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  // 第二张表：内容「作文」录 2 号
  await page.getByLabel('作业内容').fill('作文');
  await page.getByLabel('新建登记').click();
  await typeCell(page, 2, ['2']);
  await expect(page.locator('[data-no="2"]')).toContainText('A');

  // 回到「默写」：1 号的 A+ 还在
  await page.getByLabel('选择登记表').selectOption({ label: '默写 · 1 人' });
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
  await expect(page.locator('[data-no="2"]')).not.toContainText('A');

  // 切到「作文」：2 号的 A 还在
  await page.getByLabel('选择登记表').selectOption({ label: '作文 · 1 人' });
  await expect(page.locator('[data-no="2"]')).toContainText('A');
  await expect(page.locator('[data-no="1"]')).not.toContainText('A+');
});

test('FR-66.1 只有一张表时不出现选择器（不添乱）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await expect(page.getByLabel('选择登记表')).toHaveCount(0);

  // 录一张之后仍然只有一张
  await typeCell(page, 1, ['1']);
  await expect(page.getByLabel('选择登记表')).toHaveCount(0);
});

test('FR-66.2 汇总里每张表各写各的评价语（A-144）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await page.getByLabel('作业内容').fill('默写');

  await page.getByLabel('新建登记').click();
  await typeCell(page, 1, ['1']);
  await page.getByLabel('作业内容').fill('作文');
  await page.getByLabel('新建登记').click();
  await typeCell(page, 2, ['2']);

  await page.locator('.output-bar button[aria-label="当日汇总"]').click();

  const names = await sheetCommentNames(page);
  expect(names.length).toBe(2);
  expect(names.join(' ')).toContain('默写');
  expect(names.join(' ')).toContain('作文');

  // 给「默写」写一条评价语
  const first = page.locator('.sheet-comment').filter({ has: page.locator('.sheet-comment-name', { hasText: '默写' }) });
  await first.locator('button.chip').click();
  const box = first.locator('textarea');
  await box.fill('默写全对的同学请继续保持。');
  await box.blur();

  // 评价语真的写到了记录上：重新打开还在（走的是 localStorage 往返）
  await closeModal(page);
  await page.locator('.output-bar button[aria-label="当日汇总"]').click();
  await expect(page.locator('.sheet-comment-text').filter({ hasText: '默写全对的同学请继续保持。' })).toHaveCount(1);

  // 汇总海报里这块评价语真的印出来了（海报节点只在校验/栅格化期间存在，用 MutationObserver 抓）
  const posterText = await capturePosterText(page, () => page.locator('.modal-foot button', { hasText: '重新生成' }).click());
  expect(posterText).toContain('默写全对的同学请继续保持。');
  await closeModal(page);

  // 单张海报（只含这张表）上也能看到这条评价语
  await page.getByLabel('选择登记表').selectOption({ label: '默写 · 1 人' });
  const singleText = await capturePosterText(page, () => page.locator('.output-bar button[aria-label="单条海报"]').click());
  expect(singleText).toContain('默写全对的同学请继续保持。');
});

test('FR-67.1 等级格的表情不再压住等级，汇总格也显示表情（A-145）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();

  // 开表情：⋯ 更多 → ⚙️ 设置 → 「等级旁显示表情」（默认开，这里显式确认）
  await page.locator('.input-bar button[aria-label="更多"]').click();
  await page.locator('.more-menu').getByText('设置').click();
  const emojiToggle = page.getByLabel('显示表情');
  if (!(await emojiToggle.isChecked())) await emojiToggle.check();
  await closeModal(page);

  await typeCell(page, 1, ['1']);   // A+ + 表情
  const cell = page.locator('[data-no="1"]');
  await expect(cell).toContainText('A+');

  const geo = await cell.evaluate((el) => {
    const value = el.querySelector('.cell-value') as HTMLElement;
    const emoji = el.querySelector('.cell-emoji') as HTMLElement | null;
    if (!value || !emoji) return null;
    const rv = value.getBoundingClientRect();
    const re = emoji.getBoundingClientRect();
    return { sameRow: Math.abs(rv.top - re.top) < 2, inside: re.bottom <= rv.bottom + 1, text: value.textContent };
  });
  expect(geo).not.toBeNull();
  // 表情单独一行（不再与主值同一行），且完整落在格子里
  expect(geo!.sameRow).toBe(false);
  expect(geo!.inside).toBe(true);

  // 汇总（mini）也显示表情，且不与主值重叠
  // 海报 mini 样式只存在于屏幕外的 .poster-stage（left:-20000px，生成完图就按印），
  // 而且它的生命周期很短（几百 ms），所以在点击同一次任务里端到端轮询。
  const btn = page.locator('.output-bar button[aria-label="当日汇总"]');
  const clicked = btn.click();
  const miniGeo = await page.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 60));
      const st = document.querySelector('.poster-stage');
      const el = st?.querySelector('.summary-grid .cell-emoji') as HTMLElement | null;
      if (el) {
        const cell = el.closest('.cell') as HTMLElement;
        const v = cell.querySelector('.cell-value') as HTMLElement;
        const rv = v.getBoundingClientRect();
        const re = el.getBoundingClientRect();
        return { count: (st as HTMLElement).querySelectorAll('.summary-grid .cell-emoji').length, sameRow: Math.abs(rv.top - re.top) < 2, inside: re.bottom <= rv.bottom + 1 };
      }
    }
    return null;
  });
  await clicked;
  expect(miniGeo).not.toBeNull();
  expect(miniGeo!.count).toBeGreaterThan(0);
  expect(miniGeo!.sameRow).toBe(false);
  expect(miniGeo!.inside).toBe(true);
});

test('FR-69.1 宽屏（1920）内容跟随视口展开，格子变大且无横向溢出（A-146）', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  const inner = page.locator('.app-inner');
  const width = await inner.evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(1600);   // 以前被 1440 锁死

  const cell = page.locator('[data-no="1"]');
  const box = await cell.boundingBox();
  expect(box!.height).toBeGreaterThan(80);   // --cell-h 104px 一档

  const doc = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
});

test('FR-68.1 提示条把启用等级的键位做成色块，B- 也能一眼看到（A-147）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  const hint = page.locator('.hint');
  await expect(hint).toBeVisible();

  // 默认常规作业为 7 档（A+..D 含 B-），每个等级一个色块
  const grades = await hint.locator('.hint-grade').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-grade')),
  );
  expect(grades).toEqual(['A+', 'A', 'A-', 'B', 'B-', 'C', 'D']);

  // 色块颜色与格子一致（B- 是琥珀色系）
  const bminus = hint.locator('.hint-grade[data-grade="B-"]');
  await expect(bminus).toBeVisible();
  const color = await bminus.evaluate((el) => getComputedStyle(el).borderColor);
  expect(color).not.toBe('rgba(0, 0, 0, 0)');

  // 长 ladder 不再被 ellipsis 切掉（提示条可以换行/长高）
  const clipped = await hint.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(clipped).toBe(false);
});

test('FR-71.1 作业内容随手打字不建表，点「新建登记」才建（A-148）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  // 第一张表：输入内容 + 新建登记，才有了一张真正的表
  await page.getByLabel('作业内容').fill('默写');
  await page.getByLabel('新建登记').click();
  await typeCell(page, 1, ['1']);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  // 在作业内容里随手打字：不点「新建登记」就不会多出任何表/选项
  await page.getByLabel('作业内容').fill('默写1');
  await page.getByLabel('作业内容').fill('默写12');
  await page.getByLabel('作业内容').fill('默写1');
  await expect(page.getByLabel('选择登记表')).toHaveCount(0);          // 仍只有一张表
  await expect(page.locator('[data-no="1"]')).toContainText('A+');     // 当前表没被切走

  // 点「新建登记」才真的多一张表，并且落到新表上（干净的空表）
  await page.getByLabel('新建登记').click();
  await expect(page.getByLabel('选择登记表')).toBeVisible();
  const opts = await page.getByLabel('选择登记表').locator('option').evaluateAll((os) => os.map((o) => (o.textContent ?? '').trim()));
  expect(opts.length).toBe(2);
  expect(opts).toContain('默写 · 1 人');
  expect(opts.some((o) => o.startsWith('默写1'))).toBe(true);

  // 回到真正录过的表，数据还在
  await page.getByLabel('选择登记表').selectOption({ label: '默写 · 1 人' });
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
});

test('FR-71.2 删除整张登记表：确认后从选择器与汇总里消失（A-149）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await page.getByLabel('作业内容').fill('默写');

  await page.getByLabel('新建登记').click();
  await typeCell(page, 1, ['1']);
  await page.getByLabel('作业内容').fill('作文');
  await page.getByLabel('新建登记').click();
  await typeCell(page, 2, ['2']);
  await expect(page.getByLabel('选择登记表')).toBeVisible();

  // 当前在「作文」这张表上：删掉它
  await page.getByRole('button', { name: '删除此表' }).click();
  const dlg = page.getByRole('dialog', { name: '删除登记表' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: '删除' }).click();

  // 删完回到剩下的那张表；只剩一张表时选择器自动收起（不添乱）
  await expect(page.getByLabel('作业内容')).toHaveValue('默写');
  await expect(page.getByLabel('选择登记表')).toHaveCount(0);
  await expect(page.locator('[data-no="1"]')).toContainText('A+');
  await expect(page.locator('[data-no="2"]')).not.toContainText('A');

  // 当日汇总里也只剩一张表
  await page.locator('.output-bar button[aria-label="当日汇总"]').click();
  const names = await sheetCommentNames(page);
  expect(names.length).toBe(1);
  expect(names[0]).toContain('默写');
  await closeModal(page);
});

test('FR-71.3 缺交 / 请假可选择是否算过关（A-150）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await typeCell(page, 1, ['1']);        // A+
  await page.locator('[data-no="2"]').click();
  await page.keyboard.press('l');
  await expect(page.locator('[data-no="2"]')).toContainText('假');

  // v2.6.3：过关规则搬到「本表设置」——默认请假不算过关
  await page.getByRole('button', { name: /本表设置/ }).click();
  const dlg = page.getByRole('dialog');
  const toggle = dlg.getByLabel('请假算过关');
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await dlg.getByRole('button', { name: '完成' }).click();

  // 请假格现在算过关（带✅）
  const cell = page.locator('[data-no="2"]');
  await expect(cell).toContainText('假');
  await expect(cell.locator('.cell-badge')).toBeVisible();
});

test('FR-71.4 汇总里每张表的评价语可以独立删除（A-151）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework');

  await page.getByLabel('作业内容').fill('默写');

  await page.getByLabel('新建登记').click();
  await typeCell(page, 1, ['1']);
  await page.getByLabel('作业内容').fill('作文');
  await page.getByLabel('新建登记').click();
  await typeCell(page, 2, ['2']);

  await page.locator('.output-bar button[aria-label="当日汇总"]').click();
  const first = page.locator('.sheet-comment').filter({ has: page.locator('.sheet-comment-name', { hasText: '默写' }) });
  await first.locator('button.chip').first().click();
  const box = first.locator('textarea');
  await box.fill('默写全对的同学请继续保持。');
  await box.blur();
  // 评价语已落到这条记录上（textarea 仍展开着，折叠后才显示文字版）
  await expect(box).toHaveValue('默写全对的同学请继续保持。');
  await page.waitForTimeout(300);
  await first.locator('button.chip').first().click();   // 折叠
  await expect(page.locator('.sheet-comment-text').filter({ hasText: '默写全对的同学请继续保持。' })).toHaveCount(1);

  // 删除这张表的评价语
  await page.locator('.sheet-comment').filter({ has: page.locator('.sheet-comment-name', { hasText: '默写' }) })
    .getByRole('button', { name: /删除 .* 的评价语/ }).click();
  await expect(page.locator('.sheet-comment-text').filter({ hasText: '默写全对的同学请继续保持。' })).toHaveCount(0);
  await closeModal(page);

  // 重新打开：真的没了（localStorage 往返）
  await page.locator('.output-bar button[aria-label="当日汇总"]').click();
  await expect(page.locator('.sheet-comment-text').filter({ hasText: '默写全对的同学请继续保持。' })).toHaveCount(0);
  await closeModal(page);
});
