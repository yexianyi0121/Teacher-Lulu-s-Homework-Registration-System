/**
 * 入口 App 化（v2.5.0 / FR-53）：dist 产物形态守护。
 *
 * 防的是「改名 / 镜像 / 启动器」链路被后续构建改坏——
 * 例如 inline-dist 调整后镜像丢失、误删启动器、
 * 或 manifest 的 start_url 漂回旧入口。dist 随仓库提交，
 * 这些断言在每次 vitest 跑时都真实校验交付物本身。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');

describe('app-entry：入口 App 化产物形态（FR-53）', () => {
  it('主入口是「学情登记系统.html」：内联单文件 + 标题 + favicon + iOS 全屏 meta', () => {
    const html = readFileSync(resolve(DIST, '学情登记系统.html'), 'utf8');
    // 内联单文件（file:// 双击不被 CORS 拦的核心）
    expect(html).toContain('<script type="module">');
    // 品牌与图标链
    expect(html).toContain('<title>刘露老师的学情登记本</title>');
    expect(html).toContain('href="./favicon.svg"');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-title');
    // 不残留外链 script src（内联化的判据）
    expect(html).not.toMatch(/<script[^>]+src="\.\/assets\//);
  });

  it('index.html 是完整应用镜像（与中文入口逐字节相同）', () => {
    // 镜像而非跳转页：0 秒 meta-refresh 会摧毁 goto('/') 后的执行上下文，
    // 且 SW navigateFallback 返回跳转页会无限循环（v2.5.0 开发实录）。
    const index = readFileSync(resolve(DIST, 'index.html'));
    const app = readFileSync(resolve(DIST, '学情登记系统.html'));
    expect(index.equals(app)).toBe(true);
  });

  it('启动器 cmd 全 ASCII（cmd 代码页不会乱码）+ --app + 编码 + CRLF', () => {
    const raw = readFileSync(resolve(DIST, '启动学情登记系统.cmd'));
    // 全 ASCII：cmd.exe 按本机代码页解析脚本，非 ASCII 会乱码
    for (const byte of raw) {
      expect(byte).toBeLessThan(128);
    }
    const text = raw.toString('utf8');
    expect(text).toContain('--app=');
    // 未编码中文 file:// URL 会被 Edge --app 静默拒绝（实测），必须走编码
    expect(text).toContain('EscapeUriString');
    // CRLF 行尾（Windows 脚本惯例）
    expect(text).toContain('\r\n');
    // 三重回退：Edge app 模式 → Chrome app 模式 → 默认浏览器
    expect(text).toContain('msedge');
    expect(text).toContain('chrome');
  });

  it('favicon.svg 与 manifest 就位，start_url 指向中文入口', () => {
    expect(existsSync(resolve(DIST, 'favicon.svg'))).toBe(true);
    const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.webmanifest'), 'utf8')) as {
      start_url: string;
    };
    expect(manifest.start_url).toBe('./学情登记系统.html');
  });
});
