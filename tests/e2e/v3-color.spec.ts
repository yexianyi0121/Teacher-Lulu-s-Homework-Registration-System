import { expect, test } from '@playwright/test';
import { cellStyle, closeJump, pickTemplate, resetApp, typeCell } from './v3-fixtures';

/**
 * E2E-30 两套色系分开（L-6 / 设计 06 §4.2）
 *   - 等级格子：八档 GRADE_TONE（v2.5.9 新增 B-），颜色由 data-grade 决定；
 *   - 分数格子：四档百分比色，颜色由 data-tone 决定。
 * 断言用 getComputedStyle 取真实渲染值，不看 class 名。
 */
test('E2E-30 等级八档：每档背景/文字/边框都不相同（同 tone 也不同色）', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'homework'); // 等级制（默认 6 档）

  // 打开 B+，凑齐八档（键位随之变成 1..8 = A+..D；B- 已在默认开启）
  await page.getByRole('button', { name: /本表设置/ }).click();
  const dlg = page.getByRole('dialog', { name: '本表评分方案' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'B+', exact: true }).click();
  await dlg.getByRole('button', { name: '完成' }).click();

  for (let i = 1; i <= 8; i++) await typeCell(page, i, [String(i)]);

  const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'];
  const bgs: string[] = [];
  const fgs: string[] = [];
  const borders: string[] = [];

  for (let i = 0; i < grades.length; i++) {
    const cell = page.locator(`[data-no="${i + 1}"]`);
    await expect(cell).toHaveAttribute('data-kind', 'grade');
    await expect(cell).toHaveAttribute('data-grade', grades[i]);
    const st = await cellStyle(page, i + 1);
    bgs.push(st.bg);
    fgs.push(st.color);
    borders.push(st.border);
  }

  expect(new Set(bgs).size).toBe(8);      // 八档背景互不相同
  expect(new Set(fgs).size).toBe(8);      // 文字色也互不相同
  expect(borders[0].startsWith('solid')).toBe(true);
  expect(borders[4].startsWith('dashed')).toBe(true);
  expect(borders[5].startsWith('dashed')).toBe(true); // B-（v2.5.9）
  expect(borders[7].startsWith('dotted')).toBe(true); // D（v2.5.9：八档后 D 的 index 从 6 → 7）

  // 逐档写死 HEX 对应的 rgb（GRADE_TONE 是 CSS 的唯一来源，改色必须改这里）
  expect(bgs).toEqual([
    'rgb(232, 245, 236)', // A+ #E8F5EC
    'rgb(237, 248, 241)', // A  #EDF8F1
    'rgb(243, 250, 234)', // A- #F3FAEA
    'rgb(254, 249, 228)', // B+ #FEF9E4
    'rgb(253, 242, 227)', // B  #FDF2E3
    'rgb(247, 234, 225)', // B- #F7EAE1（v2.5.9）
    'rgb(253, 237, 230)', // C  #FDEDE6
    'rgb(252, 232, 230)', // D  #FCE8E6
  ]);

  // 关键：A+ 与 A 的四档 tone 同为 green，但等级色必须不同（等级色不能退化成四档色）
  await expect(page.locator('[data-no="1"]')).toHaveAttribute('data-tone', 'green');
  await expect(page.locator('[data-no="2"]')).toHaveAttribute('data-tone', 'green');
  expect(bgs[0]).not.toBe(bgs[1]);
});

test('E2E-30 分数四档：绿/蓝/琥珀/红，背景互不相同且与等级色分开', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'quality'); // 分数制

  const plan: Array<[number, string[], string]> = [
    [1, ['9', '5', 'Enter'], 'green'],
    [2, ['8', '5', 'Enter'], 'blue'],
    [3, ['7', '0', 'Enter'], 'amber'],
    [4, ['5', '0', 'Enter'], 'red'],
  ];
  const bgs: string[] = [];
  for (const [no, keys, tone] of plan) {
    await typeCell(page, no, keys);
    const cell = page.locator(`[data-no="${no}"]`);
    await expect(cell).toHaveAttribute('data-kind', 'score');
    await expect(cell).toHaveAttribute('data-tone', tone);
    await expect(cell).not.toHaveAttribute('data-grade', 'A');
    bgs.push((await cellStyle(page, no)).bg);
  }
  // 分数四档走 data-tone 的四档百分比色（V2 旧语义保留）
  expect(bgs).toEqual([
    'rgb(237, 247, 228)', // --green-bg #EDF7E4
    'rgb(233, 241, 251)', // --blue-bg  #E9F1FB
    'rgb(253, 247, 227)', // --amber-bg #FDF7E3
    'rgb(253, 236, 234)', // --red-bg   #FDECEA
  ]);

  // 等级格子拿的是 GRADE_TONE 八档色，与四档百分比色完全分开（L-6）
  await pickTemplate(page, 'homework');
  await typeCell(page, 10, ['2']); // A
  const cell = page.locator('[data-no="10"]');
  await expect(cell).toHaveAttribute('data-grade', 'A');
  const gradeSt = await cellStyle(page, 10);
  expect(gradeSt.bg).toBe('rgb(237, 248, 241)'); // GRADE_TONE.A = #EDF8F1
  for (const bg of bgs) expect(gradeSt.bg).not.toBe(bg);
});
