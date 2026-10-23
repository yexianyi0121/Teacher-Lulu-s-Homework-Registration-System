import { expect, test } from '@playwright/test';

test('flow-voice：注入假识别结果「十二号优秀」落到 12 号并给出回显（AC-58）', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      static instance: unknown = null;
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: null | (() => void) = null;
      onend: null | (() => void) = null;
      onerror: null | ((ev: { error: string }) => void) = null;
      onresult: null | ((ev: unknown) => void) = null;
      constructor() {
        (FakeRecognition as unknown as { instance: unknown }).instance = this;
      }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByRole('button', { name: /语音/ }).click();
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    const rec = (window as unknown as {
      SpeechRecognition: { instance: { onresult: (ev: unknown) => void } };
    }).SpeechRecognition.instance;
    rec.onresult({
      results: {
        0: Object.assign([{ transcript: '十二号优秀', confidence: 0.95 }], { isFinal: true, length: 1 }),
        length: 1,
      },
    });
  });

  await expect(page.locator('.voice-banner')).toContainText('12号');
  await expect(page.locator('[data-no="12"]')).toContainText('A+');
});

test('flow-voice：低置信度/超出范围的学号只提示，不写入（AC-30.4）', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      static instance: unknown = null;
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: null | (() => void) = null;
      onend: null | (() => void) = null;
      onerror: null | ((ev: { error: string }) => void) = null;
      onresult: null | ((ev: unknown) => void) = null;
      constructor() {
        (FakeRecognition as unknown as { instance: unknown }).instance = this;
      }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.cell');

  await page.getByRole('button', { name: /语音/ }).click();
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    const rec = (window as unknown as {
      SpeechRecognition: { instance: { onresult: (ev: unknown) => void } };
    }).SpeechRecognition.instance;
    rec.onresult({
      results: {
        0: Object.assign([{ transcript: '九十九号优秀', confidence: 0.9 }], { isFinal: true, length: 1 }),
        length: 1,
      },
    });
  });

  await expect(page.locator('.voice-banner')).toContainText('超出学号范围');
  await expect(page.locator('[data-no="12"]')).not.toContainText('A+');
});
