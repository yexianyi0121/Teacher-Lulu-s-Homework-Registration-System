import { expect, test } from '@playwright/test';
import { resetApp, waitPoster } from './v3-fixtures';

/**
 * E2E-41（v2.3.1 用户意见 1 / 4）：
 * ① 海报大标题「XX班级 语文作业反馈」为近黑，不再跟随品牌色（默认粉）；
 * ② 评价语比页脚学校名更深——两者原本同为 --text-3 浅灰，用户反馈分不清。
 *
 * 取证方式：海报弹窗的可见预览是栅格化后的 <img>，Poster DOM（.poster-title /
 * .poster-comment）只在栅格化期间短暂存在、用完即卸载——与 E2E-37b 同款，
 * 用 MutationObserver 在插入的同一微任务里记录 computed style。
 * 亮度口径：lum < 0.05 视为近黑；品牌粉 #FF6FA5 的 lum ≈ 0.35，不会误判。
 */
test('E2E-41 海报标题近黑 + 评价语深于页脚（用户意见 1/4）', async ({ page }) => {
  await resetApp(page);
  await page.locator('[data-no="1"]').click();
  await page.keyboard.press('1');
  await expect(page.locator('[data-no="1"]')).toContainText('A+');

  // 打开弹窗前先布好 observer：记录每次海报 DOM 插入时的样式快照
  await page.evaluate(() => {
    const w = window as unknown as {
      __posterStyle: Array<{ title?: string; comment?: string; commentWeight?: string; school?: string }>;
    };
    w.__posterStyle = [];
    const grab = () => {
      const title = document.querySelector('.poster-title') as HTMLElement | null;
      if (!title) return;
      const comment = document.querySelector('.poster-comment') as HTMLElement | null;
      const school = document.querySelector('.poster-school') as HTMLElement | null;
      w.__posterStyle.push({
        title: getComputedStyle(title).color,
        comment: comment ? getComputedStyle(comment).color : undefined,
        commentWeight: comment ? getComputedStyle(comment).fontWeight : undefined,
        school: school ? getComputedStyle(school).color : undefined,
      });
    };
    grab();
    new MutationObserver(grab).observe(document.body, { childList: true, subtree: true });
  });

  await page.locator('.output-bar').getByRole('button', { name: '单条海报' }).click();
  await waitPoster(page, '学情海报预览');

  // 填一句评价语并失焦 → 触发重新生成（第二次栅格化，这次带 comment）
  await page.locator('#poster-comment').fill('今天完成得都很认真，继续保持');
  await page.locator('#poster-comment').evaluate((el) => (el as HTMLElement).blur());
  await page.waitForTimeout(800);

  const snaps = await page.evaluate(
    () =>
      (window as unknown as {
        __posterStyle: Array<{ title?: string; comment?: string; commentWeight?: string; school?: string }>;
      }).__posterStyle,
  );
  const withComment = snaps.filter((s) => s.comment);
  expect(withComment.length, '重新生成后应拿到带评价语的海报样式快照').toBeGreaterThan(0);
  const s = withComment[withComment.length - 1];

  const lum = (rgb: string) => {
    const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  expect(s.title).not.toBe('rgb(255, 111, 165)');   // 不再是品牌粉
  expect(lum(s.title!)).toBeLessThan(0.05);         // 近黑
  expect(lum(s.comment!)).toBeLessThan(0.1);        // 评价语深色（非浅灰）
  expect(Number(s.commentWeight)).toBeGreaterThanOrEqual(600);   // 且加粗，与页脚拉开层次
  if (s.school) {
    expect(lum(s.comment!)).toBeLessThan(lum(s.school) - 0.1);   // 明显深于学校名
  }
});
