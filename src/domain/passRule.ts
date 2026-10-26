import type { Entry, PassRule, ScoringScheme } from './types';
import { percentOf } from './scoring';
import { gtePct } from './round';
import { classifyDictation } from './grading';

/**
 * 过关判定（设计 06 §3.1）—— **全系统唯一入口**。
 * 任何 UI 都不得自己写「pass 或 percent >= xx」，否则 V2「未过关恒 0」的散落判定会重演。
 */

export const DEFAULT_PASS_RULE: PassRule = {
  kind: 'mixed',
  gradePass: ['A+', 'A'],
  dictationAutoPass: true,
};

export function isPassed(e: Entry | undefined, s: ScoringScheme, rule: PassRule): boolean {
  if (!e) return false;
  // v2.6.2 FR-71.3：缺交 / 请假是否算过关由老师自己选（默认不算，与 V2 起一直如此）。
  // 旧数据没有 missingPass / leavePass 字段，undefined → false，行为不变。
  if (e.status === 'missing') return !!rule.missingPass;
  if (e.status === 'leave') return !!rule.leavePass;
  if (e.pass || e.value?.kind === 'pass') return true;      // 手打 √（含 V1 迁移的 {kind:'pass'}）

  const p = percentOf(e, s);
  if (p !== null) {
    // kind='grade'：等级值只看白名单（PRD AC-32.2：改成 A/A+ 后 A- 必须退出过关）；
    // 分数值仍看及格线（老师不会因为选了等级白名单就让 85 分变未过关）。
    if (rule.kind === 'grade' && e.value?.kind === 'grade') {
      return rule.gradePass.includes(e.value.grade);
    }
    if (gtePct(p, s.passRate)) return true;
    if (e.value?.kind === 'grade' && rule.kind === 'mixed') {
      return rule.gradePass.includes(e.value.grade);
    }
    return false;
  }

  if (e.value?.kind === 'text') {
    const k = classifyDictation(e.value.text);
    return rule.dictationAutoPass && k.kind === 'perfect';
  }
  return false;
}

/** 是否「手工过关」（用于区分格子主值 √ 与自动 ✅ 角标） */
export function isManualPass(e: Entry | undefined): boolean {
  return !!e && (e.pass || e.value?.kind === 'pass');
}
