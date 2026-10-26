import type { CellTone, Entry, GradeLetter, PassRule, ScoringScheme } from './types';
import { percentOf, tierOfPercent, tierTone } from './scoring';
import { classifyDictation, formatScore, formatValue } from './grading';
import { isManualPass, isPassed } from './passRule';
import { DEFAULT_GRADE_EMOJI } from './constants';
import { DEFAULT_PASS_RULE } from './passRule';

/**
 * 单元格显示（V3 设计 06 §3.2）—— 纯函数。
 *
 * 两套色系并存（L-6）：
 *   - 等级格子：主色由 `grade` 驱动（CSS `data-grade` → GRADE_TONE 八档），`tone` 只留给图表；
 *   - 分数格子：由 `tone`（四档百分比色）驱动。
 * UI 不允许自己判断「是否过关」，一律走 passRule.isPassed()。
 */

export interface GradeTone {
  bg: string;
  line: string;
  fg: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
}

export const GRADE_TONE: Record<GradeLetter, GradeTone> = {
  'A+': { bg: '#E8F5EC', line: '#3F8F5F', fg: '#2F7A4E', borderStyle: 'solid' },
  'A': { bg: '#EDF8F1', line: '#5FA97C', fg: '#3E8A5E', borderStyle: 'solid' },
  'A-': { bg: '#F3FAEA', line: '#8FBF6F', fg: '#6E9B4C', borderStyle: 'solid' },
  'B+': { bg: '#FEF9E4', line: '#E3B93F', fg: '#A9851F', borderStyle: 'solid' },
  'B': { bg: '#FDF2E3', line: '#E89A4A', fg: '#B4701F', borderStyle: 'dashed' }, 'B-': { bg: '#F7EAE1', line: '#D1873F', fg: '#8F6319', borderStyle: 'dashed' },
  'C': { bg: '#FDEDE6', line: '#E0704F', fg: '#B24A2C', borderStyle: 'dashed' },
  'D': { bg: '#FCE8E6', line: '#D1453B', fg: '#A32A22', borderStyle: 'dotted' },
};

export type CellKind = 'grade' | 'score' | 'text' | 'pass' | 'missing' | 'leave' | 'empty';
export type CellBadge = 'missing' | 'leave' | 'madeup' | 'passed';

export interface CellDisplay {
  text: string;
  kind: CellKind;
  /** 供图表/统计沿用（四档色）；等级格子的实际颜色看 grade */
  tone: CellTone;
  grade?: GradeLetter;
  emoji?: string;
  badge?: CellBadge;
  subText?: string;
  full: string;
}

export interface DisplayOptions {
  passRule?: PassRule;
  showEmoji?: boolean;
  gradeEmoji?: Record<GradeLetter, string>;
}

function textTone(text: string): CellTone {
  const k = classifyDictation(text);
  if (k.kind === 'perfect') return 'green';
  if (k.kind === 'error') return k.errors >= 4 ? 'red' : 'amber';
  return 'gray';
}

export function cellDisplay(entry: Entry | undefined, s: ScoringScheme, opts: DisplayOptions = {}): CellDisplay {
  const rule = opts.passRule ?? DEFAULT_PASS_RULE;
  const showEmoji = opts.showEmoji ?? false;
  const emojiMap = opts.gradeEmoji ?? DEFAULT_GRADE_EMOJI;

  if (!entry) return { text: '', kind: 'empty', tone: 'empty', full: '' };

  const makeupBadge = entry.makeup ? 'madeup' : undefined;
  const makeupText = entry.makeup ? '补交' : undefined;

  if (entry.status === 'leave') {
    return {
      text: '假', kind: 'leave', tone: 'gray',
      badge: makeupBadge ?? 'leave', subText: makeupText, full: '请假',
    };
  }
  if (entry.status === 'missing') {
    return {
      text: '×', kind: 'missing', tone: 'gray',
      badge: makeupBadge ?? 'missing', subText: makeupText, full: '缺交',
    };
  }

  // 手工过关：主值 ✓（U+2713，v2.5.9：跨平台一致；U+221A「√」在 Mac 上就是根号。输入侧仍接受 √）
  if (isManualPass(entry)) {
    return {
      text: '✓', kind: 'pass', tone: 'green',
      badge: makeupBadge, subText: makeupText, full: '已过关',
    };
  }

  const v = entry.value;
  if (!v) return { text: '', kind: 'empty', tone: 'empty', full: '' };

  const passed = isPassed(entry, s, rule);
  const badge: CellBadge | undefined = makeupBadge ?? (passed ? 'passed' : undefined);

  if (v.kind === 'grade') {
    const p = percentOf(entry, s);
    const tone = p === null ? 'gray' : tierTone(tierOfPercent(p, s));
    // v2.3.1 用户意见 3：某等级表情可设为空串（「不显示」）——domain 层归一为 undefined，
    // 不让空串漏给 UI / 海报 / 导出（CellView 的 `emoji ? …` 只是第二道闸）
    const em = emojiMap[v.grade];
    return {
      text: v.grade, kind: 'grade', tone, grade: v.grade,
      emoji: showEmoji && em ? em : undefined,
      badge, subText: makeupText, full: v.grade,
    };
  }

  if (v.kind === 'score') {
    const p = percentOf(entry, s);
    const tone = p === null ? 'gray' : tierTone(tierOfPercent(p, s));
    return { text: formatScore(v.score), kind: 'score', tone, badge, subText: makeupText, full: formatScore(v.score) };
  }

  if (v.kind === 'text') {
    return {
      text: v.text === '√' ? '✓' : v.text, kind: 'text', tone: textTone(v.text),
      badge, subText: makeupText, full: v.text === '√' ? '✓' : v.text,
    };
  }

  return { text: '', kind: 'empty', tone: 'empty', full: '' };
}

/** 仅文本（海报/导出用） */
export function cellText(entry: Entry | undefined, s: ScoringScheme, opts?: DisplayOptions): string {
  return cellDisplay(entry, s, opts).text;
}

/** 单元格色调（兼容旧调用） */
export function cellTone(entry: Entry | undefined, s: ScoringScheme, opts?: DisplayOptions): CellTone {
  return cellDisplay(entry, s, opts).tone;
}

/** 值的紧凑文本（不含状态位） */
export function valueText(entry: Entry | undefined, s: ScoringScheme): string {
  return formatValue(entry?.value ?? null, s);
}
