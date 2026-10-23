import type {
  Entries,
  PassRule,
  PersistedStateV3,
  PosterTarget,
  RosterGroups,
  ScoringScheme,
  SessionMetrics,
} from '../domain/types';
import { computeStats } from '../domain/stats';
import { classifyRoster } from '../domain/roster';
import { buildReport } from '../domain/report';
import { buildPosterModel, buildSummaryModel, type PosterDisplayOptions } from '../domain/poster';
import { buildWeekModel } from '../domain/posterWeek';
import { snapshotDay, hasContent } from '../domain/summary';
import { isPassed } from '../domain/passRule';
import { weekStartOf } from '../domain/date';
import type { AppState } from './store-types';
import { currentClass } from './index';

const countOf = (s: AppState) => currentClass(s)?.count ?? 0;

/** 展示选项（两套色系 / 表情 / 过关规则）—— 所有渲染入口共用 */
export function selectDisplayOptions(s: AppState): PosterDisplayOptions {
  return {
    passRule: s.settings.passRule,
    showEmoji: s.settings.showEmoji,
    gradeEmoji: s.settings.gradeEmoji,
  };
}

interface StatsCache {
  stats: SessionMetrics;
  n: number;
  rule: PassRule;
}

const statsMemo = new WeakMap<object, Map<ScoringScheme, StatsCache>>();

/** 统计（按 entries 引用 + 方案 + 人数 + 过关规则缓存，避免 120 格每键重算） */
export function selectStats(s: AppState): SessionMetrics {
  const n = countOf(s);
  const rule = s.settings.passRule;
  const key = s.draft.entries as unknown as object;
  let byScheme = statsMemo.get(key);
  if (!byScheme) {
    byScheme = new Map();
    statsMemo.set(key, byScheme);
  }
  const hit = byScheme.get(s.draft.scheme);
  if (hit && hit.n === n && hit.rule === rule) return hit.stats;
  const stats = computeStats(s.draft.entries, s.draft.scheme, n, s.settings.honorIncludesA, rule);
  byScheme.set(s.draft.scheme, { stats, n, rule });
  return stats;
}

export function statsOf(
  entries: Entries,
  scheme: ScoringScheme,
  n: number,
  honorIncludesA: boolean,
  passRule: PassRule,
): SessionMetrics {
  return computeStats(entries, scheme, n, honorIncludesA, passRule);
}

export function selectRoster(s: AppState): RosterGroups {
  return classifyRoster(s.draft.entries, s.draft.scheme, countOf(s), {
    honorIncludesA: s.settings.honorIncludesA,
  });
}

export function selectReport(s: AppState): string {
  const cls = currentClass(s);
  const groups = selectRoster(s);
  const notes: Record<number, string> = {};
  for (const [no, e] of Object.entries(s.draft.entries)) {
    if (e.makeup?.note) notes[Number(no)] = e.makeup.note;
  }
  return buildReport({
    date: s.draft.date,
    content: s.draft.content,
    templateId: s.draft.templateId,
    className: cls?.name ?? '',
    groups,
    notes,
    n: countOf(s),
  });
}

function posterState(s: AppState): PersistedStateV3 {
  return {
    version: 3,
    activeClassId: s.activeClassId,
    classes: s.classes,
    records: Object.values(s.records),
    history: s.history,
    pointRules: s.pointRules,
    pointLedger: s.pointLedger,
    settings: s.settings,
    lastSavedAt: s.lastSavedAt ?? 0,
  };
}

export function selectPosterModel(s: AppState) {
  const cls = currentClass(s);
  return buildPosterModel({
    className: cls?.name ?? '',
    subject: cls?.subject ?? '语文',
    date: s.draft.date,
    content: s.draft.content,
    templateId: s.draft.templateId,
    scheme: s.draft.scheme,
    entries: s.draft.entries,
    n: countOf(s),
    comment: s.draft.comment ?? s.settings.defaultComment,
    school: cls?.school ?? '',
    showSchoolInPoster: s.settings.showSchoolInPoster,
    display: selectDisplayOptions(s),
  });
}

