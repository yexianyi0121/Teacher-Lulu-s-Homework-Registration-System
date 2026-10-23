import type { Entries, PassRule, ScoringScheme, SessionMetrics } from './types';
import { percentOf, tierOfPercent } from './scoring';
import { DEFAULT_PASS_RULE, isPassed } from './passRule';
import { round1 } from './round';

/**
 * 统计引擎（设计 04 §6.2，PRD-V2 §2.4）—— 纯函数。
 *
 * 三个恒等式（单测必须断言）：
 *   1) entered + leave + notSubmitted = N
 *   2) excellent + good + pass + fail = graded（有百分的人数）≤ entered   （INV-3）
 *   3) missing ≤ notSubmitted
 *
 * ⚠️ `entered` 是「有登记的人」（有值 **或** 已过关），不是「有百分的人」：
 *    FR-21-2 规定过关时清空 value（`pass=true` / `value=null`），若 entered 只认 value，
 *    过关制的 entered 会恒为 0，进而 notSubmitted 恒等于全班人数、未过关恒为 0
 *    （v2.0.0 的真实缺陷 F1）。四档只统计能折算百分的值（设计 §16-18：听写「错N」不进四档），
 *    所以新增内部量 graded 作四档与均值的分母，保证 `sum(四档) = graded ≤ entered`。
 */
export function computeStats(
  entries: Entries,
  s: ScoringScheme,
  n: number,
  honorIncludesA: boolean,
  passRule: PassRule = DEFAULT_PASS_RULE,
): SessionMetrics {
  void honorIncludesA; // 签名照抄设计；荣誉口径只影响名单，不影响四档

  let entered = 0;
  let graded = 0;
  let excellent = 0;
  let good = 0;
  let pass_ = 0;
  let fail = 0;
  let missing = 0;
  let leave = 0;
  let madeUp = 0;
  let passCount = 0;
  let qualified = 0;
  let sum = 0;
  let max: number | null = null;
  let min: number | null = null;

  for (let no = 1; no <= n; no++) {
    const e = entries[String(no)];
    if (!e) continue;                        // 空白
    if (e.status === 'leave') { leave++; continue; }
    if (e.status === 'missing' && !e.makeup) missing++;   // §2.4：已补交单独计 madeUp
    if (e.makeup) madeUp++;

    // 过关是布尔位，值按 FR-21-2 会被清空，故单独计入 passCount 与「已登记」
    const hasPass = e.pass || e.value?.kind === 'pass';
    if (hasPass) passCount++;

    const p = percentOf(e, s);

    if (e.status === 'normal' && (e.value !== null || hasPass)) entered++;
    if (p === null) continue;

    graded++;
    sum += p;
    // 达标率走唯一入口 isPassed（老师改过关规则后统计条立即重算）
    if (isPassed(e, s, passRule)) qualified++;
    const t = tierOfPercent(p, s);
    if (t === 'excellent') excellent++;
    else if (t === 'good') good++;
    else if (t === 'pass') pass_++;
    else fail++;

    max = max === null ? p : Math.max(max, p);
    min = min === null ? p : Math.min(min, p);
  }

  const avgPercent = graded ? round1(sum / graded) : null;
  const avgScore = graded && s.maxScore ? round1((sum / graded) / 100 * s.maxScore) : null;

  return {
    n,
    entered,
    excellent,
    good,
    pass: pass_,
    fail,
    missing,
    leave,
    madeUp,
    notSubmitted: Math.max(0, n - entered - leave),   // 含缺交与空白
    avgPercent,
    avgScore,
    excellentRate: graded ? round1((excellent / graded) * 100) / 100 : null,
    qualifiedRate: graded ? round1((qualified / graded) * 100) / 100 : null,
    passCount,
    max: max === null ? null : round1(max),
    min: min === null ? null : round1(min),
  };
}

/** 空统计（新建班级 / 空记录时用） */
export function emptyStats(n: number): SessionMetrics {
  return {
    n,
    entered: 0,
    excellent: 0,
    good: 0,
    pass: 0,
    fail: 0,
    missing: 0,
    leave: 0,
    madeUp: 0,
    notSubmitted: n,
    avgPercent: null,
    avgScore: null,
    excellentRate: null,
    qualifiedRate: null,
    passCount: 0,
    max: null,
    min: null,
  };
}
