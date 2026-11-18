import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** E2E-23 需要「关闭浏览器 → 用同一 userDataDir 重开」 */
export const BASE = 'http://127.0.0.1:4173/';
const channel = (process.env.PW_CHANNEL ?? 'msedge') as 'msedge' | 'chrome' | 'chromium';

export interface Profile {
  ctx: BrowserContext;
  page: Page;
  dir: string;
}

export async function launchFreshProfile(): Promise<Profile> {
  const dir = mkdtempSync(join(tmpdir(), 'xq-e2e-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    channel,
    viewport: { width: 1366, height: 768 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(BASE);
  await page.waitForSelector('.cell, .empty-cta');
  await ensureSheet(page);
  return { ctx, page, dir };
}

export async function reopenProfile(dir: string): Promise<Omit<Profile, 'dir'>> {
  const ctx = await chromium.launchPersistentContext(dir, {
    channel,
    viewport: { width: 1366, height: 768 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(BASE);
  await page.waitForSelector('.cell, .empty-cta');
  await ensureSheet(page);
  return { ctx, page };
}

export async function closeProfile(p: Profile): Promise<void> {
  await p.ctx.close().catch(() => undefined);
  rmSync(p.dir, { recursive: true, force: true });
}

/* ---------------- 常用交互（V3 用例共用） ---------------- */

/** 清空本地数据并回到默认空态 */
export async function resetApp(page: Page): Promise<void> {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell, .empty-cta');
  await ensureSheet(page);
}

export async function pickTemplate(page: Page, id: 'dictation' | 'homework' | 'quality' | 'custom'): Promise<void> {
  await page.getByLabel('登记类型').selectOption(id);
  // 有未保存录入时会先弹「先点【更新修改】再离开？」——确认继续切换
  const btn = page.getByRole('button', { name: '仍要切换类型' });
  await Promise.race([btn.waitFor({ state: 'visible' }), page.waitForTimeout(300)]).catch(() => undefined);
  if (await btn.isVisible().catch(() => false)) await btn.click();
  await ensureSheet(page);
}

/** v2.7.0：新建登记改为弹窗流程——点按钮 → 输入名称 → 创建 */
export async function createSheet(page: Page, name = '默写'): Promise<void> {
  await page.getByLabel('新建登记').first().click();
  const input = page.getByLabel('登记表名称');
  // 当前表有未保存录入时，会先弹「先点【更新修改】再离开？」——选择仍然新建
  const confirmBtn = page.getByRole('button', { name: '仍要新建登记' });
  await Promise.race([
    input.waitFor({ state: 'visible' }),
    confirmBtn.waitFor({ state: 'visible' }),
  ]);
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await input.waitFor({ state: 'visible' });
  }
  await input.fill(name);
  await page.getByRole('button', { name: '创建登记表' }).click();
  // 同名表已存在时弹窗会停在「当天已有同名登记表」——视为已建好，取消即可
  const dup = page.locator('.field-error');
  const r = await Promise.race([
    input.waitFor({ state: 'detached' }).then(() => 'closed'),
    dup.waitFor({ state: 'visible' }).then(() => 'dup'),
  ]).catch(() => 'closed');
  if (r === 'dup') {
    await page.getByRole('button', { name: '取消' }).click();
    await input.waitFor({ state: 'detached' });
  }
}

/** 切换当天已有的登记表（若被「更新修改」提醒拦住就确认继续） */
export async function selectSheet(page: Page, label: string): Promise<void> {
  await page.getByLabel('选择登记表').selectOption({ label });
  const btn = page.getByRole('button', { name: '仍要切换登记表' });
  await Promise.race([btn.waitFor({ state: 'visible' }), page.waitForTimeout(400)]).catch(() => undefined);
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

/** 当前没有登记表时，先建一张「默写」 */
export async function ensureSheet(page: Page): Promise<void> {
  const box = page.getByLabel('作业内容');
  if ((await box.inputValue()).trim()) return;
  await createSheet(page, '默写');
}

/** 关掉秒跳，便于逐格断言 */
export async function closeJump(page: Page): Promise<void> {
  const toggle = page.getByLabel('秒跳开关');
  if ((await toggle.getAttribute('aria-checked')) !== 'false') await toggle.click();
}

/** 在某一格按键（先点格子，再依次按键） */
export async function typeCell(page: Page, no: number, keys: string[]): Promise<void> {
  await ensureSheet(page);
  await page.locator(`[data-no="${no}"]`).click();
  for (const k of keys) await page.keyboard.press(k);
}

export async function setDate(page: Page, iso: string): Promise<void> {
  const box = page.getByLabel('日期');
  await box.fill(iso);
  await box.blur();
  const btn = page.getByRole('button', { name: '仍要切换日期' });
  await Promise.race([btn.waitFor({ state: 'visible' }), page.waitForTimeout(300)]).catch(() => undefined);
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

/** 等海报预览图生成完成（src 为 blob，alt 与目标一致） */
export async function waitPoster(page: Page, alt: string): Promise<void> {
  await expect(page.locator('.poster-preview')).toHaveAttribute('alt', alt, { timeout: 20_000 });
  await expect(page.locator('.poster-preview')).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
}

/** 关掉当前弹窗：优先底部「关闭」，否则用右上角 ✕（避免和 icon-btn 的 aria-label 撞名） */
export async function closeModal(page: Page): Promise<void> {
  const foot = page.locator('.modal-foot').getByRole('button', { name: '关闭', exact: true });
  if (await foot.count()) await foot.click();
  else await page.locator('.modal-head .icon-btn').click();
  await expect(page.locator('.modal')).toHaveCount(0);
}

/** 读取单元格计算样式里的颜色/边框，供颜色断言使用 */
export async function cellStyle(page: Page, no: number): Promise<{ bg: string; color: string; border: string }> {
  const el = page.locator(`[data-no="${no}"]`);
  // .cell 有 background .12s 过渡，直接读会拿到半途色：先关掉过渡并等一帧再读 F-1 的最终色
  await el.evaluate((node) => {
    (node as HTMLElement).style.transition = 'none';
  });
  await page.waitForTimeout(150);
  const out = await el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const snapshot = { bg: cs.backgroundColor, color: cs.color, border: `${cs.borderTopStyle} ${cs.borderTopColor}` };
    (node as HTMLElement).style.transition = '';
    return snapshot;
  });
  return out;
}

/**
 * 抓「生成中」那段短暂挂载的 poster DOM 文本。
 * 海报节点只在校验/栅格化期间存在，用 MutationObserver 在插入的同一微任务里快照，
 * 避免轮询抢时间（这是断言海报文案最稳的办法）。
 */
export async function capturePosterText(page: Page, trigger: () => Promise<void>): Promise<string> {
  await page.evaluate(() => {
    const w = window as unknown as { __xqPosterTexts: string[] };
    w.__xqPosterTexts = [];
    const snap = () => {
      const text = document.querySelector('.poster-root')?.textContent?.trim();
      if (text) w.__xqPosterTexts.push(text);
    };
    snap(); // 节点可能已经在了
    const obs = new MutationObserver(snap);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await trigger();
  return page.evaluate(() => {
    const list = (window as unknown as { __xqPosterTexts: string[] }).__xqPosterTexts;
    return list.length ? list[list.length - 1] : '';
  });
}

