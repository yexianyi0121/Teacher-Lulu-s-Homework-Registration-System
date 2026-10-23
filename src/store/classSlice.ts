import type { ClassDoc, RecordDoc, Settings, Student } from '../domain/types';
import { DEFAULT_SHEET_ID, MAX_STUDENTS, MIN_STUDENTS } from '../domain/constants';
import type { AppState, StoreGet, StoreSet } from './store-types';
import { createClass, createRecord, createStudents } from './initial';
import { todayISO } from '../domain/date';

type ClassSlice = Pick<
  AppState,
  | 'addClass' | 'renameClass' | 'deleteClass' | 'switchClass'
  | 'setCount' | 'updateClassInfo' | 'importRoster' | 'updateSettings'
>;

/** 切班后的落点：该班最近更新的记录；没有就建一条今天的常规作业 */
function pickDraft(s: AppState, classId: string): RecordDoc {
  const candidates = Object.values(s.records)
    .filter((r) => r.classId === classId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (candidates[0]) return candidates[0];
  return createRecord({
    classId,
    date: s.draft.date || todayISO(),
    templateId: 'homework',
    sheetId: DEFAULT_SHEET_ID.homework,
  });
}

export function createClassSlice(set: StoreSet, get: StoreGet): ClassSlice {
  return {
    addClass(name) {
      const s = get();
      const base = s.classes.find((c) => c.id === s.activeClassId);
      const cls = createClass({
        name: name.trim().slice(0, 20) || `新班级 ${s.classes.length + 1}`,
        school: base?.school ?? '',
        teacher: base?.teacher ?? '',
        subject: base?.subject ?? '语文',
        createdAt: Date.now(),
      });
      const rec = createRecord({ classId: cls.id, date: s.draft.date, templateId: 'homework' });
      set({ classes: [...s.classes, cls], records: { ...s.records, [rec.key]: rec } });
      s.showToast(`已新建班级「${cls.name}」`, 'ok');
    },

    renameClass(id, name) {
      const s = get();
      const next = name.trim().slice(0, 20);
      if (!next) return;
      set({ classes: s.classes.map((c) => (c.id === id ? { ...c, name: next } : c)) });
    },

    deleteClass(id) {
      const s = get();
      if (s.classes.length <= 1) {
        s.showToast('至少要保留一个班级', 'warn');
        return;
      }
      const classes = s.classes.filter((c) => c.id !== id);
      const activeClassId = s.activeClassId === id ? classes[0].id : s.activeClassId;
      const draft = s.activeClassId === id ? pickDraft(s, activeClassId) : s.draft;
      // L-2：记录与积分不物理删除，只是不再展示
      set({
        classes,
        activeClassId,
        activeKey: draft.key,
        draft,
        focusedNo: 1,
        selection: new Set<number>(),
      });
      s.showToast('已删除班级（历史记录与积分仍可通过导出取回）', 'ok');
    },

    switchClass(id) {
      const s = get();
      if (id === s.activeClassId) return;
      if (!s.classes.some((c) => c.id === id)) return;
      const draft = pickDraft(s, id);
      set({
        activeClassId: id,
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
    },

    setCount(n) {
      const s = get();
      const count = Math.min(MAX_STUDENTS, Math.max(MIN_STUDENTS, Math.round(n)));
      if (!Number.isFinite(count)) return;
      // INV-8：只改展示人数，绝不删 entries
      set({
        classes: s.classes.map((c) =>
          c.id === s.activeClassId ? { ...c, count, students: createStudents(count, c.students) } : c,
        ),
        focusedNo: s.focusedNo !== null && s.focusedNo > count ? 1 : s.focusedNo,
        selection: new Set<number>(),
      });
    },

    updateClassInfo(patch) {
      const s = get();
      set({ classes: s.classes.map((c) => (c.id === s.activeClassId ? { ...c, ...patch } : c)) });
    },

    importRoster(students: Student[]) {
      const s = get();
      const list = students.slice(0, MAX_STUDENTS).map((st, i) => ({ no: i + 1, name: st.name }));
      if (list.length < MIN_STUDENTS) return;
      set({
        classes: s.classes.map((c) => (c.id === s.activeClassId ? { ...c, students: list, count: list.length } : c)),
        focusedNo: 1,
        selection: new Set<number>(),
      });
      s.showToast(`已导入 ${list.length} 人名单`, 'ok');
    },

    updateSettings(patch: Partial<Settings>) {
      const s = get();
      const merged: Settings = { ...s.settings, ...patch };
      merged.voiceAutoConfirmMs = Math.min(5000, Math.max(500, Math.round(merged.voiceAutoConfirmMs)));
      set({ settings: merged });
    },
  };
}

/** 当前班级 */
export function activeClass(s: AppState): ClassDoc | undefined {
  return s.classes.find((c) => c.id === s.activeClassId);
}
