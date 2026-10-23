import type { CellValue, GradeLetter, ScoringScheme } from './types';
import { GRADE_PERCENT } from './types';

/**
 * 录入解析与展示（设计 04 §3 grading.ts ★改）
 * 纯函数：键位 → 值、文本 → 听写判定、值 → 展示字符串。
 */

/** 等级字母的直接映射（A/B/C/D + 修饰符得到的 A+ / A- / B+） */
export const GRADE_LETTERS: GradeLetter[] = ['A+', 'A', 'A-', 'B+', 'B', 'C', 'D'];

/**
 * 基础字母 + 修饰符 → 合法等级（PRD FR-17：`A`→`A-` 用 `-` 修饰）。
 * 只有 A+/A-/B+ 三种带修饰的档位存在；`C+`/`D-` 等返回 null。
 */
export function applyGradeModifier(base: string, mod: '+' | '-' | null): GradeLetter | null {
  const b = base.toUpperCase();
  if (!mod) {
    return (GRADE_LETTERS as string[]).includes(b) ? (b as GradeLetter) : null;
  }
  const combo = b + mod;
  return (GRADE_LETTERS as string[]).includes(combo) ? (combo as GradeLetter) : null;
}

/** 分数规范化：夹取到 [0, maxScore]，按小数位四舍五入（PRD FR-18） */
export function normalizeScore(input: number, maxScore: number, decimals = 1): number {
  if (!Number.isFinite(input)) return 0;
  const clamped = Math.min(maxScore, Math.max(0, input));
  const f = decimals >= 1 ? 10 : 1;
  return Math.round(clamped * f) / f;
}

export type DictationKind = 'perfect' | 'error' | 'missing' | 'other';

/**
 * 听写默写文本解析（PRD BR-05 沿用）。
 * 注意：`错N` 只产生文字值，**不进入四档统计**（设计 §16-18）。
 */
export function classifyDictation(text: string): { kind: DictationKind; errors: number } {
  const s = text.trim();
  if (/^(缺交|未交|未做|无|×)$/.test(s)) return { kind: 'missing', errors: 0 };
  const m = s.match(/错\s*(\d+)/);
  if (m) {
    const n = +m[1];
    return n === 0 ? { kind: 'perfect', errors: 0 } : { kind: 'error', errors: n };
  }
  if (/^(全对|√|100|全对0|满分)$/.test(s)) return { kind: 'perfect', errors: 0 };
  return { kind: 'other', errors: 0 };
}

/** 分数展示：整数不显示小数点（PRD FR-03 B） */
export function formatScore(score: number): string {
  const r = Math.round(score * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** 值的紧凑展示（导出 CSV / 海报 / 单元格共用） */
export function formatValue(v: CellValue | null, scheme: ScoringScheme): string {
  void scheme;
  if (!v) return '';
  switch (v.kind) {
    case 'grade':
      return v.grade;
    case 'score':
      return formatScore(v.score);
    case 'text':
      return v.text;
    case 'pass':
      return '√';
  }
}

/** 等级是否在方案允许的等级集内（不在则拒绝录入，L-4 闭集优先） */
export function gradeAllowed(grade: GradeLetter, s: ScoringScheme): boolean {
  return s.grades.includes(grade);
}

/** 等级折算百分（只读引用，禁止在此处新增映射） */
export function gradePercent(grade: GradeLetter): number {
  return GRADE_PERCENT[grade];
}

/** 听写文本是否「达标」：allCorrect 语境下 全对/满分/全对✓ 视为达标 */
export function textMeansPerfect(text: string): boolean {
  return /^(全对|满分|全对[✓√]?)$/.test(text.trim());
}
