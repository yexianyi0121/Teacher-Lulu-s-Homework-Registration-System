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
  | 'setScheme' | 'resetScheme' | 'setComment' | 'setSheetComment' | 'commitToHistory' | 'clearCurrentRecord'
  | 'deleteHistory' | 'clearHistory' | 'setDigitKey' | 'deleteRecord'
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
      // FR-64.3（v2.5.9 问题3）：当天该模板已有登记时切回来落到最近的记录，不新建空表。
      const hit = Object.values(get().records).filter((r) => r.classId === get().activeClassId && r.date === get().draft.date && r.templateId === templateId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      get().switchRecord(hit ? { content: hit.content, sheetId: hit.sheetId, templateId } : { sheetId: DEFAULT_SHEET_ID[templateId], templateId });
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

    setComment(v) {
      const s = get();
      const rec = { ...s.draft, comment: v.slice(0, 60), updatedAt: Date.now() };
      set({ draft: rec, records: { ...s.records, [rec.key]: rec } });
    },

    /** v2.5.10 FR-66.2：编辑其它记录（如汇总图里某张表）的评价语，不切换当前表 */
    setSheetComment(key, v) {
      const s = get();
      const patch = v.slice(0, 60);
      if (key === s.draft.key) { get().setComment(patch); return; }
      const target = s.records[key];
      if (!target) return;
      const rec = { ...target, comment: patch, updatedAt: Date.now() };
      set({ records: { ...s.records, [key]: rec } });
    },

    /** V4 FR-46.1：数字键语义按表持久，同时记为新表默认（settings.digitKey） */
    setDigitKey(mode) {
      const s = get();
      const rec = { ...s.draft, digitKey: mode, updatedAt: Date.now() };
      set({
        draft: rec,
        records: { ...s.records, [rec.key]: rec },
        settings: { ...s.settings, digitKey: mode },
      });
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
      // 5 秒：这条信息老师必须看见，否则会以为「清空后救不回来了」（U-05）
      s.showToast('已清空本条记录，可 Ctrl+Z 恢复', 'ok', 5000);
    },

    deleteHistory(key) {
      const s = get();
      set({ history: s.history.filter((h) => h.key !== key) });
      s.showToast('已删除该条历史记录', 'ok');
    },

    /** v2.6.2 FR-71.2：删除一整张登记表（作业内容随手打出来的空表、录错的表） */
    deleteRecord(key) {
      const s = get();
      const target = s.records[key] ?? s.history.find((h) => h.key === key) ?? s.draft;
      const records = { ...s.records };
      delete records[key];
      const history = s.history.filter((h) => h.key !== key);
      // 删当前表时不走 switchRecord：它会把当前草稿再写回 records（删了又回来），
      // 而且会触发 commitIfDirty 把这张表推进历史，“删除”就失败了。
      if (key !== s.draft.key) {
        set({ records, history });
      } else {
        // 回到同模板当天最近一条记录（不筛有没有内容，否则空表也可以当落点）；没有就留一张新的空表
        const hit = Object.values(records)
          .filter((r) => r.classId === s.activeClassId && r.date === s.draft.date && r.templateId === s.draft.templateId)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        const draft = hit
          ? { ...hit, templateId: s.draft.templateId }
          : createRecord({ classId: s.activeClassId, date: s.draft.date, content: '', templateId: s.draft.templateId, scheme: s.draft.scheme });
        set({
          records: { ...records, [draft.key]: draft },
          history,
          activeKey: draft.key,
          draft,
          focusedNo: 1,
          selection: new Set<number>(),
          selectionAnchor: null,
          editing: null,
          buffer: null,
          compareId: null,
          filterNotPassed: false,
        });
      }
      s.showToast(`已删除「${target.content || '未命名'}」这张表`, 'ok', 5000);
    },

    clearHistory() {
      const s = get();
      set({ history: [] });
      s.showToast('已清空历史记录', 'ok');
    },
  };
}
