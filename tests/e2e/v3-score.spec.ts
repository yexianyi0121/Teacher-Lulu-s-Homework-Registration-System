import { expect, test } from '@playwright/test';
import { closeJump, pickTemplate, resetApp } from './v3-fixtures';

/**
 * E2E-28 分数非法整条拒绝（FR-39 / AC-39.1）
 * 键盘与粘贴都必须：非法 → 不写入任何值 + 红框提示；合法 → 正常写入并按档位上色。
 */
test('E2E-28 分数非法：120 / -5 / 粘贴脏数据都整条拒绝，合法值照常写入', async ({ page }) => {
  await resetApp(page);
  await closeJump(page);
  await pickTemplate(page, 'quality'); // 质量监测：分数制，满分 100，一位小数

  const cell = (no: number) => page.locator(`[data-no="${no}"]`);
  const paste = async (text: string) => {
    await page.evaluate((t) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', t);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, text);
  };

  await test.step('键盘输 120 → 缓冲显示但提交被拒', async () => {
    await cell(1).click();
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.keyboard.press('0');
    await expect(cell(1)).toContainText('120');
    await page.keyboard.press('Enter');
    await expect(cell(1)).toHaveAttribute('data-error', '1');
    await expect(page.locator('.toast')).toContainText('本表满分 100 分');
    await expect(cell(1)).not.toHaveAttribute('data-kind', 'score');
    await expect(cell(1)).toHaveText(/^1$/); // 只剩学号，没写进任何值
  });

  await test.step('键盘输 -5 → 负号可进缓冲，但提交整条拒绝', async () => {
    await cell(2).click();
    await page.keyboard.press('-');
    await page.keyboard.press('5');
    await page.keyboard.press('Enter');
    await expect(cell(2)).toHaveAttribute('data-error', '1');
    await expect(page.locator('.toast')).toContainText('分数不能为负');
    await expect(cell(2)).not.toHaveAttribute('data-kind', 'score');
  });

  await test.step('粘贴 120 → 拒绝；粘贴中文 → 拒绝', async () => {
    await cell(3).click();
    await paste('120');
    await expect(page.locator('.toast')).toContainText('本表满分 100 分');
    await expect(cell(3)).toHaveAttribute('data-error', '1');
    await expect(cell(3)).not.toHaveAttribute('data-kind', 'score');

    await cell(4).click();
    await paste('八十五');
    await expect(page.locator('.toast')).toContainText('只能输入 0–100 的数字');
    await expect(cell(4)).not.toHaveAttribute('data-kind', 'score');
  });

  await test.step('小数位超限 → 拒绝', async () => {
    await cell(5).click();
    await paste('85.55');
    await expect(page.locator('.toast')).toContainText('小数位超出本表设置');
    await expect(cell(5)).not.toHaveAttribute('data-kind', 'score');
  });

  await test.step('合法值：95 绿 / 85 蓝 / 70 琥珀 / 50 红', async () => {
    const cases: Array<[number, string[], string]> = [
      [6, ['9', '5', 'Enter'], 'green'],
      [7, ['8', '5', 'Enter'], 'blue'],
      [8, ['7', '0', 'Enter'], 'amber'],
      [9, ['5', '0', 'Enter'], 'red'],
    ];
    for (const [no, keys, tone] of cases) {
      await cell(no).click();
      for (const k of keys) await page.keyboard.press(k);
      await expect(cell(no)).toHaveAttribute('data-kind', 'score');
      await expect(cell(no)).toHaveAttribute('data-tone', tone);
    }
    await expect(cell(7)).toContainText('85');
  });

  await test.step('粘贴合法小数 → 正常写入', async () => {
    await cell(10).click();
    await paste('85.5');
    await expect(cell(10)).toHaveAttribute('data-kind', 'score');
    await expect(cell(10)).toContainText('85.5');
  });
});
