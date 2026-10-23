import type { CellValue, Entry, Mode } from '../domain/types';
import { CONTENT_MAX, MAX_STUDENTS, MIN_STUDENTS, TEXT_MAX } from '../domain/constants';
import { normalizeScore } from '../domain/grades';
import { recordKey } from '../utils/id';
import type { VoiceEdit } from '../domain/voice-parse';
import type { AppState, StoreGet, StoreSet } from './store-types';
import { createEmptyRecord, createStudents } from './initial';
import { buildHistoryEntry, hasAnyValue, upsertHistory } from './history-helpers';

type RecordSlice = Pick<
  AppState,
  | 'setValue'
  | 'clearCell'
  | 'toggleStamp'
  | 'batchStamp'
  | 'batchClear'
  | 'switchMode'
  | 'setDate'
  | 'setContent'
  | 'switchRecord'
  | 'setStudentCount'
  | 'commitToHistory'
  | 'clearCurrentRecord'
  | 'applyVoiceEdits'
>;

/** 按模式校验并规范化值（INV-5） */
function normalizeValue(mode: Mode, value: CellValue | null): CellValue | null {
  if (!value) return null;
  if (mode === 'homework') return value.kind === 'grade' ? value : null;
  if (mode === 'quiz') {
    return value.kind === 'score' ? { kind: 'score', score: normalizeScore(value.score) } : null;
  }
  return value.kind === 'text' ? { kind: 'text', text: value.text.trim().slice(0, TEXT_MAX) } : null;
}