/** 单条海报：按 sheetId 取当天某张表（records 优先，其次 history），找不到回落当前草稿 */
export function selectPosterBySheet(s: AppState, sheetId: string) {
  const cls = currentClass(s);
  const fromRecords = Object.values(s.records).find(
    (r) => r.classId === s.activeClassId && r.date === s.draft.date && r.sheetId === sheetId,
  );
  const rec = fromRecords
    ?? s.history.find((h) => h.classId === s.activeClassId && h.date === s.draft.date && h.sheetId === sheetId)
    ?? s.draft;

  return buildPosterModel({
    className: cls?.name ?? '',
    subject: cls?.subject ?? '语文',
    date: rec.date,
    content: rec.content,
    templateId: rec.templateId,
    scheme: rec.scheme,
    entries: rec.entries,
    n: countOf(s),
    comment: rec.comment ?? s.settings.defaultComment,
    school: cls?.school ?? '',
    showSchoolInPoster: s.settings.showSchoolInPoster,
    display: selectDisplayOptions(s),
  });
}

/** 当天已登记的全部表（单条模式的选择器用它） */
export function selectSheetsOfDay(s: AppState) {
  const seen = new Map<string, { sheetId: string; content: string; templateId: string; entered: number }>();
  const add = (r: { sheetId: string; content: string; templateId: string; entries: Entries }) => {
    if (!seen.has(r.sheetId)) {
      seen.set(r.sheetId, {
        sheetId: r.sheetId,
        content: r.content,
        templateId: r.templateId,
        entered: Object.values(r.entries).filter((e) => e.value !== null || e.pass || e.status !== 'normal').length,
      });
    }
  };
  for (const h of s.history) if (h.classId === s.activeClassId && h.date === s.draft.date) add(h);
  for (const r of Object.values(s.records)) if (r.classId === s.activeClassId && r.date === s.draft.date) add(r);
  return [...seen.values()];
}

/** 当日汇总（含已固化历史；空表不进图） */
export function selectSummary(s: AppState) {
  const cls = currentClass(s);
  const sheets = snapshotDay(posterState(s), s.activeClassId, s.draft.date).filter(hasContent);
  return buildSummaryModel({
    className: cls?.name ?? '',
    date: s.draft.date,
    sheets,
    n: countOf(s),
    comment: s.draft.comment ?? s.settings.defaultComment,
    school: cls?.school ?? '',
    showSchoolInPoster: s.settings.showSchoolInPoster,
    display: selectDisplayOptions(s),
  });
}

/** 本周汇总（weekStart 缺省取当前日期所在 ISO 周） */
export function selectWeek(s: AppState, weekStart?: string) {
  const cls = currentClass(s);
  return buildWeekModel({
    className: cls?.name ?? '',
    weekStart: weekStart ?? weekStartOf(s.draft.date),
    state: posterState(s),
    classId: s.activeClassId,
    display: selectDisplayOptions(s),
    comment: s.draft.comment ?? s.settings.defaultComment,
    school: cls?.school ?? '',
    showSchoolInPoster: s.settings.showSchoolInPoster,
  });
}

/** 当前 target 对应的周起始（单条/当日时取当前日期所在周） */
export function weekStartOfTarget(s: AppState, target: PosterTarget): string {
  return target.mode === 'week' ? target.weekStart : weekStartOf(s.draft.date);
}

export function selectHistoryWindow(s: AppState) {
  return s.history.filter((h) => h.classId === s.activeClassId).slice(0, 8);
}

/** 只看未过关：唯一入口 isPassed；请假不算未过关 */
export function selectVisibleNos(s: AppState): number[] {
  const n = countOf(s);
  const all = Array.from({ length: n }, (_, i) => i + 1);
  if (!s.filterNotPassed) return all;
  return all.filter((no) => {
    const e = s.draft.entries[String(no)];
    if (e?.status === 'leave') return false;
    return !isPassed(e, s.draft.scheme, s.settings.passRule);
  });
}

/** 学号 → 姓名 */
export function selectNames(s: AppState): Record<number, string | undefined> {
  const out: Record<number, string | undefined> = {};
  for (const st of currentClass(s)?.students ?? []) out[st.no] = st.name;
  return out;
}
