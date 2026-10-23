import type { ScoringScheme } from './types';

/**
 * 分数校验（设计 06 §3.4 / PRD FR-39）—— 唯一入口。
 * 键盘与粘贴都必须先过这里；非法一律「整条拒绝」，绝不部分写入。
 */

export type ScoreReason = 'EMPTY' | 'NAN' | 'NEGATIVE' | 'TOO_BIG' | 'TOO_MANY_DECIMALS';

export type ScoreCheck =
  | { ok: true; value: number }
  | { ok: false; reason: ScoreReason };

export function reasonText(reason: ScoreReason, max: number): string {
  switch (reason) {
    case 'EMPTY': return '请输入分数';
    case 'NEGATIVE': return '分数不能为负';
    case 'TOO_BIG': return `本表满分 ${max} 分`;
    case 'TOO_MANY_DECIMALS': return '小数位超出本表设置';
    default: return `只能输入 0–${max} 的数字`;
  }
}

/** 全角数字 / 全角句点 → 半角 */
export function toHalfWidth(text: string): string {
  return text
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\uFF0E/g, '.');
}

/**
 * 清洗粘贴文本：去空白、全角转半角、只允许 `[0-9.]`。
 * 出现任何其他字符（含负号/字母）→ `null`（调用方整条拒绝，不做「删掉非法字符再写入」）。
 */
export function sanitizeScoreInput(text: string, max: number, decimals: number): string | null {
  const normalized = toHalfWidth(text).replace(/\s+/g, '');
  if (!normalized) return null;
  if (/[^0-9.]/.test(normalized)) return null;
  if ((normalized.match(/\./g) ?? []).length > 1) return null;
  const [intPart, decPart = ''] = normalized.split('.');
  if (intPart.length > 6) return null;
  if (decPart.length > Math.max(0, decimals)) return null;
  if (normalized.startsWith('.')) return null;
  if (Number(intPart) > max) return null;
  return normalized;
}

export function checkScore(text: string, max: number, decimals: number): ScoreCheck {
  const cleaned = sanitizeScoreInput(text, max, decimals);
  if (cleaned === null) {
    const t = toHalfWidth(text).trim();
    if (!t) return { ok: false, reason: 'EMPTY' };
    if (t.includes('-')) return { ok: false, reason: 'NEGATIVE' };
    if (/[^0-9.]/.test(t)) return { ok: false, reason: 'NAN' };
    if ((t.match(/\./g) ?? []).length > 1) return { ok: false, reason: 'NAN' };
    const [i, d = ''] = t.split('.');
    if (d.length > Math.max(0, decimals)) return { ok: false, reason: 'TOO_MANY_DECIMALS' };
    if (Number(i) > max) return { ok: false, reason: 'TOO_BIG' };
    return { ok: false, reason: 'NAN' };
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { ok: false, reason: 'NAN' };
  return { ok: true, value };
}

/** 单字符入口：键盘输入时判断这个字符是否可进入缓冲区（返回归一化字符或 null） */
export function sanitizeScoreChar(ch: string, max: number, decimals: number): string | null {
  const half = toHalfWidth(ch);
  if (half === '.') return decimals > 0 ? '.' : null;
  if (!/^[0-9]$/.test(half)) return null;
  if (max <= 0) return null;
  return half;
}

/** 方案对应可用的满分（mixed 缺 maxScore 时兜底 100，INV-21） */
export function maxScoreOf(s: ScoringScheme): number {
  return s.maxScore && s.maxScore > 0 ? s.maxScore : 100;
}
