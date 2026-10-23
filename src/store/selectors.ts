import type { AppState } from './store-types';
import type { HistoryEntry, RecordDoc, RosterGroups, SessionMetrics, Settings } from '../domain/types';
import type { PosterModel } from '../domain/poster-model';
import { computeStats } from '../domain/stats';
import { classifyRoster } from '../domain/roster';
import { buildReport } from '../domain/report';
import { buildPosterModel } from '../domain/poster-model';
import { HISTORY_WINDOW } from '../domain/constants';

type Sel<T> = (s: AppState) => T;

/** 单输入记忆化：输入引用不变则返回同一结果对象（设计 §5.4 引用稳定） */
export function memo1<A, R>(a: Sel<A>, fn: (a: A) => R): Sel<R> {
  let has = false;
  let lastA: A;
  let lastR: R;
  return (s) => {
    const av = a(s);
    if (!has || av !== lastA) {
      lastA = av;
      lastR = fn(av);
      has = true;
    }
    return lastR;
  };
}

/** 双输入记忆化 */
export function memo2<A, B, R>(a: Sel<A>, b: Sel<B>, fn: (a: A, b: B) => R): Sel<R> {
  let has = false;
  let lastA: A;
  let lastB: B;
  let lastR: R;
  return (s) => {
    const av = a(s);
    const bv = b(s);
    if (!has || av !== lastA || bv !== lastB) {
      lastA = av;
      lastB = bv;
      lastR = fn(av, bv);
      has = true;
    }
    return lastR;
  };
}

/** 三输入记忆化 */
export function memo3<A, B, C, R>(
  a: Sel<A>,
  b: Sel<B>,
  c: Sel<C>,
  fn: (a: A, b: B, c: C) => R,
): Sel<R> {
  let has = false;
  let lastA: A;
  let lastB: B;
  let lastC: C;
  let lastR: R;
  return (s) => {
    const av = a(s);
    const bv = b(s);
    const cv = c(s);
    if (!has || av !== lastA || bv !== lastB || cv !== lastC) {
      lastA = av;
      lastB = bv;
      lastC = cv;
      lastR = fn(av, bv, cv);
      has = true;
    }
    return lastR;
  };
}

export const selectActiveRecord: Sel<RecordDoc> = (s) => s.drafts[s.activeKey];
export const selectSettings: Sel<Settings> = (s) => s.settings;
export const selectEntryByNo = (no: number) => (s: AppState) => s.drafts[s.activeKey]?.entries[String(no)];

export const selectStats: Sel<SessionMetrics> = memo2(selectActiveRecord, selectSettings, (rec, settings) =>
  computeStats(rec.mode, rec.entries, settings),
);

export const selectRoster: Sel<RosterGroups> = memo2(selectActiveRecord, selectSettings, (rec, settings) =>
  classifyRoster(rec.mode, rec.entries, settings),
);

export const selectReport: Sel<string> = memo2(selectActiveRecord, selectSettings, (rec, settings) =>
  buildReport({
    date: rec.date,
    content: rec.content,
    mode: rec.mode,
    groups: classifyRoster(rec.mode, rec.entries, settings),
    n: settings.count,
  }),
);

export const selectPosterModel: Sel<PosterModel> = memo3(
  selectActiveRecord,
  selectSettings,
  (s) => s.classInfo,
  (rec, settings, classInfo) =>
    buildPosterModel({
      subject: classInfo.subject,
      teacher: classInfo.teacher,
      school: classInfo.school,
      date: rec.date,
      content: rec.content,
      mode: rec.mode,
      entries: rec.entries,
      n: settings.count,
      settings,
    }),
);

export const selectHistoryWindow: Sel<HistoryEntry[]> = memo1(
  (s) => s.history,
  (history) => history.slice(0, HISTORY_WINDOW),
);

/** 本轮「本次」的指标（用于图表对比） */
export function currentMetrics(s: AppState): SessionMetrics {
  const rec = s.drafts[s.activeKey];
  if (!rec) return computeStats('quiz', {}, s.settings);
  return computeStats(rec.mode, rec.entries, s.settings);
}
