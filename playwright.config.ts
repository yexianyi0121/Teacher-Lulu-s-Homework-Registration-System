import { defineConfig, devices } from '@playwright/test';

const channel = (process.env.PW_CHANNEL ?? 'msedge') as 'msedge' | 'chrome' | 'chromium';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel,
    viewport: { width: 1366, height: 768 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, channel },
    },
  ],
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
