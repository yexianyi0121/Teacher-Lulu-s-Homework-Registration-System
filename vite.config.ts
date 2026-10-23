import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 设计 §15.1 / §17.4：base 必须为 './'，否则 dist/index.html 无法双击打开
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 不自动注入 registerSW 脚本：app 用 file:// 双击打开时无法注册 SW，
      // 由 main.tsx 只在 http(s) 下按需注册，避免控制台报错。
      injectRegister: null,
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon.svg'],
      // manifest 完全交给 public/manifest.webmanifest（V3 FR-45）：
      // 否则插件会用 package.json 的英文名再生成一份，把中文名覆盖掉。
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: true,
  },
});
