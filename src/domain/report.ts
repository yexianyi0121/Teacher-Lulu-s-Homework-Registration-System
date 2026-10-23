import type { RosterGroups, SheetTemplateId } from './types';
import { REPORT_SEP, SHEET_TEMPLATES } from './constants';
import { formatDateCN } from './date';
import { wrapTokens } from './wrap';

/**
 * 报表文案（设计 04 §6.4，PRD-V2 §2.3.2）—— 纯函数，逐字对齐。
 *
 * 段落顺序（唯一）：光荣榜 → 已过关 → 暂未提交 → 已补交 → 需更正（含 ⤷ 已更正 子段）→ 请假
 * 规则：
 *   - 班级行恒输出（§16-5 / INV-11）
 *   - 【暂未提交】恒输出，空写「（无）」；其余段空则整段省略（含标题）
 *   - 【已更正】是【需更正】的子集，不从需更正里拿掉
 */
export const T = {
  honor: '🏆 【光荣榜】本次表现优异/全对的同学：',
  passed: '✅ 【已过关】：',
  notSubmitted: '❌ 【暂未提交】：',
  madeUp: '📥 【已补交】：',
  needsFix: '⚠️ 【需更正】：',
  needsFixHint: '（请核对后及时找老师更正）',
  corrected: '   ⤷ 【✅ 已更正】：',
  leave: '🏖️ 【请假】：',
  none: '（无）',
} as const;

export interface ReportArgs {
  date: string;
  content: string;
  templateId: SheetTemplateId;
  /** 自定义类型名（≤6 字）；非空时覆盖模板默认名 */
  customName?: string;
  className: string;
  groups: RosterGroups;
  /** 补交说明：学号 → note */
  notes?: Record<number, string>;
  n: number;
}

export function buildReport(args: ReportArgs): string {
  const { date, content, templateId, customName, className, groups, notes } = args;
  const tpl = SHEET_TEMPLATES[templateId];
  const icon = tpl.icon;
  const name = templateId === 'custom' && customName?.trim() ? customName.trim() : tpl.name;
  const shownContent = content.trim() ? content : '未填写';

  const { honor, passed, notSubmitted, madeUp, needsFix, corrected, leave } = groups;

  const lines: string[] = [
    `🌸 ${formatDateCN(date)} 【${icon} ${name}】综合反馈 🌸`,
    `📖 作业内容：${shownContent}`,
    REPORT_SEP,
    `🏫 班级：${className}`,
  ];

  if (honor.length > 0) {
    lines.push(T.honor, fmtList(honor), '');
  }

  if (passed.length > 0) {
    lines.push(`${T.passed}${fmtList(passed)}`, '');
  }

  lines.push(T.notSubmitted, notSubmitted.length ? fmtList(notSubmitted) : T.none, '');

  if (madeUp.length > 0) {
    lines.push(`${T.madeUp}${fmtListWithNotes(madeUp, notes)}`, '');
  }

  if (needsFix.length > 0) {
    lines.push(T.needsFix, fmtList(needsFix));
    if (corrected.length > 0) {
      lines.push('', `${T.corrected}${fmtList(corrected)}`);
    }
    lines.push(T.needsFixHint);
  }

  if (leave.length > 0) {
    if (needsFix.length > 0) lines.push('');
    lines.push(`${T.leave}${fmtList(leave)}`);
  }

  return lines.join('\n');
}

/** 名单格式化：`N号、` 连接，按 70 半角单位折行，行尾无顿号 */
export function fmtList(nos: number[], maxWidth = 70): string {
  if (nos.length === 0) return '';
  return wrapTokens(
    nos.map((n) => `${n}号、`),
    maxWidth,
    '、',
  )
    .map((l) => l.replace(/、$/, ''))
    .join('\n');
}

/** 补交名单：`N号（说明）`，说明为空则只写 `N号` */
export function fmtListWithNotes(
  nos: number[],
  notes?: Record<number, string>,
  maxWidth = 70,
): string {
  if (nos.length === 0) return '';
  return wrapTokens(
    nos.map((n) => {
      const note = notes?.[n]?.trim();
      return note ? `${n}号（${note}）、` : `${n}号、`;
    }),
    maxWidth,
    '、',
  )
    .map((l) => l.replace(/、$/, ''))
    .join('\n');
}
