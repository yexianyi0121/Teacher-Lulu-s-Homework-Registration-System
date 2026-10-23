import type { Mode, RosterGroups } from './types';
import { MODE_EMOJI, MODE_LABEL, REPORT_SEP } from './constants';
import { formatDateCN } from './date';
import { wrapTokens } from './wrap';

/**
 * 报表文案生成（设计 §6.5，【必须】纯函数，逐字对齐 PRD §6.2 / §7.1.3）
 */
export function buildReport(args: {
  date: string;
  content: string;
  mode: Mode;
  groups: RosterGroups;
  n: number;
}): string {
  const { date, content, mode, groups } = args;
  const emoji = MODE_EMOJI[mode];
  const name = MODE_LABEL[mode];
  const shownContent = content.trim() ? content : '未填写';

  const { honor, notSubmitted, needsFix, fixed } = groups;
  const isEmpty =
    honor.length === 0 && notSubmitted.length === 0 && needsFix.length === 0 && fixed.length === 0;

  if (isEmpty) {
    return [
      `🌸 ${formatDateCN(date)} 综合反馈 🌸`,
      `📖 作业内容：${shownContent}`,
      '（暂无可统计的数据）',
    ].join('\n');
  }

  const lines: string[] = [
    `🌸 ${formatDateCN(date)} 【${emoji} ${name}】综合反馈 🌸`,
    `📖 作业内容：${shownContent}`,
    REPORT_SEP,
  ];

  if (honor.length > 0) {
    lines.push('🏆 【光荣榜】本次表现优异/全对的同学：');
    lines.push(fmtList(honor));
    lines.push('');
  }

  if (notSubmitted.length > 0) {
    lines.push('❌ 【暂未提交】：');
    lines.push(fmtList(notSubmitted));
    lines.push('');
  }

  if (needsFix.length > 0) {
    lines.push('⚠️ 【需更正】：');
    lines.push(fmtList(needsFix));
  }

  if (fixed.length > 0) {
    if (needsFix.length > 0) lines.push('');
    lines.push('✅ 【已更正】：');
    lines.push(fmtList(fixed));
  }

  if (needsFix.length > 0) {
    lines.push('（请核对后及时找老师更正）');
  }

  return lines.join('\n');
}

/** 名单格式化：每项 `N号`、顿号连接、按 70 半角单位折行、行尾无顿号 */
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
