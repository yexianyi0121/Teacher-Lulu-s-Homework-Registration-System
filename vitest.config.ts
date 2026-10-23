import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Windows 下多 worker 并发会争用同一临时缓存文件（EPERM），改用单进程串行执行
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['tests/setup.ts'],
    css: false,
  },
});
