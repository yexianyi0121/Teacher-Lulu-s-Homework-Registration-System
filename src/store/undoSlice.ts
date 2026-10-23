import { UNDO_DEPTH } from '../domain/constants';
import type { AppState, StoreGet, StoreSet, UndoPatch } from './store-types';
import { cloneEntries } from './history-helpers';
import { createStudents } from './initial';

type UndoSlice = Pick<AppState, 'pushUndo' | 'undo' | 'redo'>;

export function createUndoSlice(set: StoreSet, get: StoreGet): UndoSlice {
  return {
    pushUndo(label: string) {
      const s = get();
      const rec = s.drafts[s.activeKey];
      if (!rec) return;
      const patch: UndoPatch = {
        key: rec.id,
        entries: cloneEntries(rec.entries),
        count: s.settings.count,
        focus: s.focusedNo,
        label,
      };
      const undoStack = [...s.undoStack, patch];
      if (undoStack.length > UNDO_DEPTH) undoStack.splice(0, undoStack.length - UNDO_DEPTH);
      set({ undoStack, redoStack: [] });
    },

    undo() {
      const s = get();
      const patch = s.undoStack[s.undoStack.length - 1];
      if (!patch) return;
      const rec = s.drafts[patch.key];
      if (!rec) {
        set({ undoStack: s.undoStack.slice(0, -1) });
        return;
      }
      const redo: UndoPatch = {
        key: patch.key,
        entries: cloneEntries(rec.entries),
        count: s.settings.count,
        focus: s.focusedNo,
        label: patch.label,
      };
      set({
        drafts: {
          ...s.drafts,
          [patch.key]: { ...rec, entries: patch.entries, updatedAt: Date.now() },
        },
        settings: { ...s.settings, count: patch.count },
        classInfo: { ...s.classInfo, students: createStudents(patch.count, s.classInfo.students) },
        activeKey: patch.key,
        focusedNo: patch.focus,
        selection: new Set<number>(),
        selectionAnchor: null,
        editing: null,
        buffer: null,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, redo].slice(-UNDO_DEPTH),
      });
    },

    redo() {
      const s = get();
      const patch = s.redoStack[s.redoStack.length - 1];
      if (!patch) return;
      const rec = s.drafts[patch.key];
      if (!rec) {
        set({ redoStack: s.redoStack.slice(0, -1) });
        return;
      }
      const undo: UndoPatch = {
        key: patch.key,
        entries: cloneEntries(rec.entries),
        count: s.settings.count,
        focus: s.focusedNo,
        label: patch.label,
      };
      set({
        drafts: {
          ...s.drafts,
          [patch.key]: { ...rec, entries: patch.entries, updatedAt: Date.now() },
        },
        settings: { ...s.settings, count: patch.count },
        classInfo: { ...s.classInfo, students: createStudents(patch.count, s.classInfo.students) },
        activeKey: patch.key,
        focusedNo: patch.focus,
        selection: new Set<number>(),
        selectionAnchor: null,
        editing: null,
        buffer: null,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, undo].slice(-UNDO_DEPTH),
      });
    },
  };
}
