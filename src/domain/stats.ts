import type { Entries, Mode, SessionMetrics, Settings } from './types';
import { classifyDictation } from './grades';
import { round1, toTenthInt } from './round';

/**
 * 统计引擎（设计 §6.3，【必须】纯函数）
 * N 恒取自 s.count（唯一人数来源）：人数调小后隐藏键仍在 entries 里，不得反推。
 */
export function computeStats(mode: Mode, entries: Entries, s: Settings): SessionMetrics {
  let entered = 0;
  let sum = 0;
  let excellent = 0;
  let good = 0;
  let pass = 0;
  let fail = 0;
  let corrected = 0;
  let max: number | null = null;
  let min: number | null = null;

  for (let no = 1; no <= s.count; no++) {
    const e = entries[String(no)];
    if (e?.stamp === 'corrected') corrected++;

    const v = e?.value ?? null;
    if (!v) continue;

    if (mode === 'homework') {
      if (v.kind !== 'grade') continue;
      switch (v.grade) {
        case 'A+':
          entered++;
          excellent++;
          break;
        case 'A':
          entered++;
          if (s.honorIncludesA) excellent++;
          else good++;
          break;
        case 'A-':
          entered++;
          fail++;
          break;
        case 'CHECK':
          entered++;
          break;
        case 'CROSS':
          // × = 未提交，不计入录入人数
          break;
      }
    } else if (mode === 'quiz') {
      if (v.kind !== 'score') continue;
      const x = v.score;
      entered++;
      sum += x;
      max = max === null ? x : Math.max(max, x);
      min = min === null ? x : Math.min(min, x);

      const t = toTenthInt(x);
      if (t >= toTenthInt(s.excellentLine)) excellent++;
      else if (t >= 800) good++;
      else if (t >= toTenthInt(s.passLine)) pass++;
      else fail++;
    } else {
      if (v.kind !== 'text') continue;
      const k = classifyDictation(v.text);
      if (k.kind === 'missing') continue;
      entered++;
      if (k.kind === 'perfect') excellent++;
      else if (k.kind === 'error') {
        good++;
        if (k.errors >= 4) fail++;
      }
    }
  }

  // 未提交 = N − 录入人数（含空格子、×、缺交、盖章但无值）——保证可加性
  const notSubmitted = Math.max(0, s.count - entered);
  const avg = mode === 'quiz' && entered > 0 ? round1(sum / entered) : null;
  const excellentRate = entered > 0 ? round1((excellent / entered) * 100) : null;

  return {
    entered,
    avg,
    excellent,
    good,
    pass,
    fail,
    excellentRate,
    corrected,
    notSubmitted,
    max: mode === 'quiz' ? max : null,
    min: mode === 'quiz' ? min : null,
  };
}
