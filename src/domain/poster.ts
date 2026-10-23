import type {
  CellTone,
  Entries,
  SheetTemplateId,
  Stamp,
  EntryStatus,
  ScoringScheme,
} from './types';
import { SHEET_TEMPLATES } from './constants';
import { formatDateCN, formatDateFullCN, weekdayCN } from './date';
import { cellDisplay } from './tone';
import { tierOf } from './scoring';
import { round1 } from './round';
import type { DaySheetSnapshot } from './summary';

/**
 * 海报数据模型（设计 04 §6.5 / §6.6）—— 纯函数。
 * 单条海报沿用 V1 版式；当日汇总为多 section 长图。
 */

export interface PosterCell {
  no: number;
  text: string;
  tone: CellTone;
  stamp: Stamp;
  status: EntryStatus;
  pass: boolean;
  makeup: boolean;
}

export interface PosterModel {
  title: string;
  badges: { mode: string; className: string; date: string; content: string | null };
  cells: PosterCell[];
  footer: string;
  columns: number;
  rows: number;
}

export interface PosterArgs {
  className: string;
  subject: string;
  date: string;
  content: string;
  templateId: SheetTemplateId;
  customName?: string;
  scheme: ScoringScheme;
  entries: Entries;
  n: number;
  teacher: string;
  school: string;
}

function cellsOf(entries: Entries, scheme: ScoringScheme, n: number): PosterCell[] {
  const out: PosterCell[] = [];
  for (let no = 1; no <= n; no++) {
    const e = entries[String(no)];
    const d = cellDisplay(e, scheme);
    out.push({
      no,
      text: d.text,
      tone: d.tone,
      stamp: e?.stamp ?? 'none',
      status: e?.status ?? 'normal',
      pass: e?.pass ?? false,
      makeup: !!e?.makeup,
    });
  }
  return out;
}

export function buildPosterModel(args: PosterArgs): PosterModel {
  const { className, subject, date, content, templateId, customName, scheme, entries, n, teacher, school } = args;
  const tpl = SHEET_TEMPLATES[templateId];
  const name = templateId === 'custom' && customName?.trim() ? customName.trim() : tpl.name;

  return {
    title: `🌸 ${className} · ${subject}作业反馈 🌸`,
    badges: {
      mode: `${tpl.icon} ${name}`,
      className: `🏫 ${className}`,
      date: `📅 ${formatDateCN(date)}`,
      content: content.trim() ? `📖 ${content}` : null,
    },
    cells: cellsOf(entries, scheme, n),
    footer: posterFooter(teacher, school),
    columns: 10,
    rows: Math.ceil(n / 10),
  };
}

/** 页脚署名（PRD BR-21 沿用） */
export function posterFooter(teacher: string, school: string): string {
  const t = teacher.trim();
  const s = school.trim();
  if (t && s) return `© Designed by ${t} | ${s}`;
  if (t) return `© Designed by ${t}`;
  if (s) return `© ${s}`;
  return '© Designed by 一位老师';
}

/* ---------------- 当日汇总（§6.6.2） ---------------- */

export interface SummarySection {
  key: string;
  icon: string;
  sheetName: string;
  content: string;
  statLine: string;
  cells: PosterCell[];
  createdAt: number;
}

export interface SummaryModel {
  title: string;
  subtitle: string;
  sections: SummarySection[];
  footer: string;
  columns: number;
  empty: boolean;
}

/** section 右侧统计：按类型取最相关的 2–3 项，不出现该表不适用的字段（PRD FR-24-4） */
export function sectionStatLine(s: DaySheetSnapshot, n: number): string {
  void n;
  const m = s.metrics;
  if (s.templateId === 'dictation') {
    const passed = m.passCount;
    const notPassed = Math.max(0, m.entered - passed);
    return `过关 ${passed} · 未过关 ${notPassed}`;
  }
  if (s.templateId === 'homework' || s.scheme.kind === 'grade') {
    const counts = new Map<string, number>();
    for (const e of Object.values(s.entries)) {
      if (e.value?.kind === 'grade') counts.set(e.value.grade, (counts.get(e.value.grade) ?? 0) + 1);
    }
    const order = ['A+', 'A', 'A-', 'B+', 'B', 'C', 'D'];
    const parts = order.filter((g) => counts.get(g)).map((g) => `${g} ${counts.get(g)}`);
    const notSubmitted = m.notSubmitted;
    return [...parts.slice(0, 4), `未交 ${notSubmitted}`].join(' · ');
  }
  const avg = m.avgScore ?? m.avgPercent;
  return `平均 ${avg === null ? '—' : round1(avg)} · 优秀 ${m.excellent} · 未交 ${m.notSubmitted}`;
}

export function buildSummaryModel(args: {
  className: string;
  date: string;
  teacher: string;
  school: string;
  sheets: DaySheetSnapshot[];
  n: number;
}): SummaryModel {
  const { className, date, teacher, school, sheets, n } = args;
  const sections: SummarySection[] = sheets.slice(0, 6).map((s) => ({
    key: s.key,
    icon: s.icon,
    sheetName: s.sheetName,
    content: s.content,
    statLine: sectionStatLine(s, n),
    cells: cellsOf(s.entries, s.scheme, n),
    createdAt: s.createdAt,
  }));

  return {
    title: `🌸 ${className} · ${formatDateCN(date)} 登记汇总 🌸`,
    subtitle: `${formatDateFullCN(date)} ${weekdayCN(date)}`,
    sections,
    footer: posterFooter(teacher, school),
    columns: 10,
    empty: sections.length === 0,
  };
}

/** 汇总图超出 6 项时的提示（PRD FR-24-2） */
export function summaryOverflowNote(total: number): string {
  if (total <= 6) return '';
  const more = total - 6;
  return `（今日共 ${total} 项，仅展示最近 6 项，另有 ${more} 项未展示）`;
}

/** 某 section 是否有值（空表也画，但统计显示 0；图上一眼能看出没录） */
export function sectionHasValue(cells: PosterCell[]): boolean {
  return cells.some((c) => c.text !== '');
}

/** 档位文字（供测试与调试） */
export function tierTextOf(s: ScoringScheme, inputs: Parameters<typeof tierOf>[0]): string {
  const t = tierOf(inputs, s);
  return t ?? '';
}
