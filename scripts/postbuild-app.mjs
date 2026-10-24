// 入口 App 化后处理（build: vite build && inline-dist.mjs && postbuild-app.mjs）
//
// 背景：交付形态是「下载 ZIP → 双击 dist 里的入口直接用」。原来入口叫
// index.html，一眼就是"网页源码包"；且普通浏览器窗口带地址栏和标签页，
// 不像应用。本脚本把入口改成用户视角的「应用」：
//
//   1) dist/index.html → dist/学情登记系统.html（应用主入口，改名）
//   2) 原位置放**完整应用镜像**（内容与中文入口逐字节相同）。
//      不用 meta-refresh 跳转页：0 秒跳转会摧毁 goto('/') 后的执行上下文
//      （测试全线炸），且 SW 的 navigateFallback 返回跳转页会无限循环
//      （v2.5.0 开发实录）；镜像方案让旧书签 / 静态服务器 / SW fallback
//      拿到的是完整应用，三重场景同时免疫。
//   3) 生成 Windows 无边框启动器「启动学情登记系统.cmd」：
//      Edge/Chrome --app 模式打开 → 无地址栏、无标签页，任务栏用页面
//      favicon 作窗口图标，视觉上与桌面应用一致
//   4) manifest.start_url 指向中文入口（PWA 安装后启动直达）
//
// 编码约定：cmd 内容必须全 ASCII（cmd.exe 按本机代码页解析脚本，
// 含中文会乱码）；中文只出现在文件名里，由文件系统自行处理。
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve('dist');
const INDEX = resolve(DIST, 'index.html');
const APP_HTML = '学情登记系统.html';
const APP_PATH = resolve(DIST, APP_HTML);
const LAUNCHER_NAME = '启动学情登记系统.cmd';
const LAUNCHER = resolve(DIST, LAUNCHER_NAME);
const MANIFEST = resolve(DIST, 'manifest.webmanifest');

if (!existsSync(INDEX) && !existsSync(APP_PATH)) {
  console.error('postbuild-app: 未找到 dist/index.html，请先执行 vite build && inline-dist');
  process.exit(1);
}

// 1) 改名。vite build 默认 emptyOutDir（每次清空 dist），正常链路下
//    APP_PATH 必不存在 → 走 rename；手动重跑本脚本时 APP_PATH 已在 →
//    跳过 rename（防止把镜像盖回中文入口），直接进第 2 步重建镜像。
//    注意：若关闭 emptyOutDir 且 APP_PATH 是旧产物，本脚本会用旧应用
//    刷新镜像——保持 emptyOutDir 开启即可。
if (!existsSync(APP_PATH)) {
  if (!existsSync(INDEX)) {
    console.error('postbuild-app: 未找到 dist/index.html，请先执行 vite build && inline-dist');
    process.exit(1);
  }
  renameSync(INDEX, APP_PATH);
}

// 2) 原位置写完整应用镜像（与中文入口逐字节相同）
copyFileSync(APP_PATH, INDEX);

// 3) 启动器（CRLF，全 ASCII）
//    关键实测（2026-10-25，Edge 124）：--app=file://... 里的中文必须
//    百分号编码，未编码时 Edge 静默拒绝开窗；而 cmd 脚本按本机代码页
//    解析、不能出现中文字面量，所以借 PowerShell 一行式完成编码
//    （EscapeUriString 保留 :/ 只编码非 ASCII；EscapeDataString 会把
//    冒号和斜杠一起编码出坏 URL，不可用）。输出纯 ASCII，无回传编码问题。
const launcherLines = [
  '@echo off',
  'rem ============================================================',
  'rem  Liu Lu Grade Book - App Launcher',
  'rem  Double-click: opens the app in a borderless window',
  'rem  (Edge/Chrome --app mode: no address bar, no tabs).',
  'rem  Windows may show a security warning on first run because',
  'rem  the file came from the internet - click "Run"/"Open".',
  'rem ============================================================',
  'cd /d "%~dp0"',
  'set "APP_HTML="',
  'for %%f in (*.html) do if /i not "%%f"=="index.html" set "APP_HTML=%%f"',
  'if not defined APP_HTML set "APP_HTML=index.html"',
  'rem percent-encode the file:// URL (non-ASCII breaks --app)',
  'for /f "delims=" %%u in (\'powershell -NoProfile -Command "[uri]::EscapeUriString(\'%CD:\\=/%\\%APP_HTML%\')"\') do set "APP_PATH=%%u"',
  'set "APP_URL=file:///%APP_PATH%"',
  'where msedge >nul 2>nul && (start "" msedge --app="%APP_URL%" & exit /b 0)',
  'where chrome >nul 2>nul && (start "" chrome --app="%APP_URL%" & exit /b 0)',
  'start "" "%APP_URL%"',
  '',
];
writeFileSync(LAUNCHER, launcherLines.join('\r\n'), 'utf8');

// 4) manifest.start_url → 中文入口
if (existsSync(MANIFEST)) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  manifest.start_url = `./${APP_HTML}`;
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

console.log(`postbuild-app: 入口已改名为 ${APP_HTML}（index.html 为同内容镜像），生成 ${LAUNCHER_NAME}，start_url 已指向中文入口`);
