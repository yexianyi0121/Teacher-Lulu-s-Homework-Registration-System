import type { ScoringScheme, SheetTemplateId } from './types';
import { schemeAllowsGrade, schemeAllowsScore } from './scoring';
import { buildGradeKeyMap, describeKeyMap, type KeyMap } from './keymap';
import { resolveDigitMeaning, type DigitMeaning } from './digitKey';

/**
 * 录入提示（设计 06 §3.3，V4 ADR-22 扩展）—— 由方案与键位动态生成，废除 HINT_TEXT 常量。
 * 提示语必须与真实键盘行为一致：听写 0=全对、1–9=错几；等级按启用档位左到右绑定；
 * 数字键语义（grade/score）由 resolveDigitMeaning 裁决，提示条与内核永远同源。
 */
export function buildHint(
  t: SheetTemplateId,
  s: ScoringScheme,
  km: KeyMap = buildGradeKeyMap(s),
  meaning: DigitMeaning = resolveDigitMeaning(undefined, s, t),
  /**
   * v2.6.7 体验优化：提示条左侧已经把「按键 = 等级」做成一排色块时，
   * 文字里再列一遍 `1 A+ 2 A …` 就是同一份信息说两遍，只会把提示条挤满。
   * 置为 true 时文字只保留「数字＝等级」，具体键位交给色块。
   */
  keysInChips = false,
): string {
  const keysText = keysInChips ? '数字＝等级' : describeKeyMap(km);
  // 三种默认组合按 PRD FR-32.4 的原文输出（评审会逐字看提示条）
  if (t === 'dictation' && !schemeAllowsScore(s) && !schemeAllowsGrade(s)) {
    return '💡 错几：输入 0–9（0=全对）· 空格 盖章 · X 缺交 · L 请假 · G 手打过关';
  }
  if (t === 'homework' && s.kind === 'grade') {
    return `💡 ${keysText} · 空格 盖章 · X 缺交 · L 请假`;
  }
  if (t === 'quality' && s.kind === 'score') {
    return '💡 输入分数后按【Enter】跳下一格 · F2 自定义文字 · X 缺交 · L 请假';
  }

  // 其余组合（老师改过方案 / 混合表）：按能力 + 当前数字键语义拼接，
  // 保证「能录什么就提示什么」，且与内核实际行为一致
  const parts: string[] = [];
  if (meaning === 'grade' && schemeAllowsGrade(s)) {
    parts.push(keysText);
    if (schemeAllowsScore(s)) parts.push('按 ` 切「数字＝分数」');
  }
  if (meaning === 'score' && schemeAllowsScore(s)) {
    parts.push(schemeAllowsGrade(s) ? '数字＝分数，Enter 提交（按 ` 切回等级）' : '输入分数后按【Enter】跳下一格');
  }
  if (meaning === 'dictation' && (s.kind === 'check' || s.allowCheck)) {
    parts.push('错几：输入 0–9（0=全对）');
  }
  if (!parts.length) parts.push('输入 0–9（0=全对）');

  if (s.allowText || s.kind === 'mixed' || s.kind === 'text') parts.push('F2 自定义文字');
  parts.push('空格 盖章', 'X 缺交', 'L 请假');
  if (s.kind === 'check' || s.allowCheck || t === 'dictation') parts.push('G 手打过关');

  return `💡 ${parts.join(' · ')}`;
}
