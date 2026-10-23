import type { Entries, HistoryEntry, ScoringScheme } from '../domain/types';
import { DEFAULT_SCHEMES, DEFAULT_SHEET_ID, HISTORY_LIMIT } from '../domain/constants';
import { computeStats } from '../domain/stats';
import type { AppState, StoreGet, StoreSet } from './store-types';
import { cloneEntries, cloneScheme, createRecord, hasEntries, toHistoryEntry } from './initial';
import { classCount } from './entrySlice';
import { recordKey } from '../utils/id';

type SheetSlice = Pick<
  AppState,
  | 'switchTemplate' | 'switchSheet' | 'setDate' | 'setContent' | 'switchRecord'
  | 'setScheme' | 'resetScheme' | 'commitToHistory' | 'clearCurrentRecord'
  | 'deleteHistory' | 'clearHistory'
>;

function upsert(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...history.filter((h) => h.key !== entry.key)]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, HISTORY_LIMIT);
}

export function createSheetSlice(set: StoreSet, get: StoreGet): SheetSlice {
  /** BR-39：切记录前把「有值且未固化」的当前记录静默存进历史 */
  function commitIfDirty(draft = get().draft): { history: HistoryEntry[]; committed: boolean } {
    const s = get();
    if (!hasEntries(draft.entries)) return { history: s.history, committed: false };
    const existing = s.history.find((h) => h.key === draft.key);
    if (existing && existing.savedAt >= draft.updatedAt) return { history: s.history, committed: false };
    const metrics = computeStats(draft.entries, draft.scheme, classCount(s), s.settings.honorIncludesA);
    return { history: upsert(s.history, toHistoryEntry(draft, metrics, Date.now())), committed: true };
  }

  return {
    switchTemplate(templateId) {
      get().switchRecord({ sheetId: DEFAULT_SHEET_ID[templateId], templateId });
    },

    switchSheet(sheetId, templateId) {
      get().switchRecord({ sheetId, templateId });
    },

    setDate(v) {
      get().switchRecord({ date: v });
    },

    setContent(v) {
      get().switchRecord({ content: v.slice(0, 20) });
    },

    switchRecord(patch) {
      const s = get();
      const cur = s.draft;
      const date = patch.date ?? cur.date;
      const content = patch.content !== undefined ? patch.content.slice(0, 20) : cur.content;
      const sheetId = patch.sheetId ?? cur.sheetId;
      const templateId = patch.templateId ?? cur.templateId;

      const key = recordKey({ classId: cur.classId, date, content, sheetId });
      if (key === cur.key && templateId === cur.templateId) return;

      const { history, committed } = commitIfDirty(cur);

      const existing = s.records[key];
      const draft = existing
        ? { ...existing, templateId }
        : createRecord({ classId: cur.classId, date, content, templateId, sheetId });

      set({
        history,
        records: { ...s.records, [cur.key]: cur, [key]: draft },
        activeKey: key,
        draft,
        focusedNo: 1,
        selection: new Set<number>(),
        selectionAnchor: null,
        editing: null,
        buffer: null,
        compareId: null,
        filterNotPassed: false,
      });

      if (committed) s.showToast('已保存上一条', 'ok');
    },

    setScheme(patch: Partial<ScoringScheme>) {
      const s = get();
      const rec = s.draft;
      const scheme = { ...rec.scheme, ...patch, grades: patch.grades ? [...patch.grades] : rec.scheme.grades };
      const updated = { ...rec, scheme, updatedAt: Date.now() };
      set({ records: { ...s.records, [rec.key]: updated }, draft: updated });
    },

    resetScheme() {
      const s = get();
      const rec = s.draft;
      const scheme = cloneScheme(DEFAULT_SCHEMES[rec.templateId]);
      const updated = { ...rec, scheme, updatedAt: Date.now() };
      set({ records: { ...s.records, [rec.key]: updated }, draft: updated });
      s.showToast('已恢复本类型默认方案', 'ok');
    },

    commitToHistory() {
      const s = get();
      const rec = s.draft;
      if (!hasEntries(rec.entries)) {
        s.showToast('这条记录还没有任何录入', 'warn');
        return;
      }
      const metrics = computeStats(rec.entries, rec.scheme, classCount(s), s.settings.honorIncludesA);
      set({ history: upsert(s.history, toHistoryEntry(rec, metrics, Date.now())) });
      s.showToast('已保存到历史记录', 'ok');
    },

    clearCurrentRecord() {
      const s = get();
      const rec = s.draft;
      if (!hasEntries(rec.entries)) return;
      const before = cloneEntries(rec.entries);
      const updated = { ...rec, entries: {} as Entries, updatedAt: Date.now() };
      s.pushUndo('清空当前记录', before, {}, s.pointLedger.length);
      set({ records: { ...s.records, [rec.key]: updated }, draft: updated, buffer: null });
      s.showToast('已清空本条记录，可 Ctrl+Z 恢复', 'ok');
    },

    deleteHistory(key) {
      const s = get();
      set({ history: s.history.filter((h) => h.key !== key) });
      s.showToast('已删除该条历史记录', 'ok');
    },

    clearHistory() {
      const s = get();
      set({ history: [] });
      s.showToast('已清空历史记录', 'ok');
    },
  };
}
