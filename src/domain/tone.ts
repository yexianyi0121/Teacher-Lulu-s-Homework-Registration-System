import type { CellTone, Entry, ScoringScheme } from './types';
import { percentOf, tierOfPercent, tierTone } from './scoring';
import { formatScore, formatValue } from './grading';

/**
 * 单元格显示（设计 04 §9.1）—— 纯函数。
 * 优先级（必须按此实现）：请假 > 缺交 > 值 > 空；stamp / makeup 是角标，与主值不互斥。
 */

export interface CellDisplay {
  text: string;
  tone: CellTone;
  /** 主值展示（用于 title / 工具栏） */
  full: string;
}

export function cellDisplay(entry: Entry | undefined, s: ScoringScheme): CellDisplay {
  if (!entry) return { text: '', tone: 'empty', full: '' };
  if (entry.status === 'leave') return { text: '假', tone: 'gray', full: '请假' };
  if (entry.status === 'missing') return { text: '×', tone: 'gray', full: '缺交' };

  if (entry.pass || entry.value?.kind === 'pass') {
    return { text: '√', tone: 'green', full: '已过关' };
  }

  const v = entry.value;
  if (!v) return { text: '', tone: 'empty', full: '' };

  const p = percentOf(entry, s);
  const tone = p === null ? 'gray' : tierTone(tierOfPercent(p, s));

  if (v.kind === 'score') return { text: formatScore(v.score), tone, full: formatScore(v.score) };
  if (v.kind === 'grade') return { text: v.grade, tone, full: v.grade };
  return { text: v.text, tone, full: v.text };
}

/** 仅文本（海报/导出用） */
export function cellText(entry: Entry | undefined, s: ScoringScheme): string {
  return cellDisplay(entry, s).text;
}

/** 单元格色调（兼容旧调用） */
export function cellTone(entry: Entry | undefined, s: ScoringScheme): CellTone {
  return cellDisplay(entry, s).tone;
}

/** 值的紧凑文本（不含状态位） */
export function valueText(entry: Entry | undefined, s: ScoringScheme): string {
  return formatValue(entry?.value ?? null, s);
}
