import type { Entries, ScoringScheme, SessionMetrics } from './types';
import { percentOf, tierOfPercent } from './scoring';
import { round1 } from './round';

/**
 * 统计引擎（设计 04 §6.2，PRD-V2 §2.4）—— 纯函数。
 *
 * 三个恒等式（单测必须断言）：
 *   1) entered + leave + notSubmitted = N
 *   2) excellent + good + pass + fail = entered   （INV-3）
 *   3) missing ≤ notSubmitted
 */
export function computeStats(
  entries: Entries,
  s: ScoringScheme,
  n: number,
  honorIncludesA: boolean,
): SessionMetrics {
  void honorIncludesA; // 签名照抄设计；荣誉口径只影响名单，不影响四档

  let entered = 0;
  let excellent = 0;
  let good = 0;
  let pass_ = 0;
  let fail = 0;
  let missing = 0;
  let leave = 0;
  let madeUp = 0;
  let passCount = 0;
  let sum = 0;
  let max: number | null = null;
  let min: number | null = null;

  for (let no = 1; no <= n; no++) {
    const e = entries[String(no)];
    if (!e) continue;                        // 空白
    if (e.status === 'leave') { leave++; continue; }
    if (e.status === 'missing' && !e.makeup) missing++;   // §2.4：已补交单独计 madeUp
    if (e.makeup) madeUp++;
    if (e.pass) passCount++;

    const p = percentOf(e, s);
    if (p === null) continue;

    entered++;
    sum += p;
    const t = tierOfPercent(p, s);
    if (t === 'excellent') excellent++;
    else if (t === 'good') good++;
    else if (t === 'pass') pass_++;
    else fail++;

    max = max === null ? p : Math.max(max, p);
    min = min === null ? p : Math.min(min, p);
  }

  const avgPercent = entered ? round1(sum / entered) : null;
  const avgScore = entered && s.maxScore ? round1((sum / entered) / 100 * s.maxScore) : null;

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
    excellentRate: entered ? round1((excellent / entered) * 100) / 100 : null,
    qualifiedRate: entered ? round1(((excellent + good + pass_) / entered) * 100) / 100 : null,
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
