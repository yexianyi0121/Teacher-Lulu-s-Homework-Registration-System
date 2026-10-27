import type { CellValue, Entries, GradeLetter, ScoringScheme } from './types';
import { SCHEME_LABEL, TIER_LABEL } from './constants';
import { passConfigOf } from './passRule';

/**
 * 方案与已登记值的相容性（v2.6.3 FR-72.3 / 问题三）—— 纯函数。
 *
 * 老师改「本表设置」时，旧值可能不再适用于新方案（等级制里留着分数、改了满分、
 * 把某档等级从可用等级里取消…）。这里统一回答两件事：
 *   1) 某个值在新方案下还算不算数；
 *   2) 按新方案清理后，会动到几个格子（用于「完成」前的二次确认文案）。
 * 只清「值」，不动状态（缺交/请假）与盖章、不改人数、不动历史记录。
 */

/** 这个值在新方案下是否仍然适用 */
export function valueAllowedByScheme(v: CellValue | null | undefined, s: ScoringScheme): boolean {
  if (!v) return true;
  switch (v.kind) {
    case 'grade':
      return (s.kind === 'grade' || s.kind === 'mixed') && s.grades.includes(v.grade);
    case 'score':
      return s.kind === 'score' || s.kind === 'mixed';
    case 'text':
      return s.kind === 'text' || s.kind === 'mixed' || s.allowText;
    case 'pass':
      return s.kind === 'check' || s.kind === 'mixed' || s.allowCheck;
    default:
      return false;
  }
}

/** 「手工过关标记」（录 G / 点 ✓）在新方案下是否还允许（v2.6.4 BUG1） */
function markAllowed(s: ScoringScheme): boolean {
  return s.kind === 'check' || s.kind === 'mixed' || s.allowCheck;
}

export interface PruneResult {
  entries: Entries;
  /** 被清空的格子数 */
  cleared: number;
}

/**
 * 按新方案清理已登记值。
 * @param prev 改动前的方案（用来识别「满分变了」这类看不见的改动）
 */
export function pruneEntries(entries: Entries, next: ScoringScheme, prev?: ScoringScheme): PruneResult {
  const maxScoreChanged = !!prev
    && (next.kind === 'score' || next.kind === 'mixed')
    && (prev.maxScore ?? null) !== (next.maxScore ?? null);

  let cleared = 0;
  const out: Entries = {};
  for (const [no, e] of Object.entries(entries)) {
    if (!e) {
      out[no] = e;
      continue;
    }
    // 满分变了 → 所有分数值作废；其余情况（含方案类型变了）一律看「新方案还认不认这个值」
    const allowed = e.value ? valueAllowedByScheme(e.value, next) : true;
    const dropValue = !!e.value && (maxScoreChanged ? e.value.kind === 'score' || !allowed : !allowed);
    // v2.6.4 BUG1：手工过关标记（e.pass）不在 value 里，取消「允许 ✓ 过关标记」时也要一起清，
    // 否则格子上还挂着过关，界面既不提示也不刷新。
    // 注意不能把「只有标记、没有值」的格子当成空格子跳过——那正是老师报的那一格。
    const dropMark = !!e.pass && !markAllowed(next);
    if (!dropValue && !dropMark) {
      out[no] = e;
      continue;
    }
    cleared++;
    out[no] = { ...e, value: dropValue ? null : e.value, pass: dropMark ? false : e.pass };
  }
  return { entries: out, cleared };
}

/** 旧数据里的全局过关规则（v2.6.2 及以前）——只用于迁移，运行时不再读它 */
export interface LegacyPassRule {
  kind?: 'percent' | 'grade' | 'mixed';
  gradePass?: GradeLetter[];
  missingPass?: boolean;
  leavePass?: boolean;
  dictationAutoPass?: boolean;
}

/**
 * 把旧数据补成新口径（v2.6.3 FR-72.4）：老备份里过关规则存在 settings.passRule，
 * 现在要落到每条记录自己的方案上，老师当初勾过的白名单不能丢。
 */
/**
 * 一行说清「本表方案类型 + 过关口径」（v2.6.5 需求3）——摆在输出带上常驻。
 * 老师不用点进「本表设置」就能知道现在按什么规则判过关。
 */
export function schemeHint(s: ScoringScheme): string {
  const cfg = passConfigOf(s);
  const kind = SCHEME_LABEL[s.kind];
  if (s.kind === 'grade') {
    const g = cfg.gradePass.length ? cfg.gradePass.join('/') : '（未勾等级）';
    return `${kind} · 过关 ${g}`;
  }
  if (s.kind === 'score') return `${kind} · ${TIER_LABEL[cfg.scorePassTier]}以上算过关`;
  if (s.kind === 'mixed') {
    const g = cfg.gradePass.length ? cfg.gradePass.join('/') : '（未勾等级）';
    return `${kind} · 等级 ${g}；分数 ${TIER_LABEL[cfg.scorePassTier]}以上`;
  }
  if (s.kind === 'check') return `${kind} · 按 ✓ 判定过关`;
  return `${kind} · 不计过关`;
}

export function normalizeScheme(s: ScoringScheme, legacy?: LegacyPassRule | null): ScoringScheme {
  if (!legacy) {
    return { ...s, grades: [...s.grades] };
  }
  return {
    ...s,
    grades: [...s.grades],
    gradePass: s.gradePass ?? (legacy.gradePass ? [...legacy.gradePass] : undefined),
    scorePassTier: s.scorePassTier ?? 'pass',
    missingPass: s.missingPass ?? legacy.missingPass ?? false,
    leavePass: s.leavePass ?? legacy.leavePass ?? false,
    dictationAutoPass: s.dictationAutoPass ?? legacy.dictationAutoPass ?? true,
  };
}
