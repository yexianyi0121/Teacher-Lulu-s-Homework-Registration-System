import type {
  Entries,
  PassRule,
  PersistedStateV4,
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
import type { DigitKeyMode } from '../domain/digitKey';
import type { AppState } from './store-types';
import { currentClass } from './index';
import { hasEntries } from './initial';

const countOf = (s: AppState) => currentClass(s)?.count ?? 0;

/**
 * 当前表的数字键语义（V4 FR-46.1）：本表覆盖 > 全局默认 > auto。
 * 内核（useInputEngine）与 UI（HintBar chip）都只能从这里取，保证两处永远一致。
 */
export function selectDigitKeyMode(s: AppState): DigitKeyMode {
  return s.draft.digitKey ?? s.settings.digitKey ?? 'auto';
}

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

function posterState(s: AppState): PersistedStateV4 {
  return {
    version: 4,
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

/** 单条海报（FR-64.2）：按记录 key 取当天某张表——同模板多张表共享 sheetId，sheetId 区分不开；records 优先，其次 history */
export function selectPosterBySheet(s: AppState, key: string) {
  const cls = currentClass(s);
  const fromRecords = Object.values(s.records).find(
    (r) => r.key === key,
  );
  const rec = fromRecords
    ?? s.history.find((h) => h.key === key)
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

/** 当天已登记的全部表（FR-64.1：按记录 key 去重——同模板的多张表必须都出现）
 * v2.6.2 FR-71.1：只列「已登记」的表——在作业内容里随手打字，结果每打一个字就在选择器里多出一项空表，而使用者真正要看的是他真瞬间录过的表。
 * 当前草稿总是保留（不管有没有登记），才能在选择器里根据作业内容切来切去。 */
export function selectSheetsOfDay(s: AppState) {
  const seen = new Map<string, { key: string; sheetId: string; content: string; templateId: string; entered: number }>();
  const add = (r: { key: string; sheetId: string; content: string; templateId: string; entries: Entries }) => {
    if (!seen.has(r.key)) {
      seen.set(r.key, { key: r.key,
        sheetId: r.sheetId,
        content: r.content,
        templateId: r.templateId,
        entered: Object.values(r.entries).filter((e) => e.value !== null || e.pass || e.status !== 'normal').length,
      });
    }
  };
  for (const h of s.history) if (h.classId === s.activeClassId && h.date === s.draft.date && hasEntries(h.entries)) add(h);
  for (const r of Object.values(s.records)) {
    if (r.classId !== s.activeClassId || r.date !== s.draft.date) continue;
    if (r.key !== s.draft.key && !hasEntries(r.entries)) continue;
    add(r);
  }
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
