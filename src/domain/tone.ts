import type { CellTone, EntryValue, Mode, Settings } from './types';
import { GRADE_TONE, classifyDictation } from './grades';
import { toTenthInt } from './round';

/**
 * 单元格色调（设计 §9.3，【必须】纯函数，settings 显式传入）
 * quiz 阈值必须来自 settings，不得写死 90/60。
 */
export function cellTone(mode: Mode, value: EntryValue | null, s: Settings): CellTone {
  // mode 保留在签名中（设计 §9.3 契约）；着色只依赖 value.kind
  void mode;
  if (!value) return 'empty';

  if (value.kind === 'grade') {
    return GRADE_TONE[value.grade];
  }

  if (value.kind === 'score') {
    const t = toTenthInt(value.score);
    const ex = toTenthInt(s.excellentLine);
    const ps = toTenthInt(s.passLine);
    if (t >= ex) return 'green';
    if (t >= 800) return 'blue';
    if (t >= ps) return 'amber';
    return 'red';
  }

  const k = classifyDictation(value.text);
  if (k.kind === 'perfect') return 'green';
  if (k.kind === 'missing') return 'gray';
  if (k.kind === 'error') return k.errors >= 4 ? 'red' : 'amber';
  return 'blue';
}

/** 单元格展示文本（null 时返回空串：PRD §4.5.2 不渲染任何字符） */
export function cellText(value: EntryValue | null): string {
  if (!value) return '';
  if (value.kind === 'grade') {
    return { 'A+': 'A+', A: 'A', 'A-': 'A-', CHECK: '√', CROSS: '×' }[value.grade];
  }
  if (value.kind === 'score') {
    const r = Math.round(value.score * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  return value.text;
}
