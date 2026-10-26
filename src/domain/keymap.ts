import type { GradeLetter, ScoringScheme } from './types';
import { GRADE_ORDER } from './constants';

/**
 * 等级键位（设计 06 §3.3）—— 键位恒为 1..7（v2.5.9：八档启用时为 1..8），按方案启用的等级从左到右依次绑定。
 * 不再硬编码「1 A+ 2 A 3 A- 4 B 5 C 6 D」。
 */

export interface KeyMap {
  [key: string]: GradeLetter;
}

export function buildGradeKeyMap(s: ScoringScheme): KeyMap {
  const enabled = GRADE_ORDER.filter((g) => s.grades.includes(g));
  const map: KeyMap = {};
  enabled.forEach((g, i) => {
    if (i < 8) map[String(i + 1)] = g;
  });
  return map;
}

/** 反查：等级 → 键位（用于提示语与设置面板） */
export function gradeKeyOf(km: KeyMap, g: GradeLetter): string | null {
  for (const [k, v] of Object.entries(km)) if (v === g) return k;
  return null;
}

/** 提示语里有几档就列几档，如 "1 A+ 2 A 3 A-" */
export function describeKeyMap(km: KeyMap): string {
  return Object.entries(km)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, g]) => `${k} ${g}`)
    .join(' ');
}
