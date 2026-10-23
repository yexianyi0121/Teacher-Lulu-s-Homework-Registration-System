import type { Grade } from './types';

export const GRADE_KEY_MAP: Record<string, Grade> = {
  '1': 'A+', '2': 'A', '3': 'A-', '4': 'CROSS', '5': 'CHECK',
};

export const GRADE_LABEL: Record<Grade, string> = {
  'A+': 'A+', 'A': 'A', 'A-': 'A-', 'CHECK': '√', 'CROSS': '×',
};

export const GRADE_TONE: Record<Grade, 'green' | 'blue' | 'amber' | 'gray'> = {
  'A+': 'green', 'A': 'green', 'A-': 'amber', 'CHECK': 'blue', 'CROSS': 'gray',
};

/** 分数规范化：夹取到 [0,100] 并保留 1 位小数（PRD §1.4：本版本只做 100 分制） */
export function normalizeScore(input: number): number {
  const clamped = Math.min(100, Math.max(0, input));
  return Math.round(clamped * 10) / 10;
}

export type DictationKind = 'perfect' | 'error' | 'missing' | 'other';

/** 听写默写文本解析（PRD BR-05） */
export function classifyDictation(text: string): { kind: DictationKind; errors: number } {
  const s = text.trim();
  if (/^(缺交|未交|未做|无|×)$/.test(s)) return { kind: 'missing', errors: 0 };
  const m = s.match(/错\s*(\d+)/);
  if (m) {
    const n = +m[1];
    return n === 0 ? { kind: 'perfect', errors: 0 } : { kind: 'error', errors: n };
  }
  if (/^(全对|√|100|全对0)$/.test(s)) return { kind: 'perfect', errors: 0 };
  return { kind: 'other', errors: 0 };
}

/** 分数展示：整数不显示小数点（PRD FR-03 B） */
export function formatScore(score: number): string {
  const r = Math.round(score * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
