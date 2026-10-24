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
    expect(text).toContain('msedge.exe');
    expect(text).toContain('chrome.exe');
  });

  // v2.5.1 评审 P2-1 回归：启动器曾产出 file:///...dist%5C学情登记系统.html，
  // 反斜杠让浏览器把路径当目录、报 ERR_INVALID_URL，--app 窗口永远打不开应用。
  // 原断言只查了「出现 EscapeUriString」字样，没查「路径分隔符是 /」，所以漏网。
  it('启动器不得把反斜杠塞进 URL（P2-1 回归）', () => {
    const text = readFileSync(resolve(DIST, '启动学情登记系统.cmd'), 'utf8');
    const urlLine = text.split('\r\n').find((l) => l.includes('APP_URL=')) ?? '';
    expect(urlLine).toContain('file:///');
    expect(urlLine).not.toMatch(/%5C|\\\\/);
    // 不允许再靠 %CD% 做反斜杠替换（cmd 无引号上下文下 `=旧=新` 不生效）
    expect(text).not.toContain('%CD:\\=/%');
    // 路径必须在 PowerShell 侧取，并显式把反斜杠换成斜杠
    expect(text).toContain('[char]92');
    expect(text).toContain('(Get-Location).Path');
  });

  it('启动器直探浏览器安装目录（Edge/Chrome 默认不在 PATH）', () => {
    const text = readFileSync(resolve(DIST, '启动学情登记系统.cmd'), 'utf8');
    // 只靠 where 会掉进「默认浏览器」分支，退化成带地址栏的普通窗口，
    // FR-53.3 的无边框就成了空头支票。
    expect(text).toContain('Microsoft\\Edge\\Application\\msedge.exe');
    expect(text).toContain('Google\\Chrome\\Application\\chrome.exe');
  });

  it('启动器优先使用固定入口，而不是随便取一个 *.html', () => {
    const text = readFileSync(resolve(DIST, '启动学情登记系统.cmd'), 'utf8');
    // 通配会把 index.html 镜像一起枚举；必须显式排除它，
    // 否则可能把镜像当主入口（功能等价，但入口语义就乱了）。
    expect(text).toContain('"%%~nxf"=="index.html"');
    // 同时保持全 ASCII：不允许把中文入口名硬写进 cmd。
    expect(text).not.toContain('学情登记系统');
  });

  it('favicon.svg 与 manifest 就位，start_url 指向中文入口', () => {
    expect(existsSync(resolve(DIST, 'favicon.svg'))).toBe(true);
    const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.webmanifest'), 'utf8')) as {
      start_url: string;
    };
    expect(manifest.start_url).toBe('./学情登记系统.html');
  });
});
