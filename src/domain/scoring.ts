import type { CellValue, Entry, ScoringScheme, Tier } from './types';
import { GRADE_PERCENT } from './types';
import { gtePct } from './round';

/**
 * 判定内核（设计 04 §6.1）—— 唯一入口，UI 颜色 / 报表名单 / 积分全部走这里。
 * 纯函数，不依赖 store / DOM / 时间。
 */

/** 折算百分；不可折算（无值 / 请假 / 缺交 / text / pass）返回 null */
export function percentOfValue(v: CellValue | null, s: ScoringScheme): number | null {
  if (!v) return null;
  switch (v.kind) {
    case 'score':
      return s.maxScore && s.maxScore > 0 ? (v.score / s.maxScore) * 100 : null;
    case 'grade':
      return GRADE_PERCENT[v.grade];
    case 'pass':
    case 'text':
      return null;
  }
}

/** 同 percentOfValue，但会先排除请假 / 缺交（§6.1 的签名形式） */
export function percentOf(e: Entry, s: ScoringScheme): number | null {
  if (e.status !== 'normal' || !e.value) return null;
  return percentOfValue(e.value, s);
}

/**
 * 档位：唯一入口。
 * 比较用整数标尺（§8.1 / §16-1），否则 `A-`(90) 会被 `0.9*100=90.00000000000001` 判成良好。
 */
export function tierOfPercent(p: number, s: ScoringScheme): Tier {
  if (gtePct(p, s.excellentRate)) return 'excellent';
  if (gtePct(p, s.goodRate)) return 'good';
  if (gtePct(p, s.passRate)) return 'pass';
  return 'fail';
}

export function tierOf(e: Entry, s: ScoringScheme): Tier | null {
  const p = percentOf(e, s);
  return p === null ? null : tierOfPercent(p, s);
}

/**
 * 是否「达标」：及格档及以上。
 * 注意：过关（pass=true / value.kind==='pass'）没有百分，但语义上就是「合格」，
 * 因此先判过关，再判档位（否则听写过关制会被判成不达标，连续 3 次全对的积分也会失效）。
 */
export function isQualified(e: Entry, s: ScoringScheme): boolean {
  if (e.status !== 'normal') return false;
  if (e.pass || e.value?.kind === 'pass') return true;
  const t = tierOf(e, s);
  return t === 'excellent' || t === 'good' || t === 'pass';
}

export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'empty';

/** 档位 → 视觉色调（沿用 V1 色系，老师已看惯） */
export function tierTone(t: Tier | null): Tone {
  switch (t) {
    case 'excellent':
      return 'green';
    case 'good':
      return 'blue';
    case 'pass':
      return 'amber';
    case 'fail':
      return 'red';
    default:
      return 'empty';
  }
}

/** 该方案是否含「过关」语义（决定 G 键、只看未过关、报表【已过关】段） */
export function schemeHasPass(s: ScoringScheme): boolean {
  return s.kind === 'check' || s.allowCheck;
}

/** 该方案是否能录等级 */
export function schemeAllowsGrade(s: ScoringScheme): boolean {
  return s.kind === 'grade' || s.kind === 'mixed';
}

/** 该方案是否能录分数 */
export function schemeAllowsScore(s: ScoringScheme): boolean {
  return s.kind === 'score' || s.kind === 'mixed';
}

/** 该方案是否能录文本（PRD FR-20：任何方案都能录文本） */
export function schemeAllowsText(s: ScoringScheme): boolean {
  return s.allowText || s.kind === 'text' || s.kind === 'mixed' || s.kind === 'check';
}
