// 视觉走查脚本：生成校样截图（不属于 CI 门禁）
// 用法：node scripts/screenshot.mjs（需先 pnpm build 并启动 vite preview）
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'test-results/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.goto('http://127.0.0.1:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.cell');

// 01 常规作业：样例 B 的等级
await page.getByLabel('秒跳开关').click();
await page.getByLabel('作业内容').fill('语文本');
await page.getByLabel('作业内容').blur();
const bPlus = [1, 2, 5, 6, 9, 10, 12, 14, 22, 24, 28, 32, 33, 34, 36, 37, 40, 41, 44, 49, 50];
const bMinus = [3, 4, 8, 11, 13, 15, 16, 18, 19, 20, 21, 25, 27, 29, 30, 31, 35, 38, 42, 43, 45, 46, 47, 48];
for (const no of bPlus) {
  await page.locator(`[data-no="${no}"]`).click();
  await page.keyboard.press('1');
}
for (const no of [7, 23, 26, 39]) {
  await page.locator(`[data-no="${no}"]`).click();
  await page.keyboard.press('2');
}
for (const no of bMinus) {
  await page.locator(`[data-no="${no}"]`).click();
  await page.keyboard.press('3');
}
await page.locator('[data-no="17"]').click();
await page.keyboard.press('x');
await page.screenshot({ path: `${OUT}/01-homework.png` });

const height = await page.evaluate(() => ({
  scroll: document.body.scrollHeight,
  client: document.documentElement.clientHeight,
}));
console.log('homework scrollHeight', height.scroll, 'viewport', height.client);

// 02 质量监测：样例 A 的分数 + 统计条
await page.getByLabel('登记类型').selectOption('quality');
await page.getByLabel('秒跳开关').click(); // 重新打开秒跳，逐格录入
await page.getByLabel('日期').fill('2026-03-13');
await page.getByLabel('作业内容').fill('第3单元');
await page.getByLabel('作业内容').blur();
const scores = [98, 95, 94, 89, 92, 91, 95, 98, 98, 94, 92, 90.5, 94, 88, 72, 94, 43, 88, 73, 75];
await page.locator('[data-no="1"]').click();
for (const s of scores) {
  for (const ch of String(s)) await page.keyboard.press(ch);
  await page.keyboard.press('Enter');
}
await page.screenshot({ path: `${OUT}/02-quality.png` });

// 03 报表
await page.getByRole('button', { name: /报表生成/ }).click();
await page.screenshot({ path: `${OUT}/03-report.png` });
await page.getByRole('dialog').getByRole('button', { name: '关闭' }).last().click();

// 04 当日汇总
await page.getByRole('button', { name: /当日汇总/ }).click();
await page.waitForSelector('img[alt="当日汇总预览"]', { timeout: 30000 });
await page.screenshot({ path: `${OUT}/04-summary.png` });
const src = await page.locator('img[alt="当日汇总预览"]').getAttribute('src');
if (src) {
  const b64 = await page.locator('img[alt="当日汇总预览"]').evaluate((img) =>
    fetch(img.getAttribute('src')).then((r) => r.blob()).then(
      (b) => new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1]);
        fr.readAsDataURL(b);
      }),
    ),
  );
  if (b64) writeFileSync(`${OUT}/05-summary.png`, Buffer.from(b64, 'base64'));
}
await browser.close();
console.log('done');
