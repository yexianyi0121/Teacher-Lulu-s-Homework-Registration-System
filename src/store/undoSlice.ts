import { UNDO_DEPTH } from '../domain/constants';
import type { Entries } from '../domain/types';
import type { AppState, StoreGet, StoreSet, UndoPatch } from './store-types';
import { cloneEntries } from './initial';

type UndoSlice = Pick<AppState, 'pushUndo' | 'undo' | 'redo'>;

/** 快照式撤销（设计 04 §5.1）：一次批量操作 = 一条 patch */
export function createUndoSlice(set: StoreSet, get: StoreGet): UndoSlice {
  return {
    pushUndo(label: string, before: Entries, after: Entries, pointsBefore?: number, touchNo?: number) {
      const s = get();
      const patch: UndoPatch = {
        label,
        recordKey: s.activeKey,
        before: cloneEntries(before),
        after: cloneEntries(after),
        pointsBefore: pointsBefore ?? s.pointLedger.length,
        // I-01：撤销后要把焦点放回「这次改的那一格」。原来存的是操作前的焦点，
        // 撤销后焦点被搬到上一格的邻居，老师接着按的数字就记到了别人身上。
        focusBefore: touchNo ?? s.focusedNo,
      };
      set({ undoStack: [...s.undoStack, patch].slice(-UNDO_DEPTH), redoStack: [] });
    },

    undo() {
      const s = get();
      const patch = s.undoStack[s.undoStack.length - 1];
      if (!patch) {
        s.showToast('没有可撤销的操作', 'warn');
        return;
      }
      const rec = s.records[patch.recordKey] ?? s.draft;
      const restored = { ...rec, entries: cloneEntries(patch.before) };
      const ledger =
        patch.pointsBefore !== undefined && s.pointLedger.length > patch.pointsBefore
          ? s.pointLedger.slice(0, patch.pointsBefore)
          : s.pointLedger;

      set({
        records: { ...s.records, [patch.recordKey]: restored },
        draft: rec.key === s.activeKey ? restored : s.draft,
        pointLedger: ledger,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, patch],
        focusedNo: patch.focusBefore ?? s.focusedNo,
        editing: null,
        buffer: null,
      });
      // U-07：撤销原本静默完成，老师分不清「撤了」还是「没反应」。
      s.showToast(`已撤销：${patch.label}`, 'ok', 3600);
    },

    redo() {
      const s = get();
      const patch = s.redoStack[s.redoStack.length - 1];
      if (!patch) {
        s.showToast('没有可重做的操作', 'warn');
        return;
      }
      const rec = s.records[patch.recordKey] ?? s.draft;
      const restored = { ...rec, entries: cloneEntries(patch.after) };
      set({
        records: { ...s.records, [patch.recordKey]: restored },
        draft: rec.key === s.activeKey ? restored : s.draft,
        undoStack: [...s.undoStack, patch],
        redoStack: s.redoStack.slice(0, -1),
        editing: null,
        buffer: null,
      });
    },
  };
}
