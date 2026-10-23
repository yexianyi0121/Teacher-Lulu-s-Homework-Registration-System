// 视觉走查脚本：生成校样截图（不属于 CI 门禁）
// 用法：node scripts/screenshot.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'test-results/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

await page.goto('http://127.0.0.1:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.grid');

// 常规作业：50 格
await page.screenshot({ path: `${OUT}/01-homework-empty.png` });

// 常规作业：样例 B
await page.locator('[data-no="1"]').click();
for (let i = 1; i <= 16; i++) await page.keyboard.press('1');
await page.keyboard.press('4');
for (let i = 18; i <= 50; i++) await page.keyboard.press('3');
await page.locator('[data-no="3"]').click();
await page.keyboard.press(' ');
await page.locator('[data-no="17"]').click();
await page.screenshot({ path: `${OUT}/02-homework-filled.png` });

const height = await page.evaluate(() => ({
  scroll: document.body.scrollHeight,
  client: document.documentElement.clientHeight,
}));
console.log('scrollHeight', height.scroll, 'viewport', height.client);

// 单元测试：统计条 + 图表
await page.getByLabel('录入模式').selectOption('quiz');
await page.getByLabel('日期').fill('2026-03-13');
await page.getByLabel('作业内容').fill('语文本');
await page.getByLabel('作业内容').blur();
await page.locator('[data-no="1"]').click();
const scores = [98, 95, 94, 89, 92, 91, 95, 98, 98, 94, 92, 90.5, 94, 88, 72, 94, 43, 88, 73, 75];
for (const s of scores) {
  for (const ch of String(s)) await page.keyboard.press(ch);
  await page.keyboard.press('Enter');
}
await page.screenshot({ path: `${OUT}/03-quiz-stats.png` });

// 报表
await page.getByRole('button', { name: /报表生成/ }).click();
await page.screenshot({ path: `${OUT}/04-report.png` });
await page.getByRole('dialog').getByRole('button', { name: '关闭' }).last().click();

// 海报
await page.getByRole('button', { name: /截图发群/ }).click();
await page.waitForSelector('img[alt="学情海报预览"]', { timeout: 20000 });
await page.screenshot({ path: `${OUT}/05-poster-modal.png` });
// 海报是 blob: URL，需在页面内转成 base64 才能落盘
const posterB64 = await page.locator('img[alt="学情海报预览"]').evaluate((img) => {
  return fetch(img.src)
    .then((r) => r.blob())
    .then(
      (b) =>
        new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result).split(',')[1]);
          fr.readAsDataURL(b);
        }),
    );
});
if (posterB64) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${OUT}/06-poster.png`, Buffer.from(posterB64, 'base64'));
}

console.log('done');
await browser.close();
