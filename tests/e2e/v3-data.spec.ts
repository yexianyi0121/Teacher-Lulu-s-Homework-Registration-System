import { expect, test } from '@playwright/test';
import { readFileSync, rmSync } from 'node:fs';
import { closeProfile, launchFreshProfile, reopenProfile, BASE } from './v3-fixtures';

/** 读取全部 localStorage 键（Storage 对象用 key(i) 枚举最稳） */
async function lsKeys(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k) out.push(k);
    }
    return out.sort();
  });
}

test('E2E-23 持久化往返：录入 3 格 + 改班级名 + 存历史 → 关浏览器重开全在', async () => {
  test.setTimeout(90_000);
  const p = await launchFreshProfile();
  const { page } = p;
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await test.step('真实 UI 录入 3 格', async () => {
    await page.getByLabel('秒跳开关').click(); // 关秒跳，手动点三格
    for (const no of [1, 2, 3]) {
      await page.locator(`[data-no="${no}"]`).click();
      await page.keyboard.press('2'); // 常规作业：A
    }
    for (const no of [1, 2, 3]) await expect(page.locator(`[data-no="${no}"]`)).toContainText('A');
  });

  await test.step('改班级名 + 强制保存', async () => {
    await page.getByTitle('设置').click();
    await page.locator('#set-class').fill('一年一班');
    await page.getByRole('dialog').getByRole('button', { name: '完成' }).click();
    await page.keyboard.press('Control+s');
    await expect(page.locator('[data-no="1"]')).toContainText('A');
    await page.waitForTimeout(800);
    expect(await lsKeys(page)).toContain('xq.state.v3');
  });

  await test.step('关闭浏览器 → 同 userDataDir 重开', async () => {
    await p.ctx.close();
    const reopened = await reopenProfile(p.dir);
    const page2 = reopened.page;
    try {
      await expect(page2.locator('[data-no="1"]')).toContainText('A');
      await expect(page2.locator('[data-no="2"]')).toContainText('A');
      await expect(page2.locator('[data-no="3"]')).toContainText('A');
      await expect(page2.getByLabel('切换班级')).toContainText('一年一班');
      await page2.getByTitle('设置').click();
      await expect(page2.getByRole('dialog')).toContainText('历史记录');
      await expect(page2.getByRole('dialog')).toContainText('1 条');
    } finally {
      await reopened.ctx.close().catch(() => undefined);
    }
  });

  rmSync(p.dir, { recursive: true, force: true });
  expect(errs).toEqual([]);
});

test('E2E-24 数据健康：面板数字真实，导出 JSON 可再导入', async () => {
  test.setTimeout(90_000);
  const p = await launchFreshProfile();
  const { page } = p;
  const file = 'test-results/e2e-backup.json';

  try {
    await test.step('录 2 格并保存', async () => {
      await page.getByLabel('秒跳开关').click();
      for (const no of [1, 2]) {
        await page.locator(`[data-no="${no}"]`).click();
        await page.keyboard.press('2');
      }
      await page.keyboard.press('Control+s');
      await expect(page.locator('[data-no="1"]')).toContainText('A');
      await page.waitForTimeout(600);
    });

    await test.step('健康面板数字与真实存储一致', async () => {
      await page.getByTitle('设置').click();
      const health = page.getByTestId('storage-health');
      await expect(health).toContainText('存储键：xq.state.v3');
      await expect(health).toContainText('记录 1 条');
      await expect(health).toContainText('历史 1 条');
      await expect(health).toContainText('打开方式：网址');
    });

    await test.step('导出全部数据', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /导出全部数据/ }).click(),
      ]);
      await download.saveAs(file);
      const json = JSON.parse(readFileSync(file, 'utf8'));
      expect(json.app).toBe('学情登记分析系统');
      expect(json.version).toBe(3);
      expect(json.state.records.length).toBe(1);
      expect(json.state.classes[0].name).toBe('三年二班');
    });

    await test.step('再录一格 → 用备份覆盖导入 → 第 3 格回到空', async () => {
      await page.getByRole('dialog').getByRole('button', { name: '完成' }).click();
      await page.locator('[data-no="3"]').click();
      await page.keyboard.press('2');
      await expect(page.locator('[data-no="3"]')).toContainText('A');
      await page.getByTitle('设置').click();
      await page.locator('input[type="file"][aria-label="选择备份文件"]').setInputFiles(file);
      await page.getByRole('button', { name: '覆盖导入' }).click();
      await expect(page.locator('[data-no="3"]')).not.toContainText('A');
      await expect(page.locator('[data-no="1"]')).toContainText('A');
    });
  } finally {
    await closeProfile(p);
  }
});

test('E2E-25 损坏自愈：主存写坏 → 从快照恢复并把坏数据另存', async () => {
  test.setTimeout(90_000);
  const p = await launchFreshProfile();
  const { page } = p;

  try {
    await test.step('录 1 格', async () => {
      await page.getByLabel('秒跳开关').click();
      await page.locator('[data-no="1"]').click();
      await page.keyboard.press('2');
      await expect(page.locator('[data-no="1"]')).toContainText('A');
      await page.waitForTimeout(600);
    });

    await test.step('造 IDB 快照', async () => {
      const ok = await page.evaluate(async () => {
        const raw = localStorage.getItem('xq.state.v3');
        if (!raw) return 'NO_STATE';
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('xq-backup', 2);
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('snapshots')) {
              req.result.createObjectStore('snapshots', { keyPath: 'id' });
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('snapshots', 'readwrite');
            tx.objectStore('snapshots').put({ id: 'e2e-1', at: Date.now(), payload: raw });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
        return 'OK';
      });
      expect(ok).toBe('OK');
    });

    // 关页会触发 pagehide flush（写回合法数据），所以必须在新页面「启动前」注入坏数据
    const page2 = await (async () => {
      await page.close();
      const np = await p.ctx.newPage();
      await np.addInitScript(() => {
        localStorage.setItem('xq.state.v3', '{broken json');
      });
      await np.goto(BASE);
      await np.waitForSelector('.cell');
      return np;
    })();

    await test.step('自动从快照恢复', async () => {
      await expect(page2.locator('[data-no="1"]')).toContainText('A');
      await expect(page2.getByText(/已从自动备份恢复/)).toBeVisible();
    });

    await test.step('坏数据另存 xq.corrupt.*，主存已写回合法 JSON', async () => {
      const keys = await lsKeys(page2);
      const corrupt = keys.filter((k) => k.startsWith('xq.corrupt.'));
      expect(corrupt.length).toBeGreaterThan(0);
      const raw = await page2.evaluate((k) => localStorage.getItem(k), corrupt[0]);
      expect(raw).toBe('{broken json');
      const main = await page2.evaluate(() => localStorage.getItem('xq.state.v3'));
      expect(main!.startsWith('{broken')).toBe(false);
      const parsed = JSON.parse(main!);
      expect(parsed.version).toBe(3);
      expect(parsed.records[0].entries['1'].value.grade).toBe('A');
    });
  } finally {
    await closeProfile(p);
  }
});
