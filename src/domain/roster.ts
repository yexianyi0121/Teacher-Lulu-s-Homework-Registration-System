import type { Entries, Mode, RosterGroups, Settings } from './types';
import { classifyDictation } from './grades';
import { toTenthInt } from './round';

/**
 * 四组名单分拣（设计 §6.4 / PRD §6.1.1 / §6.6，【必须】纯函数）
 *
 * 判定优先级：暂未提交 > 需更正（未盖章）/ 已更正（盖章） > 光荣榜
 * 取值域恒为 1..s.count，不额外传 n；排序一律按学号升序。
 */
export function classifyRoster(mode: Mode, entries: Entries, s: Settings): RosterGroups {
  const honor: number[] = [];
  const notSubmitted: number[] = [];
  const needsFix: number[] = [];
  const fixed: number[] = [];

  for (let no = 1; no <= s.count; no++) {
    const e = entries[String(no)];
    const v = e?.value ?? null;
    const corrected = e?.stamp === 'corrected';

    if (mode === 'homework') {
      if (!v || v.kind !== 'grade' || v.grade === 'CROSS') {
        notSubmitted.push(no);
        continue;
      }
      if (v.grade === 'A-') {
        if (corrected) fixed.push(no);
        else needsFix.push(no);
        continue;
      }
      if (v.grade === 'A+' || (v.grade === 'A' && s.honorIncludesA)) honor.push(no);
      continue;
    }

    if (mode === 'quiz') {
      if (!v || v.kind !== 'score') {
        notSubmitted.push(no);
        continue;
      }
      const t = toTenthInt(v.score);
      if (t < toTenthInt(s.passLine)) {
        if (corrected) fixed.push(no);
        else needsFix.push(no);
        continue;
      }
      if (t >= toTenthInt(s.excellentLine)) honor.push(no);
      continue;
    }

    // dictation
    if (!v || v.kind !== 'text') {
      notSubmitted.push(no);
      continue;
    }
    const k = classifyDictation(v.text);
    if (k.kind === 'missing') {
      notSubmitted.push(no);
      continue;
    }
    if (k.kind === 'perfect') {
      honor.push(no);
      continue;
    }
    if (k.kind === 'error' && k.errors >= 1) {
      if (corrected) fixed.push(no);
      else needsFix.push(no);
    }
  }

  return { honor, notSubmitted, needsFix, fixed };
}
