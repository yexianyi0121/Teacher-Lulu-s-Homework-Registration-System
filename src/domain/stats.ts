import type { Entries, Mode, SessionMetrics, Settings } from './types';
import { classifyDictation } from './grades';
import { round1, toTenthInt } from './round';

/**
 * 统计引擎（设计 §6.3 + PRD §6.6，【必须】纯函数）
 * N 恒取自 s.count（唯一人数来源）：人数调小后隐藏键仍在 entries 里，不得反推。
 *
 * 四档字段在三模式下都保证「互斥且穷尽」，即恒有
 *   excellent + good + pass + fail === entered
 * 各模式的档位含义（PRD §6.6 的可加等式）：
 *   - quiz     ：优秀 / 良好 / 及格 / 不及格
 *   - homework ：A+ / A / √ / A-        （PRD §6.6「n = A+ + A + A- + √」）
 *   - dictation：全对 / 有错 / 其他 / —— （PRD §6.6「n = 全对 + 有错 + 其他」，无第四档）
 * 设计 §6.3 的旧映射里 homework 的 √ 不入档、dictation 的「错≥4」会在 good 之上再 +fail，
 * 都会破坏可加性（同一人双计），故此处按 PRD 优先原则取 PRD §6.6 的口径。
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
          // √ = 已交未评级，PRD §6.6 里单列一档，记为 pass，保证四档之和 = 录入人数
          entered++;
          pass++;
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
      // 全对 / 有错 / 其他 —— 一人只进一档，不再对「错≥4」额外计 fail（否则同一人双计）
      if (k.kind === 'perfect') excellent++;
      else if (k.kind === 'error') good++;
      else pass++;
    }
  }

  // 未提交 = N − 录入人数（含空格子、×、缺交、盖章但无值）——保证可加性
  const notSubmitted = Math.max(0, s.count - entered);
  const isQuiz = mode === 'quiz';
  const avg = isQuiz && entered > 0 ? round1(sum / entered) : null;
  // 优秀率只对单元测试有意义（PRD §6.1.2：常规/听写无平均分、无四档）
  const excellentRate = isQuiz && entered > 0 ? round1((excellent / entered) * 100) : null;

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
    max: isQuiz ? max : null,
    min: isQuiz ? min : null,
  };
}
