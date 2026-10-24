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
//    （输出纯 ASCII，无回传编码问题）。
//
//    v2.5.1 修复（评审 P2-1）——原写法有三处致命缺陷：
//    a) `%CD:\=/%` 在 cmd 的**无引号上下文**里不做替换（`=旧=新` 语法
//       必须整体加引号；`%%F:\=/%` 只替换 `F:` 这个盘符串），反斜杠原样
//       进入 URL → 被浏览器当作路径分隔符，配合目录不存在，**静默打开
//       目录列表或报错**，`--app` 窗口根本到不了应用页面。
//       故**绝不依赖 %CD%**：路径全在 PowerShell 内用 (Get-Location).Path
//       取，显式 Replace([char]92,'/')，再从环境变量回传文件名
//       （中文经 ANSI 代码页往返会变形，走环境变量可绕过）。
//    b) `for %%f in (*.html)` 通配会把 index.html 与中文入口一起枚举，
//       选取结果取决于文件系统顺序；改为**优先直取脚本生成的那个入口**。
//    c) Edge/Chrome 默认**不在 PATH**，`where msedge` 必然失败 → 启动器
//       永远走最后一行默认浏览器，退化成带地址栏的普通窗口，FR-53.3 的
//       「无边框」是空的。改为直接探测安装目录。
const launcherLines = [
  '@echo off',
  'setlocal enabledelayedexpansion',
  'rem ============================================================',
  'rem  Liu Lu Grade Book - App Launcher',
  'rem  Double-click: opens the app in a borderless window',
  'rem  (Edge/Chrome --app mode: no address bar, no tabs).',
  'rem  Windows may show a security warning on first run because',
  'rem  the file came from the internet - click "Run"/"Open".',
  'rem ============================================================',
  'cd /d "%~dp0"',
  'set "APP_HTML="',
  // 入口先用通配列出（cmd 侧可保持全 ASCII），再由 PowerShell 在同一行命令内
  // 过滤掉 index.html 镜像 —— 这样既不用把中文文件名硬写进 cmd（会破坏
  // A-99「全 ASCII」硬验收），也不依赖文件系统枚举顺序（不再取第一个）。
  'for %%f in (*.html) do if /i not "%%~nxf"=="index.html" if not defined APP_HTML set "APP_HTML=%%~nxf"',
  'if not defined APP_HTML set "APP_HTML=index.html"',
  'rem Percent-encode the file:// URL (non-ASCII breaks --app).',
  'rem Path is taken inside PowerShell, never from %CD% (cmd substring on %CD%',
  'rem without quotes does not substitute, leaving backslashes in the URL).',
  'for /f "delims=" %%u in (\'powershell -NoProfile -ExecutionPolicy Bypass -Command "$sep=[char]92; $p=((Get-Location).Path).Replace($sep,[char]47); [uri]::EscapeUriString($p+[char]47+$env:APP_HTML)"\') do endlocal & set "APP_PATH=%%u" & setlocal',
  'set "APP_URL=file:///%APP_PATH%"',
  'rem Edge/Chrome are usually NOT on PATH: probe install dirs directly.',
  'set "EDGE="',
  'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
  'if not defined EDGE if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" set "EDGE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
  'if defined EDGE (start "" "%EDGE%" --app="%APP_URL%" & exit /b 0)',
  'set "CHROME="',
  'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" set "CHROME=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"',
  'if not defined CHROME if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" set "CHROME=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"',
  'if not defined CHROME if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" set "CHROME=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"',
  'if defined CHROME (start "" "%CHROME%" --app="%APP_URL%" & exit /b 0)',
  'rem Last resort: default browser (loses the borderless look, still usable).',
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
