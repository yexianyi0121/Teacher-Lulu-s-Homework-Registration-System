import type { AppState, StoreGet, StoreSet } from './store-types';
import { MAX_STUDENTS, MIN_STUDENTS } from '../domain/constants';
import { clampThresholds } from '../domain/thresholds';
import { createStudents } from './initial';

type ClassSlice = Pick<AppState, 'importRoster'>;

export function createClassSlice(set: StoreSet, get: StoreGet): ClassSlice {
  return {
    importRoster(students) {
      const s = get();
      if (students.length === 0) return;
      const count = Math.min(MAX_STUDENTS, Math.max(MIN_STUDENTS, students.length));

      get().pushUndo('人数');
      set({
        classInfo: { ...s.classInfo, students: createStudents(count, students) },
        settings: { ...s.settings, count },
        focusedNo: 1,
        selection: new Set<number>(),
        selectionAnchor: null,
      });
      get().showToast(`已导入 ${count} 名学生`, 'ok');
    },
  };
}

type SettingsSlice = Pick<AppState, 'updateSettings' | 'updateClassInfo'>;

export function createSettingsSlice(set: StoreSet, get: StoreGet): SettingsSlice {
  return {
    updateSettings(patch) {
      const s = get();
      const merged = { ...s.settings, ...patch };

      const count =
        patch.count === undefined
          ? merged.count
          : Math.min(MAX_STUDENTS, Math.max(MIN_STUDENTS, Math.round(patch.count)));

      const t = clampThresholds(merged.passLine, merged.excellentLine);
      const next = {
        ...merged,
        count,
        passLine: t.passLine,
        excellentLine: t.excellentLine,
      };

      set({
        settings: next,
        classInfo:
          count === s.settings.count
            ? s.classInfo
            : { ...s.classInfo, students: createStudents(count, s.classInfo.students) },
        focusedNo: s.focusedNo !== null && s.focusedNo > count ? 1 : s.focusedNo,
        ...(count !== s.settings.count
          ? { selection: new Set<number>(), selectionAnchor: null }
          : {}),
      });

      if (t.adjusted) get().showToast('已调整为最近合法值', 'warn');
    },

    updateClassInfo(patch) {
      const s = get();
      set({ classInfo: { ...s.classInfo, ...patch } });
    },
  };
}

type HistorySlice = Pick<AppState, 'deleteHistory' | 'clearHistory'>;

export function createHistorySlice(set: StoreSet, get: StoreGet): HistorySlice {
  return {
    deleteHistory(id) {
      const s = get();
      set({
        history: s.history.filter((h) => h.id !== id),
        compareId: s.compareId === id ? null : s.compareId,
      });
    },

    clearHistory() {
      set({ history: [], compareId: null });
      get().showToast('已清空历史记录', 'ok');
    },
  };
}
