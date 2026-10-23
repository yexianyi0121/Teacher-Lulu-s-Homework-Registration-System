import type { Entries, HistoryEntry, RecordDoc, Settings } from '../domain/types';
import { HISTORY_LIMIT } from '../domain/constants';
import { computeStats } from '../domain/stats';

/** 深拷贝 entries（撤销快照必须深拷贝 Entry，否则撤销无效） */
export function cloneEntries(entries: Entries): Entries {
  const out: Entries = {};
  for (const key of Object.keys(entries)) {
    const e = entries[key];
    out[key] = {
      value: e.value ? { ...e.value } : null,
      stamp: e.stamp,
      updatedAt: e.updatedAt,
    };
  }
  return out;
}

/** 把一条记录固化为历史条目（同 id 覆盖） */
export function buildHistoryEntry(rec: RecordDoc, settings: Settings, savedAt = Date.now()): HistoryEntry {
  return {
    id: rec.id,
    date: rec.date,
    content: rec.content,
    mode: rec.mode,
    entries: cloneEntries(rec.entries),
    metrics: computeStats(rec.mode, rec.entries, settings),
    savedAt,
  };
}

/** 写入历史（覆盖同 id，新记录在前，最多 200 条） */
export function upsertHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, HISTORY_LIMIT);
}

/** 记录是否有任何录入值或盖章（用于 BR-39「有值且未固化」判定） */
export function hasAnyValue(rec: RecordDoc): boolean {
  return Object.values(rec.entries).some((e) => e.value !== null || e.stamp !== 'none');
}
