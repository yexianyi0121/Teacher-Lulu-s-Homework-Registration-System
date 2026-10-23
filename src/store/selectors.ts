import type { Entries, PersistedStateV2, RosterGroups, ScoringScheme, SessionMetrics } from '../domain/types';
import { computeStats } from '../domain/stats';
import { classifyRoster } from '../domain/roster';
import { buildReport } from '../domain/report';
import { buildPosterModel, buildSummaryModel } from '../domain/poster';
import { snapshotDay, hasContent } from '../domain/summary';
import type { AppState } from './store-types';
import { currentClass } from './index';

const countOf = (s: AppState) => currentClass(s)?.count ?? 0;

const statsMemo = new WeakMap<object, Map<ScoringScheme, SessionMetrics>>();

/** 统计（按 entries 引用 + 方案 + 人数缓存，避免 120 格每键重算） */
export function selectStats(s: AppState): SessionMetrics {
  const n = countOf(s);
  const key = s.draft.entries as unknown as object;
  let byScheme = statsMemo.get(key);
  if (!byScheme) {
    byScheme = new Map();
    statsMemo.set(key, byScheme);
  }
  const hit = byScheme.get(s.draft.scheme);
  if (hit && hit.n === n) return hit;
  const result = computeStats(s.draft.entries, s.draft.scheme, n, s.settings.honorIncludesA);
  byScheme.set(s.draft.scheme, result);
  return result;
}

export function statsOf(
  entries: Entries,
  scheme: ScoringScheme,
  n: number,
  honorIncludesA: boolean,
): SessionMetrics {
  return computeStats(entries, scheme, n, honorIncludesA);
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
    teacher: cls?.teacher ?? '',
    school: cls?.school ?? '',
  });
}

/** 当日汇总（含已固化历史；空表不进图） */
export function selectSummary(s: AppState) {
  const state: PersistedStateV2 = {
    version: 2,
    activeClassId: s.activeClassId,
    classes: s.classes,
    records: Object.values(s.records),
    history: s.history,
    pointRules: s.pointRules,
    pointLedger: s.pointLedger,
    settings: s.settings,
    lastSavedAt: 0,
  };
  const sheets = snapshotDay(state, s.activeClassId, s.draft.date).filter(hasContent);
  const cls = currentClass(s);
  return buildSummaryModel({
    className: cls?.name ?? '',
    date: s.draft.date,
    teacher: cls?.teacher ?? '',
    school: cls?.school ?? '',
    sheets,
    n: countOf(s),
  });
}

export function selectHistoryWindow(s: AppState) {
  return s.history.filter((h) => h.classId === s.activeClassId).slice(0, 8);
}

/** 只看未过关时的可见学号（保留原学号，不重新编号） */
export function selectVisibleNos(s: AppState): number[] {
  const n = countOf(s);
  const all = Array.from({ length: n }, (_, i) => i + 1);
  if (!s.filterNotPassed) return all;
  return all.filter((no) => {
    const e = s.draft.entries[String(no)];
    if (e?.status === 'leave') return false;
    return !(e?.pass || e?.value?.kind === 'pass');
  });
}

/** 学号 → 姓名 */
export function selectNames(s: AppState): Record<number, string | undefined> {
  const out: Record<number, string | undefined> = {};
  for (const st of currentClass(s)?.students ?? []) out[st.no] = st.name;
  return out;
}
