import type {
  CellTone,
  Entries,
  EntryStatus,
  GradeLetter,
  ScoringScheme,
  SheetTemplateId,
  Stamp,
} from './types';
import { SHEET_TEMPLATES } from './constants';
import { formatDateCN, formatDateFullCN, weekdayCN } from './date';
import { cellDisplay, type CellBadge, type CellKind } from './tone';
import { tierOf } from './scoring';
import { isPassed } from './passRule';
import { round1 } from './round';
import type { DaySheetSnapshot } from './summary';

/**
 * 海报数据模型（设计 04 §6.5 / V3 06 §3.6）—— 纯函数。
 * V3 变化：页脚改为「评价语 + 可选学校」，不再有 Designed by；统计行走 isPassed。
 */

export interface PosterDisplayOptions {
  showEmoji: boolean;
  gradeEmoji: Record<GradeLetter, string>;
}

export interface PosterCell {
  no: number;
  text: string;
  kind: CellKind;
  tone: CellTone;
  grade?: GradeLetter;
  emoji?: string;
  badge?: CellBadge;
  subText?: string;
  stamp: Stamp;
  status: EntryStatus;
  pass: boolean;
  makeup: boolean;
}

export interface PosterModel {
  title: string;
  badges: { mode: string; className: string; date: string; content: string | null };
  cells: PosterCell[];
  /** 评价语（可空）；V3 不再输出 © Designed by */
  comment: string;
  /** 学校署名行（开关打开时才有） */
  schoolLine: string;
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
  comment?: string;
  school?: string;
  showSchoolInPoster?: boolean;
  display: PosterDisplayOptions;
}

export function cellsOf(
  entries: Entries,
  scheme: ScoringScheme,
  n: number,
  opts: PosterDisplayOptions,
): PosterCell[] {
  const out: PosterCell[] = [];
  for (let no = 1; no <= n; no++) {
    const e = entries[String(no)];
    const d = cellDisplay(e, scheme, {
      showEmoji: opts.showEmoji,
      gradeEmoji: opts.gradeEmoji,
    });
    out.push({
      no,
      text: d.text,
      kind: d.kind,
      tone: d.tone,
      grade: d.grade,
      emoji: d.emoji,
      badge: d.badge,
      subText: d.subText,
      stamp: e?.stamp ?? 'none',
      status: e?.status ?? 'normal',
      pass: e?.pass ?? false,
      makeup: !!e?.makeup,
    });
  }
  return out;
}

export function buildPosterModel(args: PosterArgs): PosterModel {
  const {
    className, subject, date, content, templateId, customName, scheme, entries, n,
    comment, school, showSchoolInPoster, display,
  } = args;
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
    cells: cellsOf(entries, scheme, n, display),
    comment: (comment ?? '').trim(),
    schoolLine: showSchoolInPoster ? (school ?? '').trim() : '',
    columns: 10,
    rows: Math.ceil(n / 10),
  };
}

/** 页脚（V3 FR-35）：评价语优先，学校署名可选；不再出现 Designed by */
export function posterFooter(comment: string, school: string, showSchool: boolean): { comment: string; schoolLine: string } {
  return {
    comment: comment.trim(),
    schoolLine: showSchool ? school.trim() : '',
  };
}

/* ---------------- 当日汇总（§6.6.2） ---------------- */

export interface SummarySection {
  key: string;
  icon: string;
  sheetName: string;
  content: string;
  /** 本张表的评价语（v2.5.10：每张表各写各的，不再只有整图一条） */
  comment: string;
  statLine: string;
  cells: PosterCell[];
  createdAt: number;
}

export interface SummaryModel {
  title: string;
  subtitle: string;
  sections: SummarySection[];
  comment: string;
  schoolLine: string;
  columns: number;
  empty: boolean;
  total: number;
  overflowNote: string;
}

/** section 右侧统计：按类型取最相关的 2–3 项（PRD FR-24-4 / FR-33.5） */
export function sectionStatLine(s: DaySheetSnapshot, n: number): string {
  void n;
  const m = s.metrics;
  const makeupSuffix = m.madeUp > 0 ? ` · 补交 ${m.madeUp}` : '';

  if (s.templateId === 'dictation') {
    let passed = 0;
    let notPassed = 0;
    for (const e of Object.values(s.entries)) {
      if (!e) continue;
      if (e.status === 'leave') continue;
      if (e.status === 'missing') continue;
      const ok = isPassed(e, s.scheme);
      if (ok) passed++;
      else if (e.value !== null || e.pass) notPassed++;
    }
    return `过关 ${passed} · 未过关 ${notPassed}${makeupSuffix}`;
  }
  if (s.templateId === 'homework' || s.scheme.kind === 'grade') {
    const counts = new Map<string, number>();
    for (const e of Object.values(s.entries)) {
      if (e.value?.kind === 'grade') counts.set(e.value.grade, (counts.get(e.value.grade) ?? 0) + 1);
    }
    const order = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'D'];
    const parts = order.filter((g) => counts.get(g)).map((g) => `${g} ${counts.get(g)}`);
    return [...parts.slice(0, 4), `未交 ${m.notSubmitted}`].join(' · ') + makeupSuffix;
  }
  const avg = m.avgScore ?? m.avgPercent;
  return `平均 ${avg === null ? '—' : round1(avg)} · 优秀 ${m.excellent} · 未交 ${m.notSubmitted}${makeupSuffix}`;
}

export function buildSummaryModel(args: {
  className: string;
  date: string;
  sheets: DaySheetSnapshot[];
  n: number;
  comment?: string;
  school?: string;
  showSchoolInPoster?: boolean;
  display: PosterDisplayOptions;
}): SummaryModel {
  const { className, date, sheets, n, comment, school, showSchoolInPoster, display } = args;
  // PRD FR-24-2：超过 6 项只取**最近** 6 项（sheets 已按 createdAt 升序，故取尾部），
  // 展示顺序仍保持升序；数量提示必须渲染（否则老师不知道有表没进图）。
  const shown = sheets.length > SUMMARY_LIMIT ? sheets.slice(-SUMMARY_LIMIT) : sheets;
  const sections: SummarySection[] = shown.map((s) => ({
    key: s.key,
    icon: s.icon,
    sheetName: s.sheetName,
    content: s.content,
    // FR-66.2：每张表的评价语来自它自己的记录（空串表示这张表不写）
    comment: (s.comment ?? '').trim(),
    statLine: sectionStatLine(s, n),
    cells: cellsOf(s.entries, s.scheme, n, display),
    createdAt: s.createdAt,
  }));

  return {
    title: `🌸 ${className} · ${formatDateCN(date)} 登记汇总 🌸`,
    subtitle: `${formatDateFullCN(date)} ${weekdayCN(date)}`,
    sections,
    comment: (comment ?? '').trim(),
    schoolLine: showSchoolInPoster ? (school ?? '').trim() : '',
    columns: 10,
    empty: sections.length === 0,
    total: sheets.length,
    overflowNote: summaryOverflowNote(sheets.length),
  };
}

/** 当日汇总最多展示的表数（PRD FR-24-2） */
export const SUMMARY_LIMIT = 6;

/** 汇总图超出 6 项时的提示（PRD FR-24-2 原文） */
export function summaryOverflowNote(total: number): string {
  if (total <= SUMMARY_LIMIT) return '';
  return `（今日共 ${total} 项，仅展示最近 ${SUMMARY_LIMIT} 项）`;
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
