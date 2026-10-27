import type { CellValue, Entries, GradeLetter, ScoringScheme } from './types';

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
    if (!e || !e.value) {
      out[no] = e;
      continue;
    }
    // 满分变了 → 所有分数值作废；其余情况（含方案类型变了）一律看「新方案还认不认这个值」
    const allowed = valueAllowedByScheme(e.value, next);
    const drop = maxScoreChanged ? e.value.kind === 'score' || !allowed : !allowed;
    if (!drop) {
      out[no] = e;
      continue;
    }
    cleared++;
    out[no] = { ...e, value: null };
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
