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
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '学情登记分析系统',
        short_name: '学情登记',
        description: '作业/测验成绩极速登记 + 一键出图出文案',
        theme_color: '#FF6FA5',
        background_color: '#FDEBF3',
        display: 'standalone',
        start_url: './',
        scope: './',
        lang: 'zh-CN',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
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
