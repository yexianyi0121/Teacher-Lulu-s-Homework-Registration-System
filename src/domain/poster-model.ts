import type { CellTone, CellValue, Entries, Mode, Settings, Stamp } from './types';
import { MODE_EMOJI, MODE_LABEL } from './constants';
import { formatDateCN } from './date';
import { cellText, cellTone } from './tone';

export interface PosterCell {
  no: number;
  text: string;
  tone: CellTone;
  stamp: Stamp;
  value: CellValue | null;
}

export interface PosterModel {
  title: string;
  mode: Mode;
  badges: { mode: string; date: string; content: string | null };
  cells: PosterCell[];
  footer: string;
  columns: number;
  rows: number;
}

/**
 * 海报数据模型（设计 §6.6 / §8.5，纯函数）
 * 取值域恒为 1..n；不输出姓名与统计信息（PRD BR-24）。
 */
export function buildPosterModel(args: {
  subject: string;
  teacher: string;
  school: string;
  date: string;
  content: string;
  mode: Mode;
  entries: Entries;
  n: number;
  settings: Settings;
}): PosterModel {
  const { subject, teacher, school, date, content, mode, entries, n, settings } = args;

  const cells: PosterCell[] = [];
  for (let no = 1; no <= n; no++) {
    const entry = entries[String(no)];
    const value = entry?.value ?? null;
    cells.push({
      no,
      text: cellText(value),
      tone: cellTone(mode, value, settings),
      stamp: entry?.stamp ?? 'none',
      value,
    });
  }

  return {
    title: `🌸 ${subject}作业反馈 🌸`,
    mode,
    badges: {
      mode: `${MODE_EMOJI[mode]} ${MODE_LABEL[mode]}`,
      date: `📅 ${formatDateCN(date)}`,
      content: content.trim() ? `📖 ${content}` : null,
    },
    cells,
    footer: posterFooter(teacher, school),
    columns: 10,
    rows: Math.ceil(n / 10),
  };
}

/** 页脚署名（PRD BR-21） */
export function posterFooter(teacher: string, school: string): string {
  const t = teacher.trim();
  const s = school.trim();
  if (t && s) return `© Designed by ${t} | ${s}`;
  if (t) return `© Designed by ${t}`;
  if (s) return `© ${s}`;
  return '© Designed by 一位老师';
}
