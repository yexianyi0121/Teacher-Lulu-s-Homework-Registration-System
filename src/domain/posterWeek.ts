import type { PersistedStateV4 } from './types';
import { addDaysISO, formatDateCN, weekRange, weekStartOf, dayHeading } from './date';
import { snapshotDay, hasContent } from './summary';
import { cellsOf, sectionStatLine, type PosterDisplayOptions, type SummarySection } from './poster';

/**
 * 本周汇总（V3 设计 06 §3.7 / PRD FR-43）—— 纯函数。
 * 7 天按 ISO 周一→周日拼接；1:1 像素，不分栏不缩放；超过 16000px 自动分卷。
 */

export const WEEK_MAX_HEIGHT = 16000;

export interface WeekPart {
  date: string;
  /** '10月20日 周一' */
  heading: string;
  sheets: SummarySection[];
  empty: boolean;
}

export interface WeekModel {
  title: string;
  subtitle: string;
  /** 分卷后的每页（每页 1~7 天） */
  pages: WeekPart[][];
  comment: string;
  schoolLine: string;
  totalSheets: number;
}

/** 把某班某周（7 天）的登记按日分组；无登记的日期也保留（图上显示「当日无登记」） */
export function groupWeek(
  state: Pick<PersistedStateV4, 'classes' | 'records' | 'history' | 'settings'>,
  classId: string,
  weekStart: string,
  display: PosterDisplayOptions,
): WeekPart[] {
  const n = state.classes.find((c) => c.id === classId)?.count ?? 0;
  const start = weekStartOf(weekStart);

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(start, i);
    const snaps = snapshotDay(state as PersistedStateV4, classId, date).filter(hasContent);
    const sheets: SummarySection[] = snaps.map((s) => ({
      key: s.key,
      icon: s.icon,
      sheetName: s.sheetName,
      content: s.content,
      statLine: sectionStatLine(s, n, display.passRule),
      cells: cellsOf(s.entries, s.scheme, n, display),
      createdAt: s.createdAt,
    }));
    return { date, heading: dayHeading(date), sheets, empty: sheets.length === 0 };
  });
}

/** 高度估算：日期头 72 + 每张表（标题 56 + 行数 × 32） */
export function estimateWeekPart(p: WeekPart): number {
  let h = 72;
  for (const s of p.sheets) h += 56 + Math.ceil(s.cells.length / 10) * 32;
  return h;
}

/**
 * 分卷：贪心装页，单页上限 max。
 * 单日超过上限时该日独占一页（不拆日，避免一张表被切成两半）。
 */
export function paginateWeek(
  parts: WeekPart[],
  estimate: (p: WeekPart) => number,
  max = WEEK_MAX_HEIGHT,
): WeekPart[][] {
  const pages: WeekPart[][] = [];
  let cur: WeekPart[] = [];
  let h = 0;

  for (const p of parts) {
    const ph = estimate(p);
    if (cur.length > 0 && h + ph > max) {
      pages.push(cur);
      cur = [];
      h = 0;
    }
    cur.push(p);
    h += ph;
  }
  if (cur.length > 0) pages.push(cur);
  return pages.length ? pages : [[]];
}

export function buildWeekModel(args: {
  className: string;
  weekStart: string;
  state: Pick<PersistedStateV4, 'classes' | 'records' | 'history' | 'settings'>;
  classId: string;
  display: PosterDisplayOptions;
  comment?: string;
  school?: string;
  showSchoolInPoster?: boolean;
}): WeekModel {
  const { className, weekStart, state, classId, display, comment, school, showSchoolInPoster } = args;
  const start = weekStartOf(weekStart);
  const parts = groupWeek(state, classId, start, display);
  const pages = paginateWeek(parts, estimateWeekPart);

  return {
    title: `🌸 ${className} · ${formatDateCN(start)}~${formatDateCN(addDaysISO(start, 6))} 周汇总 🌸`,
    subtitle: `本周 ${weekRange(start)} · 共 ${parts.reduce((n, p) => n + p.sheets.length, 0)} 张登记`,
    pages,
    comment: (comment ?? '').trim(),
    schoolLine: showSchoolInPoster ? (school ?? '').trim() : '',
    totalSheets: parts.reduce((n, p) => n + p.sheets.length, 0),
  };
}
