// 分层约束检查（替代 eslint 的轻量实现，避免引入 §1.4 之外的依赖）
// 规则（设计 §3）：
//   domain/** 不得 import store / components / infra / react
//   store/**  不得 import components
//   infra/**  不得 import components
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd(), 'src');
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) check(full);
  }
}

function check(file) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const layer = rel.split('/')[0];
  const src = readFileSync(file, 'utf8');
  const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

  for (const spec of imports) {
    if (layer === 'domain') {
      if (/^(react|react-dom|zustand)/.test(spec)) violations.push(`${rel}: domain 不得依赖 ${spec}`);
      if (spec.startsWith('../store') || spec.startsWith('../components') || spec.startsWith('../infra') || spec.startsWith('../hooks')) {
        violations.push(`${rel}: domain 不得依赖 ${spec}`);
      }
    }
    if (layer === 'store' && spec.includes('components')) violations.push(`${rel}: store 不得依赖 ${spec}`);
    if (layer === 'infra' && spec.includes('components')) violations.push(`${rel}: infra 不得依赖 ${spec}`);
  }
}

walk(ROOT);

if (violations.length > 0) {
  console.error('分层约束检查失败：');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log('分层约束检查通过：domain / store / infra 无越界依赖。');
