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

/**
 * v2.5.10 FR-68.1：等级的可见表示（按键 → 等级），提示条与方案面板复用。
 * 老师的原话：“开启了 A- 或 B- 后，界面的提示语里不变，那用户怎么知道哪个按键是 A- 哪个是 B-”。
 * 原提示是一行可能被截断的纯文字，现在改为一组小片，每片都是“按键=等级”。
 */
export function keyMapPairs(km: KeyMap): Array<{ key: string; grade: GradeLetter }> {
  return Object.entries(km)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, g]) => ({ key: k, grade: g as GradeLetter }));
}
