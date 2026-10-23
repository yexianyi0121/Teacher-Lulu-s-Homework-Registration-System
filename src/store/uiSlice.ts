import type { AppState, StoreGet, StoreSet } from './store-types';

type UiSlice = Pick<
  AppState,
  | 'setFocusedNo'
  | 'moveFocus'
  | 'setSelection'
  | 'exitSelection'
  | 'toggleSelectAll'
  | 'setCurrentStamp'
  | 'setEditing'
  | 'setBuffer'
  | 'setSearchOpen'
  | 'setSearchQuery'
  | 'setModal'
  | 'openConfirm'
  | 'closeConfirm'
  | 'showToast'
  | 'clearToast'
  | 'setPoster'
  | 'setPosterLoading'
  | 'setStorageDegraded'
  | 'markSaved'
  | 'setPulsingNo'
  | 'setFlashNo'
  | 'setChartsOpen'
  | 'setCompareId'
  | 'setVoiceListening'
  | 'setVoiceInterim'
>;

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastSeq = 0;

export function createUiSlice(set: StoreSet, get: StoreGet): UiSlice {
  return {
    setFocusedNo(no) {
      const s = get();
      const next = no === null ? null : Math.min(Math.max(1, no), s.settings.count);
      set({ focusedNo: next });
    },

    moveFocus(delta) {
      const s = get();
      const from = s.focusedNo ?? 1;
      const next = from + delta;
      if (next < 1 || next > s.settings.count) {
        if (delta > 0 && from === s.settings.count) get().showToast('已完成最后一格 ✓', 'ok');
        return;
      }
      set({ focusedNo: next, selection: new Set<number>(), selectionAnchor: null });
    },

    setSelection(nos) {
      set({ selection: nos });
    },

    exitSelection() {
      const s = get();
      set({
        selection: new Set<number>(),
        selectionAnchor: null,
        focusedNo: s.selectionAnchor ?? s.focusedNo ?? 1,
      });
    },

    toggleSelectAll() {
      const s = get();
      if (s.selection.size > 0) {
        set({
          selection: new Set<number>(),
          selectionAnchor: null,
          focusedNo: s.selectionAnchor ?? s.focusedNo ?? 1,
        });
        return;
      }
      const rec = s.drafts[s.activeKey];
      const sel = new Set<number>();
      if (rec) {
        for (let no = 1; no <= s.settings.count; no++) {
          const e = rec.entries[String(no)];
          if (e && (e.value !== null || e.stamp !== 'none')) sel.add(no);
        }
      }
      if (sel.size === 0) {
        get().showToast('还没有可选的单元格', 'warn');
        return;
      }
      set({ selection: sel, selectionAnchor: s.focusedNo ?? 1 });
    },

    setCurrentStamp(stamp) {
      set({ currentStamp: stamp });
    },

    setEditing(editing) {
      set({ editing });
    },

    setBuffer(buffer) {
      set({ buffer });
    },

    setSearchOpen(open) {
      set({ searchOpen: open, searchQuery: open ? get().searchQuery : '' });
    },

    setSearchQuery(q) {
      set({ searchQuery: q });
    },

    setModal(modal) {
      set({ modal, ...(modal ? {} : { confirmRequest: null }) });
    },

    openConfirm(req) {
      set({ confirmRequest: req });
    },

    closeConfirm() {
      set({ confirmRequest: null });
    },

    showToast(text, tone = 'ok') {
      toastSeq += 1;
      set({ toast: { id: toastSeq, text, tone } });
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        set({ toast: null });
      }, 2600);
    },

    clearToast() {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: null });
    },

    setPoster(url, blob) {
      set({ posterUrl: url, posterBlob: blob ?? null });
    },

    setPosterLoading(loading) {
      set({ posterLoading: loading });
    },

    setStorageDegraded(v) {
      set({ storageDegraded: v });
    },

    markSaved(at) {
      set({ lastSavedAt: at });
    },

    setPulsingNo(no) {
      set({ pulsingNo: no });
    },

    setFlashNo(no) {
      set({ flashNo: no });
    },

    setChartsOpen(open) {
      set({ chartsOpen: open });
    },

    setCompareId(id) {
      set({ compareId: id });
    },

    setVoiceListening(v) {
      set({ voiceListening: v, ...(v ? {} : { voiceInterim: '' }) });
    },

    setVoiceInterim(v) {
      set({ voiceInterim: v });
    },
  };
}
