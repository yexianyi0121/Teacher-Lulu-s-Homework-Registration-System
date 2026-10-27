import type { Entry, GradeLetter, ScoringScheme, ScorePassTier, Tier } from './types';
import { percentOf, tierOfPercent } from './scoring';
import { classifyDictation } from './grading';

/**
 * 过关判定（设计 06 §3.1）—— 全系统唯一入口。
 *
 * v2.6.3 FR-72：过关规则不再是一份「系统设置里的全局规则」，而是由每张表自己的方案
 * （ScoringScheme）决定，口径与方案类型一一对应：
 *   - 等级制 grade：只看等级白名单（强制）——勾了哪些等级，就只有哪些等级算过关；
 *   - 分数制 score：只看分数口径（及格% / 良好% / 优秀% 三选一，FR-72.2）；
 *   - 混合制 mixed：等级值看白名单、分数值看分数口径，两条线互不越界（FR-72.3）。
 *
 * 旧版 mixed 是「percent 先兜底、白名单再兜底」，没勾的 B-/C 只要分数够及格线也算过关，
 * 正是用户反馈的「只勾了 A+ A A-，却除 D 外全过关」——这里已按 FR-72.3 修掉。
 */

export const DEFAULT_GRADE_PASS: GradeLetter[] = ['A+', 'A'];
export const DEFAULT_SCORE_PASS_TIER: ScorePassTier = 'pass';

const TIER_RANK: Record<Tier, number> = { fail: 0, pass: 1, good: 2, excellent: 3 };

/** 读出本表方案里的过关配置（老数据缺字段时回落默认值） */
export function passConfigOf(s: ScoringScheme): {
  gradePass: GradeLetter[];
  scorePassTier: ScorePassTier;
  missingPass: boolean;
  leavePass: boolean;
  dictationAutoPass: boolean;
} {
  return {
    gradePass: s.gradePass ?? DEFAULT_GRADE_PASS,
    scorePassTier: s.scorePassTier ?? DEFAULT_SCORE_PASS_TIER,
    missingPass: s.missingPass ?? false,
    leavePass: s.leavePass ?? false,
    dictationAutoPass: s.dictationAutoPass ?? true,
  };
}

/** 这一档分数算不算过关（口径：达到 scorePassTier 及以上） */
export function tierPasses(tier: Tier, cfgTier: ScorePassTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[cfgTier];
}

/** 手工过关（空格盖章 / 输入 √）——与「分数够不够」无关，永远算过关 */
export function isManualPass(e: Entry | undefined): boolean {
  if (!e) return false;
  return !!e.pass || e.value?.kind === 'pass';
}

export function isPassed(e: Entry | undefined, s: ScoringScheme): boolean {
  if (!e) return false;
  const cfg = passConfigOf(s);

  // 状态优先：缺交 / 请假是否算过关由本表开关决定（默认都不算）
  if (e.status === 'missing') return cfg.missingPass;
  if (e.status === 'leave') return cfg.leavePass;

  // 盖章 / 手工过关位
  if (e.pass || e.value?.kind === 'pass') return true;

  const v = e.value;
  if (!v) return false;

  // 等级值：等级制、混合制一律只看白名单（FR-72.1 / FR-72.3）
  if (v.kind === 'grade' && (s.kind === 'grade' || s.kind === 'mixed')) {
    return cfg.gradePass.includes(v.grade);
  }

  // 分数值、以及「分数制里的等级值」：按本表分数口径判（FR-72.2）
  const p = percentOf(e, s);
  if (p !== null && s.kind !== 'text') {
    return tierPasses(tierOfPercent(p, s), cfg.scorePassTier);
  }

  // 文字值：听写「全对 / 错 0」按开关自动算过关
  if (v.kind === 'text') {
    const c = classifyDictation(v.text);
    return cfg.dictationAutoPass && c.kind === 'perfect';
  }
  return false;
}
