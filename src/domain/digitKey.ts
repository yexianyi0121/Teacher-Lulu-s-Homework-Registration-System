import { schemeAllowsGrade, schemeAllowsScore } from './scoring';
import type { ScoringScheme, SheetTemplateId } from './types';

/**
 * 数字键语义（V4 设计 09 ADR-22 / FR-46）
 *
 * 背景：mixed 方案下 1..7 既可当等级键也可当分数首位。V3 的内核「先分数后等级」，
 * 于是敲 `1` 得到「1 分」，而提示条却写着「1 A+」——提示与行为不一致。
 *
 * 裁决集中在**这一个纯函数**：UI（chip 文案、提示条）与内核（useInputEngine）都只能问它，
 * 不得各自判断。auto 模式下 mixed 解析为 grade（混合表的主用途是打等级）。
 */

export type DigitKeyMode = 'auto' | 'grade' | 'score';
export type DigitMeaning = 'grade' | 'score' | 'dictation';

export const DEFAULT_DIGIT_KEY: DigitKeyMode = 'auto';

const MODES: DigitKeyMode[] = ['auto', 'grade', 'score'];

function normMode(mode: DigitKeyMode | undefined | null): DigitKeyMode {
  return mode && MODES.includes(mode) ? mode : DEFAULT_DIGIT_KEY;
}

/** 解析「这个表当前按下去的数字键是什么意思」 */
export function resolveDigitMeaning(
  mode: DigitKeyMode | undefined | null,
  scheme: ScoringScheme,
  templateId: SheetTemplateId,
): DigitMeaning {
  void templateId; // 语义只由方案决定；模板参数保留供将来按模板微调
  const m = normMode(mode);
  if (m !== 'auto') return m;
  if (scheme.kind === 'check') return 'dictation';
  if (schemeAllowsScore(scheme) && !schemeAllowsGrade(scheme)) return 'score';
  if (schemeAllowsGrade(scheme)) return 'grade'; // grade / mixed 都走这里
  return 'score';
}

/** auto → grade → score → auto（chip 点击与反引号快捷键共用） */
export function nextDigitKeyMode(mode: DigitKeyMode | undefined | null): DigitKeyMode {
  const i = MODES.indexOf(normMode(mode));
  return MODES[(i + 1) % MODES.length];
}

/**
 * chip / 快捷键实际使用的推进方式（FR-46.3「点击即切换」必须可见）：
 * 按**当前生效语义**推进，而不是按 mode 原值。
 * 否则 mixed 表里 auto 本就解析为 grade，点一次 auto→grade 视觉毫无变化，
 * 老师会以为 chip 坏了。于是：生效「等级」→ score；生效「分数」→ 回 auto。
 */
export function nextDigitKeyModeFor(
  mode: DigitKeyMode | undefined | null,
  scheme: ScoringScheme,
  templateId: SheetTemplateId,
): DigitKeyMode {
  return resolveDigitMeaning(mode, scheme, templateId) === 'grade' ? 'score' : 'auto';
}

/** chip 文案按「当前生效的语义」显示，不按 mode 原值（auto 要能看出实际是等级还是分数） */
export function describeDigitMeaning(meaning: DigitMeaning): string {
  return meaning === 'score' ? '数字＝分数' : '数字＝等级';
}

/**
 * 只有「同一数字键有两种语义」的方案才显示 chip（mixed）。
 * 纯分数 / 纯等级 / 听写没有歧义，显示只会增加噪音（FR-46.6 / AC-87）。
 */
export function digitKeyAmbiguous(scheme: ScoringScheme): boolean {
  return schemeAllowsGrade(scheme) && schemeAllowsScore(scheme);
}
