import type { Entries, GradeLetter, RosterGroups, ScoringScheme } from './types';
import { percentOf } from './scoring';
import { gtePct } from './round';

/**
 * 名单分拣（设计 04 §6.3 / PRD-V2 §2.3.1）—— 纯函数。
 *
 * 关键：**名单口径 ≠ 四档口径**。
 *   等级值看「字母秩」（A- 入需更正，即使它的 percent=90 在统计里算优秀）；
 *   分数值看「百分」（< 及格线才入需更正；及格/良好档不进任何名单）。
 * 所以禁止只用 tierOf 判名单。
 */

const RANK: Record<GradeLetter, number> = { 'A+': 7, 'A': 6, 'A-': 5, 'B+': 4, 'B': 3, 'C': 2, 'D': 1 };

/** 入光荣榜？（等级看字母秩，分数看百分，文本永不入榜） */
function inHonor(e: Entries[string], s: ScoringScheme, honorIncludesA: boolean): boolean {
  const v = e.value;
  if (!v) return false;
  // PRD-V2 §2.3.1：字母秩 ≥ A（A+/A）进光荣榜；开关打开后 A-（秩 5）也进。
  // 注意这与 V1 的「A 档不入名单」不同——PRD-V2 明确改了口径（其自述样例 B 光荣榜为 A+12+A8=20 人），
  // 设计 §12.4 的 R-2（21 人）属旧值，按「PRD 行为优先」取本条。
  if (v.kind === 'grade') return RANK[v.grade] >= (honorIncludesA ? 5 : 6);
  if (v.kind === 'score') {
    const p = percentOf(e, s);
    return p !== null && gtePct(p, s.excellentRate);
  }
  return false;
}

/** 入需更正？（等级看字母秩：非荣即需；分数看及格线；文本仅过关制） */
function inNeedsFix(e: Entries[string], s: ScoringScheme, honorIncludesA: boolean): boolean {
  const v = e.value;
  if (!v || inHonor(e, s, honorIncludesA)) return false;
  if (v.kind === 'grade') return RANK[v.grade] <= 5;   // A- 及以下；A 与 A+ 是荣誉/中立档
  if (v.kind === 'pass') return false;          // 已过关，已由规则 4 抢走
  if (v.kind === 'text') return s.kind === 'check';
  const p = percentOf(e, s);
  return p !== null && !gtePct(p, s.passRate);
}

export function classifyRoster(
  entries: Entries,
  s: ScoringScheme,
  n: number,
  opts: { honorIncludesA: boolean },
): RosterGroups {
  const g: RosterGroups = {
    honor: [],
    needsFix: [],
    corrected: [],
    notSubmitted: [],
    leave: [],
    passed: [],
    madeUp: [],
  };

  for (let no = 1; no <= n; no++) {
    const e = entries[String(no)];

    // 规则 1：请假
    if (e?.status === 'leave') { g.leave.push(no); continue; }
    // 规则 2：缺交且无补交
    if (e?.status === 'missing' && !e.makeup) { g.notSubmitted.push(no); continue; }
    // 规则 3：缺交但已补交（尚未补录值）
    if (e?.status === 'missing' && e.makeup) { g.madeUp.push(no); continue; }
    // 规则 4：过关
    if (e?.pass || e?.value?.kind === 'pass') {
      g.passed.push(no);
      if (e.makeup) g.madeUp.push(no);
      continue;
    }
    // 规则 9：无值无状态 → 未提交（空白）
    if (!e?.value) { g.notSubmitted.push(no); continue; }

    if (e.makeup) g.madeUp.push(no);

    // 规则 5：光荣榜
    if (inHonor(e, s, opts.honorIncludesA)) { g.honor.push(no); continue; }

    // 规则 6/7/8：需更正（已盖章则同时进 corrected 子集，人不从 needsFix 拿掉）
    if (inNeedsFix(e, s, opts.honorIncludesA)) {
      g.needsFix.push(no);
      if (e.stamp === 'corrected') g.corrected.push(no);
    }
    // 其余（分数制的良好/及格档）不进任何名单
  }

  return g;
}

/** 名单总人数（用于提示条） */
export function rosterCount(g: RosterGroups): number {
  return g.honor.length + g.needsFix.length + g.notSubmitted.length + g.leave.length + g.passed.length;
}
