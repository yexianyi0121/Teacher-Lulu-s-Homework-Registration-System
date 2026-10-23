import type { CellTone, Entry, ScoringScheme } from './types';
import { percentOf, tierOfPercent, tierTone } from './scoring';
import { classifyDictation, formatScore, formatValue } from './grading';

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

/**
 * 听的「错N」色调（V1 §4.2 继承，设计 04 §9.1 补注）：
 * 全对 → 绿、错 1–3 → 琥珀、错 ≥4 → 红、其他文字（缺交/备注）→ 灰。
 * 文本值折算不出百分，若走 tier 兜底会一律变灰，和「缺交/请假」同色（评审 F4）。
 */
function textTone(text: string): CellTone {
  const k = classifyDictation(text);
  if (k.kind === 'perfect') return 'green';
  if (k.kind === 'error') return k.errors >= 4 ? 'red' : 'amber';
  return 'gray';
}

/**
 * 等级色调：沿用 V1 的批改直觉 —— `A-` 固定琥珀（「很好但有错要订正」），
 * 其余按档位（A+/A 绿、B+/B 蓝、C 琥珀、D 红）。
 * 不这样做的话 `A-`(90%) 会被 tier 判成绿色，与 V1 的黄色语义相反（评审 §4 待裁定项）。
 */
function gradeTone(grade: string, fallback: CellTone): CellTone {
  return grade === 'A-' ? 'amber' : fallback;
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
  if (v.kind === 'grade') return { text: v.grade, tone: gradeTone(v.grade, tone), full: v.grade };
  return { text: v.text, tone: textTone(v.text), full: v.text };
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
