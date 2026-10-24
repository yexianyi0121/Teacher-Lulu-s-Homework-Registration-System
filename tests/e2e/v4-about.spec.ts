import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { resetApp } from './v3-fixtures';

/**
 * E2E-42（v2.4.0 / FR-52）：设置 → 关于 分区。
 * 断言四条信息真实渲染且链接 href 正确（版本号与 package.json 对拍），
 * 另验六套主题下链接对比度均 ≥4.5:1（FR-48.6 同款亮度公式）。
 */

/** WCAG 相对亮度（与 v4-poster-style.spec.ts 同算法） */
function relLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error(`无法解析颜色：${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

test('E2E-42 设置 → 关于：版本/作者/邮箱/GitHub 链接真实可点（FR-52）', async ({ page }) => {
  await resetApp(page);

  await page.getByRole('button', { name: /设置/ }).first().click();
  const dlg = page.getByRole('dialog');
  const about = dlg.locator('[data-section="about"]');
  await expect(about).toBeVisible();
  await expect(about.locator('.settings-title')).toHaveText('关于');

  // 版本号与 package.json 对拍（单一事实来源）
  const pkg = createRequire(import.meta.url)('../../package.json') as { version: string };
  await expect(about.getByTestId('about-version')).toHaveText(`v${pkg.version}`);

  // 系统名 / 作者 / 邮箱 / 仓库地址四行齐全
  await expect(about).toContainText('学情登记分析系统');
  await expect(about).toContainText('yexianyi0121');
  await expect(about).toContainText('xianyiye0121@163.com');
  await expect(about).toContainText('https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System');

  // 作者名与仓库地址都链到 GitHub（新窗口 + noopener），邮箱是 mailto
  const repoLinks = about.getByRole('link', { name: /github\.com|yexianyi0121/ });
  await expect(repoLinks).toHaveCount(2);
  for (const link of await repoLinks.all()) {
    await expect(link).toHaveAttribute('href', 'https://github.com/yexianyi0121/Teacher-Lulu-s-Homework-Registration-System');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
  const mail = about.getByRole('link', { name: 'xianyiye0121@163.com' });
  await expect(mail).toHaveAttribute('href', 'mailto:xianyiye0121@163.com');

  await page.locator('.modal-foot').getByRole('button', { name: '完成' }).click();
  await expect(page.locator('.modal')).toHaveCount(0);
});

test('E2E-42b 关于链接在六套主题下对比度均 ≥4.5:1（FR-48.6）', async ({ page }) => {
  await resetApp(page);

  const themes = ['pink', 'mint', 'sky', 'sand', 'night', 'plain'] as const;
  const worst: Record<string, number> = {};

  for (const key of themes) {
    await test.step(`主题 ${key}`, async () => {
      await page.getByRole('button', { name: /设置/ }).first().click();
      const dlg = page.getByRole('dialog');
      await dlg.locator(`.theme-card[data-theme-key="${key}"]`).click();
      await page.locator('.modal-foot').getByRole('button', { name: '完成' }).click();
      await expect(page.locator('.modal')).toHaveCount(0);

      await page.getByRole('button', { name: /设置/ }).first().click();
      const about = page.getByRole('dialog').locator('[data-section="about"]');
      const colors = await about.locator('.about-value a').first().evaluate((el) => {
        const cs = getComputedStyle(el);
        // 链接自身没有背景，取设置弹窗（白底卡片）作为背景
        const modal = el.closest('.modal') as HTMLElement;
        return { fg: cs.color, bg: getComputedStyle(modal).backgroundColor };
      });
      const ratio = contrast(parseRgb(colors.fg), parseRgb(colors.bg));
      worst[key] = ratio;
      expect(ratio, `${key} 主题链接对比度 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      await page.locator('.modal-foot').getByRole('button', { name: '完成' }).click();
      await expect(page.locator('.modal')).toHaveCount(0);
    });
  }

  // 六套主题用的是同一条 --link（不随主题换），最差也应 ≥4.5
  expect(Math.min(...Object.values(worst))).toBeGreaterThanOrEqual(4.5);
});