export function createRecordSlice(set: StoreSet, get: StoreGet): RecordSlice {
  return {
    setValue(no, value) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec) return;
      if (!Number.isInteger(no) || no < 1 || no > s.settings.count) return;

      const v = normalizeValue(rec.mode, value);
      if (value !== null && v === null) return;

      get().pushUndo('录入');
      const prev = rec.entries[String(no)];
      const entry: Entry = {
        value: v,
        stamp: prev?.stamp ?? 'none',
        updatedAt: Date.now(),
      };
      set({
        drafts: {
          ...s.drafts,
          [rec.id]: {
            ...rec,
            entries: { ...rec.entries, [String(no)]: entry },
            updatedAt: Date.now(),
          },
        },
      });
    },

    clearCell(no) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec) return;
      if (!rec.entries[String(no)]) return;
      get().pushUndo('清空');
      const entries = { ...rec.entries };
      delete entries[String(no)];
      set({
        drafts: { ...s.drafts, [rec.id]: { ...rec, entries, updatedAt: Date.now() } },
      });
    },

    toggleStamp(no) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec) return;
      if (!Number.isInteger(no) || no < 1 || no > s.settings.count) return;

      get().pushUndo('盖章');
      const prev = rec.entries[String(no)];
      const cur = prev?.stamp ?? 'none';
      const next = cur === s.currentStamp ? 'none' : s.currentStamp;
      const entry: Entry = {
        value: prev?.value ?? null,
        stamp: next,
        updatedAt: Date.now(),
      };
      set({
        drafts: {
          ...s.drafts,
          [rec.id]: { ...rec, entries: { ...rec.entries, [String(no)]: entry }, updatedAt: Date.now() },
        },
      });
    },

    batchStamp(nos) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec || nos.length === 0) return;

      const targets = nos.filter((no) => no >= 1 && no <= s.settings.count);
      if (targets.length === 0) return;

      const allStamped = targets.every((no) => rec.entries[String(no)]?.stamp === s.currentStamp);
      const stamp = allStamped ? 'none' : s.currentStamp;

      get().pushUndo('批量盖章');
      const entries = { ...rec.entries };
      for (const no of targets) {
        const prev = entries[String(no)];
        entries[String(no)] = {
          value: prev?.value ?? null,
          stamp,
          updatedAt: Date.now(),
        };
      }
      set({ drafts: { ...s.drafts, [rec.id]: { ...rec, entries, updatedAt: Date.now() } } });
    },

    batchClear(nos) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec || nos.length === 0) return;

      get().pushUndo('批量清空');
      const entries = { ...rec.entries };
      for (const no of nos) delete entries[String(no)];
      set({ drafts: { ...s.drafts, [rec.id]: { ...rec, entries, updatedAt: Date.now() } } });
    },

    switchMode(mode) {
      get().switchRecord({ mode });
    },

    setDate(v) {
      get().switchRecord({ date: v });
    },

    setContent(v) {
      get().switchRecord({ content: v.slice(0, CONTENT_MAX) });
    },

    switchRecord(patch) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec) return;

      const date = patch.date ?? rec.date;
      const content = patch.content !== undefined ? patch.content.slice(0, CONTENT_MAX) : rec.content;
      const mode = patch.mode ?? rec.mode;
      const key = recordKey(date, content, mode);
      if (key === rec.id) return;

      let history = s.history;
      let dirty = false;
      const committed = history.find((h) => h.id === rec.id);
      if (hasAnyValue(rec) && (!committed || committed.savedAt < rec.updatedAt)) {
        history = upsertHistory(history, buildHistoryEntry(rec, s.settings));
        dirty = true;
      }

      const existing = s.drafts[key];
      const draft = existing ?? createEmptyRecord(date, content, mode);

      set({
        history,
        drafts: { ...s.drafts, [rec.id]: rec, [key]: draft },
        activeKey: key,
        focusedNo: 1,
        selection: new Set<number>(),
        selectionAnchor: null,
        editing: null,
        buffer: null,
        compareId: null,
      });

      if (dirty) get().showToast('已保存上一条', 'ok');
    },

    setStudentCount(n) {
      const s = get();
      const count = Math.min(MAX_STUDENTS, Math.max(MIN_STUDENTS, Math.round(n)));
      if (!Number.isFinite(count) || count === s.settings.count) return;

      get().pushUndo('人数');
      const focusedNo = s.focusedNo !== null && s.focusedNo > count ? 1 : s.focusedNo;
      // INV-8 / BR-40：绝不删除 entries，只改展示人数
      set({
        settings: { ...s.settings, count },
        classInfo: { ...s.classInfo, students: createStudents(count, s.classInfo.students) },
        focusedNo,
        selection: new Set<number>(),
        selectionAnchor: null,
      });
    },

    commitToHistory() {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec) return;

      const exists = s.history.some((h) => h.id === rec.id);
      const now = Date.now();
      const entry = buildHistoryEntry(rec, s.settings, now);
      const history = upsertHistory(s.history, entry);
      set({
        history,
        drafts: { ...s.drafts, [rec.id]: { ...rec, updatedAt: now } },
      });
      get().showToast(exists ? '已更新历史记录' : '已保存到历史记录', 'ok');
    },

    clearCurrentRecord() {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec) return;
      if (Object.keys(rec.entries).length === 0) return;

      get().pushUndo('清空');
      set({
        drafts: { ...s.drafts, [rec.id]: { ...rec, entries: {}, updatedAt: Date.now() } },
        selection: new Set<number>(),
        selectionAnchor: null,
        editing: null,
        buffer: null,
      });
      get().showToast('已清空本条记录，可 Ctrl+Z 恢复', 'ok');
    },

    applyVoiceEdits(edits) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec || edits.length === 0) return;

      get().pushUndo('语音');
      const entries = { ...rec.entries };

      const apply = (edit: VoiceEdit) => {
        const key = String(edit.no);
        const prev = entries[key];
        const a = edit.action;
        if (a.type === 'clear') {
          delete entries[key];
          return;
        }
        if (a.type === 'stamp') {
          entries[key] = { value: prev?.value ?? null, stamp: a.stamp, updatedAt: Date.now() };
          return;
        }
        let value: CellValue | null = null;
        if (a.type === 'grade') value = { kind: 'grade', grade: a.grade };
        if (a.type === 'score') value = { kind: 'score', score: normalizeScore(a.score) };
        if (a.type === 'text') value = { kind: 'text', text: a.text.slice(0, TEXT_MAX) };
        const v = normalizeValue(rec.mode, value);
        if (!v) return;
        entries[key] = { value: v, stamp: prev?.stamp ?? 'none', updatedAt: Date.now() };
      };

      for (const edit of edits) apply(edit);

      set({
        drafts: { ...s.drafts, [rec.id]: { ...rec, entries, updatedAt: Date.now() } },
        flashNo: edits[0]?.no ?? null,
      });
    },
  };
}
