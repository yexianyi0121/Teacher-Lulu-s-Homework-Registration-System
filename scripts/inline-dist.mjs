// 把构建产物内联进 dist/index.html（不属于 CI 门禁）
// 原因：设计 §17 要求「双击 dist/index.html 就能用」，但 Chrome/Edge 对
// file:// 下的 <script type="module" src> 与外部样式表做 CORS 拦截，导致白屏。
// 内联成 <script type="module">（内联模块不再发起跨源请求）+ <style> 即可解决。
// 原始 assets/*.js|css 仍保留在 dist 里，供 PWA 预缓存与 http 访问使用。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve('dist');
const HTML = resolve(DIST, 'index.html');

if (!existsSync(HTML)) {
  console.error('inline-dist: 未找到 dist/index.html，请先执行 vite build');
  process.exit(1);
}

let html = readFileSync(HTML, 'utf8');

const scriptRe = /<script\b[^>]*\bsrc="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/;
const styleRe = /<link\b[^>]*\bhref="\.\/(assets\/[^"]+\.css)"[^>]*>/;

const scriptMatch = html.match(scriptRe);
const styleMatch = html.match(styleRe);

if (!scriptMatch) {
  console.error('inline-dist: 未在 index.html 中找到入口脚本标签');
  process.exit(1);
}

const jsPath = resolve(DIST, scriptMatch[1]);
const js = readFileSync(jsPath, 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace(scriptMatch[0], () => `<script type="module">\n${js}\n</script>`);

if (styleMatch) {
  const cssPath = resolve(DIST, styleMatch[1]);
  const css = readFileSync(cssPath, 'utf8').replace(/<\/style/gi, '<\\/style');
  html = html.replace(styleMatch[0], () => `<style>\n${css}\n</style>`);
}

writeFileSync(HTML, html);
console.log(`inline-dist: 已内联 ${scriptMatch[1]}${styleMatch ? ' + ' + styleMatch[1] : ''}`);
